/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IAIService, IProviderRegistry } from '../../../../ai/common/types/provider.types.js';
import { AIMode } from '../../../../ai/common/types/ai.types.js';
import { IAgentLoop, AgentEvent } from '../../../../ai/agent/agentLoop.js';
import { AIModeDefinition, IModeRegistry } from '../../../../ai/mode/modeRegistry.js';
import { Message, ModelRef, SystemPart } from '../../../../ai/provider/common/llmProtocol.js';
import { IToolEnabledProvider } from '../../../../ai/provider/common/protocolBackedProvider.js';
import { IToolRegistry } from '../../../../ai/tool/toolRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILanguageModelsService } from '../../chat/common/languageModels.js';
import { asToolEnabledProvider, parseFewStepsAwayModelId } from './fewStepsAwayLanguageModelProvider.js';
import { ChatMessage, ChatMessagePart } from '../../../../ai/chat/chatModels.js';
import { IConversation, ConversationOptions } from '../../../../ai/common/types/conversation.types.js';
import { localize } from '../../../../nls.js';

export interface ChatSessionInfo {
	readonly id: string;
	readonly title: string;
	readonly time: number;
}

/**
 * In-process chat session manager backed by the native agent loop.
 */
export class NativeChatController extends Disposable {

	private readonly conversations = new Map<string, IConversation>();
	private readonly sessionMessages = new Map<string, ChatMessage[]>();
	private currentSessionId: string | undefined;
	private abortCts: CancellationTokenSource | undefined;

	private readonly _onSessionChanged = this._register(new Emitter<string | undefined>());
	readonly onSessionChanged = this._onSessionChanged.event;

	private readonly _onConversationUpdated = this._register(new Emitter<IConversation>());
	readonly onConversationUpdated = this._onConversationUpdated.event;

	private readonly _onChatMessageUpdated = this._register(new Emitter<{ conversationId: string; message: ChatMessage }>());
	readonly onChatMessageUpdated = this._onChatMessageUpdated.event;

	constructor(
		@IAIService _aiService: IAIService,
		@IAgentLoop private readonly agentLoop: IAgentLoop,
		@IModeRegistry private readonly modeRegistry: IModeRegistry,
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry,
		@IToolRegistry private readonly toolRegistry: IToolRegistry,
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();
	}

	getCurrentSessionId(): string | undefined {
		return this.currentSessionId;
	}

	getConversation(id: string): IConversation | undefined {
		return this.conversations.get(id);
	}

	getMessages(sessionId: string): ChatMessage[] {
		return this.sessionMessages.get(sessionId) ?? [];
	}

	async createConversation(options?: ConversationOptions): Promise<IConversation> {
		const id = generateUuid();
		const conversation: IConversation = {
			id,
			title: options?.title ?? localize('fewstepsaway.chat.newConversation', "New Conversation"),
			mode: options?.mode ?? 'coding',
			messages: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
			metadata: { totalTokens: 0, fileReferences: [] },
		};
		this.conversations.set(id, conversation);
		this.sessionMessages.set(id, []);
		this.currentSessionId = id;
		this._onConversationUpdated.fire(conversation);
		this._onSessionChanged.fire(id);
		return conversation;
	}

	async loadSessionHistory(): Promise<ChatSessionInfo[]> {
		return Array.from(this.conversations.values())
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.map(c => ({ id: c.id, title: c.title, time: Math.floor(c.updatedAt / 1000) }));
	}

	switchToSession(sessionId: string): void {
		if (this.conversations.has(sessionId)) {
			this.currentSessionId = sessionId;
			this._onSessionChanged.fire(sessionId);
		}
	}

	async sendMessage(sessionId: string, text: string): Promise<void> {
		const messages = this.sessionMessages.get(sessionId) ?? [];
		const userMsg: ChatMessage = {
			id: generateUuid(),
			role: 'user',
			parts: [{ kind: 'text', id: generateUuid(), text }],
			time: Date.now(),
			isStreaming: false,
		};
		messages.push(userMsg);
		this.sessionMessages.set(sessionId, messages);
		this._onChatMessageUpdated.fire({ conversationId: sessionId, message: userMsg });

		const assistantId = generateUuid();
		let assistant: ChatMessage = {
			id: assistantId,
			role: 'assistant',
			parts: [],
			time: Date.now(),
			isStreaming: true,
		};
		messages.push(assistant);
		this.updateAssistant(sessionId, assistant);

		const mode = this.resolveMode();
		const { provider, model } = this.resolveModel();
		const enabledTools = this.modeRegistry.getEnabledTools(mode.id, this.toolRegistry.getAllTools());
		const historyMessages = this.buildHistoryMessages(messages.slice(0, -1));
		const system: SystemPart[] = [{ type: 'text', text: mode.systemPrompt }];

		this.abortCts = new CancellationTokenSource();
		let textBuffer = '';
		const reasoningStart = Date.now();
		let reasoningMs = 0;

		try {
			for await (const event of this.agentLoop.run({
				provider,
				model,
				system,
				messages: historyMessages,
				tools: enabledTools,
				generation: { temperature: mode.temperature ?? 0.3 },
				sessionId,
				messageId: assistantId,
				abortSignal: this.abortCts.token,
			})) {
				assistant = this.applyAgentEvent(assistant, event, {
					getText: () => textBuffer,
					setText: t => { textBuffer = t; },
					getReasoningMs: () => reasoningMs,
					setReasoningMs: ms => { reasoningMs = ms; },
					reasoningStart,
				});
				this.updateAssistant(sessionId, assistant);
			}
		} catch (err) {
			assistant = {
				...assistant,
				isStreaming: false,
				error: err instanceof Error ? err.message : String(err),
			};
			this.updateAssistant(sessionId, assistant);
		} finally {
			this.abortCts = undefined;
			if (assistant.isStreaming) {
				assistant = { ...assistant, isStreaming: false };
				this.updateAssistant(sessionId, assistant);
			}
		}

		const conv = this.conversations.get(sessionId);
		if (conv && conv.title === localize('fewstepsaway.chat.newConversation', "New Conversation")) {
			const title = text.slice(0, 48) + (text.length > 48 ? '…' : '');
			this.conversations.set(sessionId, { ...conv, title, updatedAt: Date.now() });
			this._onConversationUpdated.fire(this.conversations.get(sessionId)!);
		}
	}

	async abortCurrentStream(): Promise<void> {
		this.abortCts?.cancel();
	}

	private updateAssistant(sessionId: string, message: ChatMessage): void {
		const messages = this.sessionMessages.get(sessionId) ?? [];
		const idx = messages.findIndex(m => m.id === message.id);
		if (idx >= 0) {
			messages[idx] = message;
		}
		this.sessionMessages.set(sessionId, messages);
		this._onChatMessageUpdated.fire({ conversationId: sessionId, message });
	}

	private applyAgentEvent(
		msg: ChatMessage,
		event: AgentEvent,
		ctx: {
			getText: () => string;
			setText: (t: string) => void;
			getReasoningMs: () => number;
			setReasoningMs: (ms: number) => void;
			reasoningStart: number;
		}
	): ChatMessage {
		const parts = [...msg.parts];

		switch (event.type) {
			case 'step-start':
				parts.push({ kind: 'step-start', id: generateUuid() });
				break;
			case 'text-delta': {
				ctx.setText(ctx.getText() + event.text);
				this.upsertTextPart(parts, ctx.getText());
				break;
			}
			case 'reasoning-delta': {
				ctx.setReasoningMs(Date.now() - ctx.reasoningStart);
				this.upsertReasoningPart(parts, ctx.getReasoningMs(), event.text);
				break;
			}
			case 'tool-call':
				parts.push({
					kind: 'tool-call',
					id: event.id,
					tool: event.name,
					input: event.input,
					state: 'running',
					title: this.formatToolTitle(event.name, event.input),
				});
				break;
			case 'tool-result': {
				const idx = parts.findIndex(p => p.kind === 'tool-call' && p.id === event.id);
				if (idx >= 0) {
					const tc = parts[idx] as Extract<ChatMessagePart, { kind: 'tool-call' }>;
					parts[idx] = { ...tc, state: 'completed' };
				}
				parts.push({
					kind: 'tool-result',
					id: event.id,
					tool: event.name,
					output: event.result.output,
					title: event.result.title,
				});
				break;
			}
			case 'error':
				parts.push({ kind: 'error', id: generateUuid(), message: event.error });
				break;
			case 'finish':
			case 'step-finish':
				break;
		}

		return { ...msg, parts };
	}

	private upsertTextPart(parts: ChatMessagePart[], text: string): void {
		const idx = parts.findIndex(p => p.kind === 'text');
		if (idx >= 0) {
			parts[idx] = { ...(parts[idx] as Extract<ChatMessagePart, { kind: 'text' }>), text };
		} else {
			parts.push({ kind: 'text', id: generateUuid(), text });
		}
	}

	private upsertReasoningPart(parts: ChatMessagePart[], ms: number, _text: string): void {
		const metaId = '__reasoning__';
		const idx = parts.findIndex(p => p.kind === 'text' && p.id === metaId);
		const label = localize('fewstepsaway.chat.thoughtFor', "Thought for {0}s", Math.max(1, Math.round(ms / 1000)));
		if (idx >= 0) {
			parts[idx] = { kind: 'text', id: metaId, text: label };
		} else {
			parts.unshift({ kind: 'text', id: metaId, text: label });
		}
	}

	private formatToolTitle(name: string, input: unknown): string {
		const inp = input as Record<string, unknown> | undefined;
		switch (name) {
			case 'read': return localize('fewstepsaway.tool.read', "Read {0}", String(inp?.path ?? inp?.file ?? ''));
			case 'write': return localize('fewstepsaway.tool.write', "Write {0}", String(inp?.path ?? ''));
			case 'edit': return localize('fewstepsaway.tool.edit', "Edit {0}", String(inp?.path ?? ''));
			case 'glob': return localize('fewstepsaway.tool.glob', "Glob {0}", String(inp?.pattern ?? ''));
			case 'grep': return localize('fewstepsaway.tool.grep', "Grep {0}", String(inp?.pattern ?? ''));
			case 'bash': return localize('fewstepsaway.tool.bash', "Ran command");
			default: return name;
		}
	}

	private buildHistoryMessages(messages: ChatMessage[]): Message[] {
		const result: Message[] = [];
		for (const msg of messages) {
			if (msg.role === 'user') {
				const text = msg.parts.filter(p => p.kind === 'text').map(p => (p as { text: string }).text).join('\n');
				if (text) { result.push({ role: 'user', content: text }); }
			} else if (msg.role === 'assistant') {
				const text = msg.parts.filter(p => p.kind === 'text' && p.id !== '__reasoning__').map(p => (p as { text: string }).text).join('\n');
				if (text) { result.push({ role: 'assistant', content: text }); }
			}
		}
		return result;
	}

	private resolveMode(): AIModeDefinition {
		const configMode = this.configurationService.getValue<AIMode>('ai.chat.mode') ?? 'coding';
		return this.modeRegistry.getMode(configMode) ?? this.modeRegistry.getActiveMode()!;
	}

	private resolveModel(): { provider: IToolEnabledProvider; model: ModelRef } {
		const explicitModelId = this.configurationService.getValue<string>('ai.chat.model') ?? '';
		if (explicitModelId) {
			const parsed = parseFewStepsAwayModelId(explicitModelId);
			if (parsed) {
				const provider = asToolEnabledProvider(this.providerRegistry.getProvider(parsed.providerId));
				if (provider) {
					return { provider, model: { id: parsed.modelId } };
				}
			}
			const metadata = this.languageModelsService.lookupLanguageModel(explicitModelId);
			if (metadata) {
				const provider = asToolEnabledProvider(this.providerRegistry.getProvider(metadata.vendor));
				if (provider) {
					return { provider, model: { id: metadata.id } };
				}
			}
		}

		const defaultProviderId = this.configurationService.getValue<string>('ai.provider.default') ?? 'openai';
		const providerInstance = this.providerRegistry.getProvider(defaultProviderId)
			?? this.providerRegistry.getActiveProvider()
			?? this.providerRegistry.getAllProviders()[0];
		const provider = asToolEnabledProvider(providerInstance);
		if (!provider) {
			throw new Error('No AI provider configured');
		}
		const modelId = this.configurationService.getValue<string>(`ai.provider.${providerInstance!.id}.model`) ?? 'gpt-4o';
		return { provider, model: { id: modelId } };
	}
}
