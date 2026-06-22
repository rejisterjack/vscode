/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { IChatService, IMessage, IConversation, ConversationOptions, IMessageChunk } from '../common/types/conversation.types.js';
import { IBackendService } from '../backend/backendService.js';
import { IContextManager } from '../common/types/context.types.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { CancellationTokenSource } from '../../base/common/cancellation.js';
import { BackendHttpClient } from '../backend/httpClient.js';
import { SessionInfo, SSEEventPayload, PermissionRequest, QuestionRequest, PermissionReplyRequest, QuestionAnswerRequest } from '../backend/apiTypes.js';
import { ChatMessage, PendingPermission, PendingQuestion, toChatMessage, toUiPart } from './chatModels.js';

/**
 * ChatService — session and message management backed by the CLI backend.
 *
 * Bridges the persistence-layer IChatService interface to the CLI's REST
 * + SSE API. Handles:
 *   - Session CRUD (create, list, delete, rename)
 *   - Message sending (user prompt → backend → assistant response)
 *   - Streaming (SSE part-updated events → incremental UI updates)
 *   - Permission requests (inline approval flow)
 *   - Question requests (inline answer flow)
 *   - Abort (cancel an in-flight turn)
 */
export class ChatService extends Disposable implements IChatService {
	readonly _serviceBrand: undefined;

	private readonly conversations = new Map<string, IConversation>();
	private readonly sessionMessages = new Map<string, ChatMessage[]>();
	private readonly streamingMessages = new Map<string, ChatMessage>();

	private readonly pendingPermissions = new Map<string, PendingPermission>();
	private readonly pendingQuestions = new Map<string, PendingQuestion>();

	private currentSessionId: string | undefined;
	private abortTokenSource: CancellationTokenSource | null = null;
	private sseSubscription: IDisposable | null = null;

	private readonly _onMessageReceived = this._register(new Emitter<{ conversationId: string; message: IMessage }>());
	readonly onMessageReceived: Event<{ conversationId: string; message: IMessage }> = this._onMessageReceived.event;

	private readonly _onConversationUpdated = this._register(new Emitter<IConversation>());
	readonly onConversationUpdated: Event<IConversation> = this._onConversationUpdated.event;

	private readonly _onMessageStreaming = this._register(new Emitter<{ conversationId: string; content: string; messageId: string }>());
	readonly onMessageStreaming: Event<{ conversationId: string; content: string; messageId: string }> = this._onMessageStreaming.event;

	private readonly _onChatMessageUpdated = this._register(new Emitter<{ conversationId: string; message: ChatMessage }>());
	readonly onChatMessageUpdated: Event<{ conversationId: string; message: ChatMessage }> = this._onChatMessageUpdated.event;

	private readonly _onPermissionRequested = this._register(new Emitter<PendingPermission>());
	readonly onPermissionRequested: Event<PendingPermission> = this._onPermissionRequested.event;

	private readonly _onQuestionRequested = this._register(new Emitter<PendingQuestion>());
	readonly onQuestionRequested: Event<PendingQuestion> = this._onQuestionRequested.event;

	private readonly _onSessionChanged = this._register(new Emitter<string | undefined>());
	readonly onSessionChanged: Event<string | undefined> = this._onSessionChanged.event;

	constructor(
		@IBackendService private readonly backendService: IBackendService,
		@IContextManager private readonly contextManager: IContextManager,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
	) {
		super();
		this.subscribeToBackend();
	}

	// --- Session management ----------------------------------------------------

	private getWorkspaceDirectory(): string {
		const folders = this.workspaceContextService.getWorkspace().folders;
		return folders.length > 0 ? folders[0].uri.fsPath : '';
	}

	private getClient(): BackendHttpClient {
		const client = this.backendService.getHttpClient(); // Trigger watcher refresh
		if (!client) {
			throw new Error('Backend not connected');
		}
		return client;
	}

	async createConversation(options?: ConversationOptions): Promise<IConversation> {
		await this.backendService.ensureConnected(this.getWorkspaceDirectory());
		const client = this.getClient();
		const directory = this.getWorkspaceDirectory();

		const session = await client.createSession({
			directory,
			title: options?.title
		});

		const conversation: IConversation = {
			id: session.id,
			title: session.title || options?.title || 'New Conversation',
			mode: options?.mode || 'coding',
			messages: [],
			createdAt: session.time || Date.now(),
			updatedAt: Date.now(),
			workspacePath: options?.workspacePath || directory,
			metadata: {
				totalTokens: 0,
				fileReferences: []
			}
		};

		this.conversations.set(conversation.id, conversation);
		this.sessionMessages.set(conversation.id, []);
		this.currentSessionId = conversation.id;
		this._onConversationUpdated.fire(conversation);
		this._onSessionChanged.fire(conversation.id);

		return conversation;
	}

	getConversation(id: string): IConversation | undefined {
		return this.conversations.get(id);
	}

	getAllConversations(): IConversation[] {
		return Array.from(this.conversations.values());
	}

	getCurrentSessionId(): string | undefined {
		return this.currentSessionId;
	}

	getMessages(conversationId: string): ChatMessage[] {
		return this.sessionMessages.get(conversationId) ?? [];
	}

	async loadSessionHistory(): Promise<SessionInfo[]> {
		await this.backendService.ensureConnected(this.getWorkspaceDirectory());
		const client = this.getClient();
		return client.listSessions(this.getWorkspaceDirectory());
	}

	async deleteConversation(id: string): Promise<void> {
		const client = this.getClient();
		await client.deleteSession(id, this.getWorkspaceDirectory());
		this.conversations.delete(id);
		this.sessionMessages.delete(id);
		if (this.currentSessionId === id) {
			this.currentSessionId = undefined;
			this._onSessionChanged.fire(undefined);
		}
	}

	async loadSessionMessages(sessionId: string): Promise<ChatMessage[]> {
		const client = this.getClient();
		const messages = await client.getSessionMessages(sessionId, this.getWorkspaceDirectory());
		const chatMessages = messages.map(toChatMessage);
		this.sessionMessages.set(sessionId, chatMessages);
		return chatMessages;
	}

	async switchToSession(sessionId: string): Promise<void> {
		this.currentSessionId = sessionId;
		if (!this.sessionMessages.has(sessionId)) {
			await this.loadSessionMessages(sessionId);
		}
		this._onSessionChanged.fire(sessionId);
	}

	// --- Message sending -------------------------------------------------------

	async sendMessage(conversationId: string, content: string): Promise<void> {
		await this.backendService.ensureConnected(this.getWorkspaceDirectory());
		const client = this.getClient();
		const directory = this.getWorkspaceDirectory();

		// Gather editor context (current file, selection) to enrich the prompt.
		// The CLI backend also receives the workspace directory, but attaching
		// explicit context lets the model see the active file without a tool call.
		const contextParts = await this.gatherContextParts();

		// Add user message to local state immediately
		const userMessage: ChatMessage = {
			id: `user-${Date.now()}`,
			role: 'user',
			parts: [{ kind: 'text', id: `text-${Date.now()}`, text: content }],
			time: Date.now(),
			isStreaming: false
		};
		let messages = this.sessionMessages.get(conversationId);
		if (!messages) {
			messages = [];
			this.sessionMessages.set(conversationId, messages);
		}
		messages.push(userMessage);

		// Fire the simple IMessage event for interface compliance
		const imessage: IMessage = {
			id: userMessage.id,
			role: 'user',
			content,
			timestamp: Date.now()
		};
		this._onMessageReceived.fire({ conversationId, message: imessage });

		// Create a placeholder assistant message for streaming
		const assistantMessage: ChatMessage = {
			id: `assistant-${Date.now()}`,
			role: 'assistant',
			parts: [],
			time: Date.now(),
			isStreaming: true
		};
		messages.push(assistantMessage);
		this.streamingMessages.set(assistantMessage.id, assistantMessage);

		// Set up abort token
		this.abortTokenSource = new CancellationTokenSource();

		// Send to backend (the response comes via SSE)
		try {
			await client.sendMessage(conversationId, {
				directory,
				prompt: content,
				parts: [
					{ type: 'text', text: content },
					...contextParts
				]
			}, this.abortTokenSource.token);
		} catch (error) {
			// Mark the assistant message as errored
			const errorMsg = error instanceof Error ? error.message : String(error);
			const errored: ChatMessage = { ...assistantMessage, isStreaming: false, error: errorMsg };
			this.streamingMessages.delete(assistantMessage.id);
			const idx = messages.indexOf(assistantMessage);
			if (idx >= 0) { messages[idx] = errored; }
			this._onChatMessageUpdated.fire({ conversationId, message: errored });
			throw error;
		}
	}

	async *streamMessage(conversationId: string, content: string): AsyncIterable<IMessageChunk> {
		await this.sendMessage(conversationId, content);
		// The actual streaming happens via SSE events; this generator yields
		// a final chunk for interface compliance. UI should use onMessageStreaming.
		yield { content: '', done: true, messageId: `assistant-${Date.now()}` };
	}

	/**
	 * Gather editor context (current file, open files, recent edits) and
	 * format it as backend message parts. The CLI backend uses these to
	 * give the model awareness of the user's active workspace state.
	 */
	private async gatherContextParts(): Promise<Array<{ type: 'text'; text: string } | { type: 'file'; path: string }>> {
		const parts: Array<{ type: 'text'; text: string } | { type: 'file'; path: string }> = [];
		try {
			const context = await this.contextManager.gatherContext({
				includeOpenFiles: true,
				includeRecentEdits: false,
				includeProjectStructure: false
			});

			if (context.currentFile) {
				parts.push({
					type: 'text',
					text: `Current file: ${context.currentFile.path}\n\n\`\`\`${context.currentFile.language || ''}\n${context.currentFile.content}\n\`\`\``
				});
			}

			if (context.openFiles && context.openFiles.length > 0) {
				const openFilesText = context.openFiles
					.map(f => `Open file: ${f.path}`)
					.join('\n');
				parts.push({ type: 'text', text: openFilesText });
			}
		} catch {
			// Context gathering is best-effort; don't fail the message send.
		}
		return parts;
	}

	async abortCurrentStream(): Promise<void> {
		if (this.abortTokenSource) {
			this.abortTokenSource.cancel();
			this.abortTokenSource = null;
		}
		if (this.currentSessionId) {
			const client = this.getClient();
			try {
				await client.abortSession(this.currentSessionId, this.getWorkspaceDirectory());
			} catch {
				// Ignore abort errors
			}
		}
	}

	async updateTitle(conversationId: string, title: string): Promise<void> {
		const client = this.getClient();
		await client.renameSession(conversationId, this.getWorkspaceDirectory(), title);
		const conversation = this.conversations.get(conversationId);
		if (conversation) {
			conversation.title = title;
			conversation.updatedAt = Date.now();
			this._onConversationUpdated.fire(conversation);
		}
	}

	exportConversation(id: string, format: 'json' | 'markdown'): string {
		const conversation = this.conversations.get(id);
		if (!conversation) {
			throw new Error(`Conversation ${id} not found`);
		}
		if (format === 'json') {
			return JSON.stringify(conversation, null, 2);
		}
		return conversation.messages.map(m => `## ${m.role}\n\n${m.content}`).join('\n\n');
	}

	async importConversation(data: string, format: 'json' | 'markdown'): Promise<IConversation> {
		if (format === 'json') {
			const parsed = JSON.parse(data) as IConversation;
			this.conversations.set(parsed.id, parsed);
			return parsed;
		}
		throw new Error('Markdown import not yet implemented');
	}

	async clearConversation(id: string): Promise<void> {
		this.sessionMessages.set(id, []);
		const conversation = this.conversations.get(id);
		if (conversation) {
			conversation.messages = [];
			conversation.updatedAt = Date.now();
			this._onConversationUpdated.fire(conversation);
		}
	}

	// --- Permission / question replies ----------------------------------------

	async replyPermission(permissionId: string, reply: 'allow' | 'deny'): Promise<void> {
		const pending = this.pendingPermissions.get(permissionId);
		if (!pending) { return; }
		const client = this.getClient();
		const body: PermissionReplyRequest = {
			id: permissionId,
			reply,
			sessionID: pending.request.sessionID,
			messageID: pending.request.messageID,
			partID: pending.request.partID
		};
		await client.replyPermission(body);
		this.pendingPermissions.delete(permissionId);
	}

	async answerQuestion(questionId: string, answers: string[]): Promise<void> {
		const pending = this.pendingQuestions.get(questionId);
		if (!pending) { return; }
		const client = this.getClient();
		const body: QuestionAnswerRequest = {
			id: questionId,
			answers,
			sessionID: pending.request.sessionID,
			messageID: pending.request.messageID,
			partID: pending.request.partID
		};
		await client.answerQuestion(body);
		this.pendingQuestions.delete(questionId);
	}

	// --- SSE event handling ----------------------------------------------------

	private subscribeToBackend(): void {
		if (this.sseSubscription) { return; }
		this.sseSubscription = this.backendService.subscribeToEvents(event => {
			this.handleSSEEvent(event.data as SSEEventPayload);
		});
	}

	private handleSSEEvent(payload: SSEEventPayload): void {
		const sessionId = payload.sessionID ?? this.currentSessionId;
		if (!sessionId) { return; }

		switch (payload.type) {
			case 'message.part.updated':
				this.handlePartUpdated(sessionId, payload);
				break;
			case 'message.part.removed':
				this.handlePartRemoved(sessionId, payload);
				break;
			case 'session.turn.close':
				this.handleTurnClosed(sessionId, payload);
				break;
			case 'permission.asked':
				this.handlePermissionAsked(sessionId, payload);
				break;
			case 'question.asked':
				this.handleQuestionAsked(sessionId, payload);
				break;
			case 'session.updated':
			case 'session.status':
				this.handleSessionUpdated(sessionId, payload);
				break;
			case 'session.error':
				this.handleSessionError(sessionId, payload);
				break;
		}
	}

	private handlePartUpdated(sessionId: string, payload: SSEEventPayload): void {
		const data = payload.data as { info?: { id?: string; type?: string; text?: string; [key: string]: unknown } };
		if (!data?.info) { return; }

		const messageId = payload.messageID;
		if (!messageId) { return; }

		const messages = this.sessionMessages.get(sessionId);
		if (!messages) { return; }

		// Find or create the streaming assistant message
		let message = this.streamingMessages.get(messageId);
		if (!message) {
			message = {
				id: messageId,
				role: 'assistant',
				parts: [],
				time: Date.now(),
				isStreaming: true
			};
			messages.push(message);
			this.streamingMessages.set(messageId, message);
		}

		const partInfo = data.info as { id: string; type: string; text?: string; [key: string]: unknown };
		const partId = partInfo.id;
		const existingIdx = message.parts.findIndex(p => p.id === partId);

		const uiPart = toUiPart(partInfo as never);
		if (existingIdx >= 0) {
			// Update existing part in place (streaming text accumulates)
			const updatedParts = [...message.parts];
			updatedParts[existingIdx] = uiPart;
			message = { ...message, parts: updatedParts };
		} else {
			message = { ...message, parts: [...message.parts, uiPart] };
		}

		// Update stored message
		const msgIdx = messages.findIndex(m => m.id === messageId);
		if (msgIdx >= 0) {
			messages[msgIdx] = message;
		}
		this.streamingMessages.set(messageId, message);

		// Fire streaming event for simple text accumulation
		if (uiPart.kind === 'text') {
			this._onMessageStreaming.fire({
				conversationId: sessionId,
				content: uiPart.text,
				messageId
			});
		}

		this._onChatMessageUpdated.fire({ conversationId: sessionId, message });
	}

	private handlePartRemoved(sessionId: string, payload: SSEEventPayload): void {
		const data = payload.data as { id?: string };
		const partId = data?.id;
		const messageId = payload.messageID;
		if (!partId || !messageId) { return; }

		const message = this.streamingMessages.get(messageId);
		if (!message) { return; }

		const updated = {
			...message,
			parts: message.parts.filter(p => p.id !== partId)
		};
		this.streamingMessages.set(messageId, updated);

		const messages = this.sessionMessages.get(sessionId);
		if (messages) {
			const idx = messages.findIndex(m => m.id === messageId);
			if (idx >= 0) {
				messages[idx] = updated;
				this._onChatMessageUpdated.fire({ conversationId: sessionId, message: updated });
			}
		}
	}

	private handleTurnClosed(sessionId: string, _payload: SSEEventPayload): void {
		// Mark all streaming messages for this session as complete
		const messages = this.sessionMessages.get(sessionId);
		if (messages) {
			for (const message of messages) {
				if (message.isStreaming) {
					const completed = { ...message, isStreaming: false };
					const idx = messages.indexOf(message);
					if (idx >= 0) {
						messages[idx] = completed;
						this.streamingMessages.delete(completed.id);
						this._onChatMessageUpdated.fire({ conversationId: sessionId, message: completed });
					}
				}
			}
		}
		this.abortTokenSource = null;
	}

	private handlePermissionAsked(sessionId: string, payload: SSEEventPayload): void {
		const data = payload.data as PermissionRequest;
		const pending: PendingPermission = { request: data, conversationId: sessionId };
		this.pendingPermissions.set(data.id, pending);
		this._onPermissionRequested.fire(pending);
	}

	private handleQuestionAsked(sessionId: string, payload: SSEEventPayload): void {
		const data = payload.data as QuestionRequest;
		const pending: PendingQuestion = { request: data, conversationId: sessionId };
		this.pendingQuestions.set(data.id, pending);
		this._onQuestionRequested.fire(pending);
	}

	private handleSessionUpdated(sessionId: string, _payload: SSEEventPayload): void {
		const conversation = this.conversations.get(sessionId);
		if (conversation) {
			conversation.updatedAt = Date.now();
			this._onConversationUpdated.fire(conversation);
		}
	}

	private handleSessionError(sessionId: string, payload: SSEEventPayload): void {
		const data = payload.data as { error?: string };
		const errorMsg = data?.error ?? 'Session error';
		const messages = this.sessionMessages.get(sessionId);
		if (messages) {
			const last = messages[messages.length - 1];
			if (last && last.isStreaming) {
				const errored = { ...last, isStreaming: false, error: errorMsg };
				messages[messages.length - 1] = errored;
				this.streamingMessages.delete(errored.id);
				this._onChatMessageUpdated.fire({ conversationId: sessionId, message: errored });
			}
		}
	}

	override dispose(): void {
		this.sseSubscription?.dispose();
		this.abortTokenSource?.dispose();
		super.dispose();
	}

	/** @internal used by tests */
	static _toChatMessage = toChatMessage;
}
