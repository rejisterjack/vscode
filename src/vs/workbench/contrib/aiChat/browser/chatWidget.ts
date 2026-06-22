/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { throttle } from '../../../../base/common/decorators.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatService } from '../../../../ai/common/types/conversation.types.js';
import { IBackendService } from '../../../../ai/backend/backendService.js';
import { ChatService } from '../../../../ai/chat/chatService.js';
import { ChatMessageList } from './components/chatMessageList.js';
import { PromptInput } from './components/promptInput.js';
import { StartupErrorBanner } from './components/startupErrorBanner.js';
import { TaskHeader } from './components/taskHeader.js';
import { ChatDock } from './components/chatDock.js';
import { IAttentionService } from '../../../../ai/common/attentionService.js';
import { SessionHistory } from './sessionHistory.js';
import { humanizeConnectionError } from './connectionErrors.js';

/**
 * Main chat widget — polished vertical layout:
 *   error banner → task header → messages → dock → prompt input
 */
export class ChatWidget extends Disposable {
	private readonly container: HTMLElement;
	private readonly errorBanner: StartupErrorBanner;
	private readonly taskHeader: TaskHeader;
	private readonly messageList: ChatMessageList;
	private readonly chatDock: ChatDock;
	private readonly input: PromptInput;

	private currentSessionId: string | undefined;
	private isStreaming = false;

	private readonly subscriptions: IDisposable[] = [];

	constructor(
		parent: HTMLElement,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IChatService private readonly chatService: IChatService,
		@IBackendService private readonly backendService: IBackendService,
		@IAttentionService private readonly attentionService: IAttentionService
	) {
		super();

		this.container = append(parent, $('div.fewstepsaway-chat-container'));

		this.errorBanner = this._register(new StartupErrorBanner(this.container));
		this.taskHeader = this._register(new TaskHeader(this.container));
		this.messageList = this._register(this.instantiationService.createInstance(ChatMessageList, this.container));
		this.chatDock = this._register(new ChatDock(this.container));
		this.input = this._register(this.instantiationService.createInstance(PromptInput, this.container));

		const cs = this.chatService as ChatService;
		this.messageList.setSessionCallbacks(
			() => cs.loadSessionHistory(),
			sessionId => void cs.switchToSession(sessionId)
		);

		this.input.onSend(text => this.handleSend(text));
		this.input.onStop(() => this.handleStop());
		this.messageList.onSuggestion(text => this.input.setSuggestion(text));

		this.taskHeader.onNewChat(() => void this.handleNewChat());
		this.taskHeader.onHistory(() => void this.handleHistory());
		this.errorBanner.onRetry(() => void this.retryConnection());

		this.subscriptions.push(
			cs.onSessionChanged(sessionId => {
				this.currentSessionId = sessionId;
				this.refreshSessionHeader(sessionId);
				if (sessionId) {
					this.messageList.renderMessages(cs.getMessages(sessionId));
				} else {
					this.messageList.renderMessages([]);
				}
			}),
			cs.onChatMessageUpdated(e => {
				if (e.conversationId === this.currentSessionId) {
					this.throttledRender(e.conversationId);
					const wasStreaming = this.isStreaming;
					this.setStreaming(e.message.isStreaming);
					if (wasStreaming && !e.message.isStreaming) {
						this.attentionService.play(e.message.error ? 'nope' : 'yup');
					}
				}
			}),
			cs.onConversationUpdated(conversation => {
				if (conversation.id === this.currentSessionId) {
					this.taskHeader.setTitle(conversation.title);
					this.messageList.renderMessages(cs.getMessages(conversation.id));
				}
			}),
			cs.onPermissionRequested(pending => {
				this.chatDock.showPermission(pending.request, async response => {
					const reply = response === 'deny' ? 'deny' : 'allow';
					await cs.replyPermission(pending.request.id, reply);
					this.chatDock.hide();
				});
				this.attentionService.play('alert');
			}),
			cs.onQuestionRequested(pending => {
				this.chatDock.showQuestion(pending.request, async values => {
					await cs.answerQuestion(pending.request.id, values);
					this.chatDock.hide();
				});
			}),
			this.backendService.onDidChangeState(e => {
				this.updateConnectionState(e.state, e.error);
			})
		);

		this.messageList.renderMessages([]);
		this.updateConnectionState(this.backendService.state);
	}

	async show(): Promise<void> {
		await this.retryConnection();
	}

	focusInput(): void {
		this.input.focus();
	}

	private async retryConnection(): Promise<void> {
		this.taskHeader.setConnectionStatus('connecting');
		this.input.setStatus(localize('fewstepsaway.chat.connecting', "Connecting to AI backend…"), 'connecting');

		try {
			await this.backendService.ensureConnected();
			this.errorBanner.clear();
			this.input.clearStatus();
			this.input.setConnected(true);
			this.input.focus();

			const cs = this.chatService as ChatService;
			if (!cs.getCurrentSessionId()) {
				try {
					await cs.createConversation({ title: localize('fewstepsaway.chat.newConversation', "New Conversation") });
				} catch {
					this.messageList.renderMessages([]);
				}
			} else {
				this.refreshSessionHeader(cs.getCurrentSessionId());
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.errorBanner.setError(humanizeConnectionError(msg));
			this.input.setConnected(false);
			this.input.clearStatus();
			this.messageList.renderMessages([]);
		}
	}

	private refreshSessionHeader(sessionId: string | undefined): void {
		const cs = this.chatService as ChatService;
		if (!sessionId) {
			this.taskHeader.setTitle(localize('fewstepsaway.chat.newConversation', "New Conversation"));
			this.taskHeader.setMetadata([]);
			return;
		}
		const conversation = cs.getConversation(sessionId);
		this.taskHeader.setTitle(conversation?.title ?? localize('fewstepsaway.chat.newConversation', "New Conversation"));
		this.taskHeader.setMetadata(cs.getMessages(sessionId));
	}

	private async handleNewChat(): Promise<void> {
		const cs = this.chatService as ChatService;
		try {
			await cs.createConversation({ title: localize('fewstepsaway.chat.newConversation', "New Conversation") });
		} catch {
			this.messageList.renderMessages([]);
		}
		this.chatDock.hide();
		this.input.focus();
	}

	private async handleHistory(): Promise<void> {
		const sessionHistory = this.instantiationService.createInstance(SessionHistory);
		await sessionHistory.show();
	}

	private async handleSend(text: string): Promise<void> {
		if (!this.currentSessionId) {
			const cs = this.chatService as ChatService;
			try {
				await cs.createConversation();
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				this.errorBanner.setError(humanizeConnectionError(msg));
				return;
			}
			this.currentSessionId = cs.getCurrentSessionId();
		}

		if (!this.currentSessionId) {
			return;
		}

		this.input.clear();
		this.setStreaming(true);

		try {
			await this.chatService.sendMessage(this.currentSessionId, text);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.errorBanner.setError(humanizeConnectionError(msg));
			this.setStreaming(false);
		}
	}

	private async handleStop(): Promise<void> {
		const cs = this.chatService as ChatService;
		await cs.abortCurrentStream();
		this.setStreaming(false);
	}

	private setStreaming(streaming: boolean): void {
		if (this.isStreaming === streaming) { return; }
		this.isStreaming = streaming;
		this.input.setStreaming(streaming);
	}

	private updateConnectionState(state: string, error?: string): void {
		switch (state) {
			case 'connected':
				this.taskHeader.setConnectionStatus('connected');
				this.errorBanner.clear();
				this.input.clearStatus();
				this.input.setConnected(true);
				break;
			case 'connecting':
				this.taskHeader.setConnectionStatus('connecting');
				this.errorBanner.clear();
				this.input.setStatus(localize('fewstepsaway.chat.connecting', "Connecting to AI backend…"), 'connecting');
				this.input.setConnected(false);
				break;
			case 'disconnected':
				this.taskHeader.setConnectionStatus('disconnected');
				this.errorBanner.setError({
					friendly: localize('fewstepsaway.chat.disconnected', "Disconnected from the AI backend."),
				});
				this.input.clearStatus();
				this.input.setConnected(false);
				break;
			case 'error':
				this.taskHeader.setConnectionStatus('error');
				this.errorBanner.setError(humanizeConnectionError(error ?? 'Unknown'));
				this.input.clearStatus();
				this.input.setConnected(false);
				break;
		}
	}

	@throttle(16)
	protected throttledRender(sessionId: string): void {
		const cs = this.chatService as ChatService;
		this.messageList.renderMessages(cs.getMessages(sessionId));
		this.taskHeader.setMetadata(cs.getMessages(sessionId));
	}

	override dispose(): void {
		for (const sub of this.subscriptions) {
			sub.dispose();
		}
		super.dispose();
	}
}
