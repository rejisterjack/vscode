/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LLMProtocol, LLMRequest, Message, ToolChoice } from '../common/llmProtocol.js';
import { LLMEvent, TokenUsage, FinishReason, generateBlockId } from '../common/llmEvent.js';
import { applyCachePolicy } from '../common/promptCache.js';

/**
 * Protocol id for the Anthropic Messages API.
 */
export const ANTHROPIC_MESSAGES_PROTOCOL_ID = 'anthropic-messages';

interface AnthropicContent {
	type: string;
	text?: string;
	id?: string;
	name?: string;
	input?: unknown;
	tool_use_id?: string;
	content?: unknown;
	source?: { type: string; media_type: string; data: string };
	citation?: unknown;
}

interface AnthropicMessage {
	role: 'user' | 'assistant';
	content: AnthropicContent[];
}

interface AnthropicRequestBody {
	model: string;
	system?: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
	messages: AnthropicMessage[];
	tools?: Array<{
		name: string;
		description: string;
		input_schema: Record<string, unknown>;
		cache_control?: { type: 'ephemeral' };
	}>;
	tool_choice?: { type: string; name?: string };
	max_tokens: number;
	temperature?: number;
	top_p?: number;
	top_k?: number;
	stop_sequences?: string[];
	stream: true;
}

interface AnthropicStreamEvent {
	type: string;
	index?: number;
	content_block?: AnthropicContent;
	delta?: { type: string; text?: string; partial_json?: string; stop_reason?: string };
	message?: {
		id?: string;
		model?: string;
		usage?: {
			input_tokens?: number;
			output_tokens?: number;
			cache_creation_input_tokens?: number;
			cache_read_input_tokens?: number;
		};
	};
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
	};
}

interface AnthropicProtocolState {
	textBlockId: string | undefined;
	reasoningBlockId: string | undefined;
	toolCallBuffers: Map<number, { id: string; name: string; args: string }>;
	emittedToolCalls: Set<string>;
	usage?: TokenUsage;
	finishReason?: FinishReason;
}

/**
 * The Anthropic Messages API protocol. Handles text, reasoning (extended
 * thinking), and tool-use content blocks. Also supports prompt caching via
 * `cache_control` markers and the Anthropic beta headers.
 *
 * Port of `references/kilocode/packages/llm/src/protocols/anthropic-messages.ts:742-763`.
 */
export const anthropicMessagesProtocol: LLMProtocol = {
	id: ANTHROPIC_MESSAGES_PROTOCOL_ID,

	async buildBody(request: LLMRequest): Promise<AnthropicRequestBody> {
		const system = applyCachePolicy(request);
		const systemParts = system
			.filter((p): p is Extract<typeof system[number], { type: 'text' }> => p.type === 'text')
			.map(p => ({
				type: 'text' as const,
				text: p.text,
				...(p.cache ? { cache_control: { type: 'ephemeral' as const } } : {})
			}));

		const body: AnthropicRequestBody = {
			model: request.model.id,
			messages: request.messages.map(messageToAnthropicMessage),
			max_tokens: request.generation?.maxTokens ?? 8192,
			stream: true
		};

		if (systemParts.length) { body.system = systemParts; }

		const tools = request.tools;
		if (tools?.length) {
			body.tools = tools.map((t, i) => ({
				name: t.name,
				description: t.description,
				input_schema: t.parameters,
				// Cache the last tool definition to enable prompt caching.
				...(i === tools.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {})
			}));
		}

		if (request.toolChoice) {
			body.tool_choice = toolChoiceToAnthropic(request.toolChoice);
		}

		if (request.generation) {
			if (request.generation.temperature !== undefined) { body.temperature = request.generation.temperature; }
			if (request.generation.topP !== undefined) { body.top_p = request.generation.topP; }
			if (request.generation.topK !== undefined) { body.top_k = request.generation.topK; }
			if (request.generation.stop) { body.stop_sequences = request.generation.stop; }
		}

		return body;
	},

	initialState(): AnthropicProtocolState {
		return {
			textBlockId: undefined,
			reasoningBlockId: undefined,
			toolCallBuffers: new Map(),
			emittedToolCalls: new Set(),
			usage: undefined,
			finishReason: undefined
		};
	},

	decodeFrame(state: AnthropicProtocolState, event: AnthropicStreamEvent): { state: unknown; events: LLMEvent[] } {
		const events: LLMEvent[] = [];

		switch (event.type) {
			case 'content_block_start': {
				const block = event.content_block;
				if (!block) { break; }
				const index = event.index ?? 0;
				if (block.type === 'text') {
					state.textBlockId = block.id ?? `text-${index}`;
					events.push({ type: 'text-start', id: state.textBlockId });
				} else if (block.type === 'thinking') {
					state.reasoningBlockId = block.id ?? `reasoning-${index}`;
					events.push({ type: 'reasoning-start', id: state.reasoningBlockId });
				} else if (block.type === 'tool_use') {
					const id = block.id ?? generateBlockId();
					state.toolCallBuffers.set(index, { id, name: block.name ?? '', args: '' });
					events.push({ type: 'tool-input-start', id, name: block.name ?? '' });
				}
				break;
			}

			case 'content_block_delta': {
				const delta = event.delta;
				if (!delta) { break; }
				if (delta.type === 'text_delta' && state.textBlockId && delta.text) {
					events.push({ type: 'text-delta', id: state.textBlockId, text: delta.text });
				} else if (delta.type === 'thinking_delta' && state.reasoningBlockId && delta.text) {
					events.push({ type: 'reasoning-delta', id: state.reasoningBlockId, text: delta.text });
				} else if (delta.type === 'input_json_delta') {
					const index = event.index ?? 0;
					const buf = state.toolCallBuffers.get(index);
					if (buf && delta.partial_json) {
						buf.args += delta.partial_json;
						events.push({ type: 'tool-input-delta', id: buf.id, name: buf.name, text: delta.partial_json });
					}
				}
				break;
			}

			case 'content_block_stop': {
				const index = event.index ?? 0;
				if (state.textBlockId) {
					events.push({ type: 'text-end', id: state.textBlockId });
					state.textBlockId = undefined;
				} else if (state.reasoningBlockId) {
					events.push({ type: 'reasoning-end', id: state.reasoningBlockId });
					state.reasoningBlockId = undefined;
				} else {
					const buf = state.toolCallBuffers.get(index);
					if (buf) {
						events.push({ type: 'tool-input-end', id: buf.id, name: buf.name });
						if (!state.emittedToolCalls.has(buf.id)) {
							state.emittedToolCalls.add(buf.id);
							let parsedInput: unknown = buf.args;
							try { parsedInput = buf.args ? JSON.parse(buf.args) : {}; } catch { /* keep raw */ }
							events.push({ type: 'tool-call', id: buf.id, name: buf.name, input: parsedInput });
						}
					}
				}
				break;
			}

			case 'message_delta': {
				if (event.delta?.stop_reason) {
					state.finishReason = mapAnthropicFinishReason(event.delta.stop_reason);
				}
				if (event.usage) {
					state.usage = {
						...state.usage,
						outputTokens: event.usage.output_tokens
					};
				}
				break;
			}

			case 'message_start': {
				if (event.message?.usage) {
					state.usage = {
						inputTokens: event.message.usage.input_tokens,
						outputTokens: event.message.usage.output_tokens,
						cacheWriteInputTokens: event.message.usage.cache_creation_input_tokens,
						cacheReadInputTokens: event.message.usage.cache_read_input_tokens
					};
				}
				break;
			}
		}

		return { state, events };
	},

	finalize(state: AnthropicProtocolState): LLMEvent[] {
		// Anthropic normalizes inclusive input tokens: input_tokens is non-cached only.
		if (state.usage) {
			const nonCached = state.usage.inputTokens ?? 0;
			const cacheRead = state.usage.cacheReadInputTokens ?? 0;
			const cacheWrite = state.usage.cacheWriteInputTokens ?? 0;
			state.usage.nonCachedInputTokens = nonCached;
			state.usage.inputTokens = nonCached + cacheRead + cacheWrite;
		}
		return [{
			type: 'finish',
			reason: state.finishReason ?? 'stop',
			usage: state.usage
		}];
	}
};

function messageToAnthropicMessage(msg: Message): AnthropicMessage {
	const content: AnthropicContent[] = [];

	if (typeof msg.content === 'string') {
		content.push({ type: 'text', text: msg.content });
	} else {
		for (const part of msg.content) {
			switch (part.type) {
				case 'text':
					content.push({ type: 'text', text: part.text });
					break;
				case 'tool-call':
					content.push({ type: 'tool_use', id: part.id, name: part.name, input: part.input });
					break;
				case 'tool-result':
					content.push({
						type: 'tool_result',
						tool_use_id: part.id,
						content: typeof part.output === 'string' ? part.output : safeStringify(part.output),
						...(part.error ? { is_error: true } : {})
					});
					break;
				case 'image':
					content.push({
						type: 'image',
						source: { type: 'base64', media_type: part.mediaType, data: part.data }
					});
					break;
				case 'reasoning':
					content.push({ type: 'thinking', text: part.text });
					break;
			}
		}
	}

	return { role: msg.role === 'assistant' ? 'assistant' : 'user', content };
}

function toolChoiceToAnthropic(choice: ToolChoice): { type: string; name?: string } {
	switch (choice.type) {
		case 'auto': return { type: 'auto' };
		case 'none': return { type: 'none' };
		case 'required': return { type: 'any' };
		case 'tool': return { type: 'tool', name: choice.name };
	}
}

function safeStringify(value: unknown): string {
	if (typeof value === 'string') { return value; }
	try { return JSON.stringify(value); } catch { return String(value); }
}

function mapAnthropicFinishReason(reason: string): FinishReason {
	switch (reason) {
		case 'end_turn': return 'stop';
		case 'max_tokens': return 'length';
		case 'tool_use': return 'tool-calls';
		case 'stop_sequence': return 'stop';
		default: return 'other';
	}
}
