/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LLMProtocol, LLMRequest, Message, ContentPart, ToolChoice, GenerationOptions } from '../common/llmProtocol.js';
import { LLMEvent, TokenUsage, FinishReason, generateBlockId } from '../common/llmEvent.js';
import { applyCachePolicy } from '../common/promptCache.js';

/**
 * Protocol id for the OpenAI Chat Completions wire format. Used by OpenAI
 * (legacy models), xAI, and all OpenAI-compatible providers (DeepSeek,
 * TogetherAI, Cerebras, Groq, etc.).
 */
export const OPENAI_CHAT_PROTOCOL_ID = 'openai-chat';

interface ChatMessage {
	role: string;
	content: string | null;
	tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
	tool_call_id?: string;
	name?: string;
}

interface ChatRequestBody {
	model: string;
	messages: ChatMessage[];
	tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
	tool_choice?: string | { type: 'function'; function: { name: string } };
	temperature?: number;
	max_tokens?: number;
	top_p?: number;
	frequency_penalty?: number;
	presence_penalty?: number;
	seed?: number;
	stop?: string[];
	stream: true;
	stream_options?: { include_usage: boolean };
}

interface StreamChunk {
	id?: string;
	choices?: Array<{
		delta?: {
			content?: string | null;
			tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
		};
		finish_reason?: string | null;
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
		prompt_tokens_details?: { cached_tokens?: number };
	};
}

interface ChatProtocolState {
	toolCallBuffers: Map<number, { id: string; name: string; args: string }>;
	emittedToolCalls: Set<string>;
	usage?: TokenUsage;
	finishReason?: FinishReason;
}

/**
 * The OpenAI Chat Completions protocol. One protocol powers many providers:
 * OpenAI, xAI, DeepSeek, OpenRouter, and all OpenAI-compatible families.
 *
 * Port of `references/kilocode/packages/llm/src/protocols/openai-chat.ts` and
 * `openai-compatible-chat.ts`.
 */
export const openAIChatProtocol: LLMProtocol = {
	id: OPENAI_CHAT_PROTOCOL_ID,

	async buildBody(request: LLMRequest): Promise<ChatRequestBody> {
		const system = applyCachePolicy(request);
		const messages: ChatMessage[] = [];

		for (const part of system) {
			if (part.type === 'text' || part.type === 'cached') {
				messages.push({ role: 'system', content: part.text });
			}
		}

		for (const msg of request.messages) {
			messages.push(messageToChatMessage(msg));
		}

		const body: ChatRequestBody = {
			model: request.model.id,
			messages,
			stream: true,
			stream_options: { include_usage: true }
		};

		if (request.tools?.length) {
			body.tools = request.tools.map(t => ({
				type: 'function',
				function: { name: t.name, description: t.description, parameters: t.parameters }
			}));
		}

		if (request.toolChoice) {
			body.tool_choice = toolChoiceToString(request.toolChoice);
		}

		if (request.generation) {
			applyGeneration(body, request.generation);
		}

		return body;
	},

	initialState(): ChatProtocolState {
		return {
			toolCallBuffers: new Map(),
			emittedToolCalls: new Set(),
			usage: undefined,
			finishReason: undefined
		};
	},

	decodeFrame(state: ChatProtocolState, chunk: StreamChunk): { state: unknown; events: LLMEvent[] } {
		const events: LLMEvent[] = [];

		if (chunk.usage) {
			state.usage = {
				inputTokens: chunk.usage.prompt_tokens,
				outputTokens: chunk.usage.completion_tokens,
				totalTokens: chunk.usage.total_tokens,
				cacheReadInputTokens: chunk.usage.prompt_tokens_details?.cached_tokens
			};
		}

		if (!chunk.choices?.length) {
			return { state, events };
		}

		for (const choice of chunk.choices) {
			const delta = choice.delta;
			if (delta?.content) {
				events.push({ type: 'text-delta', id: 'text-main', text: delta.content });
			}

			if (delta?.tool_calls) {
				for (const tc of delta.tool_calls) {
					let buf = state.toolCallBuffers.get(tc.index);
					if (!buf) {
						buf = { id: tc.id ?? generateBlockId(), name: '', args: '' };
						state.toolCallBuffers.set(tc.index, buf);
					}
					if (tc.id && buf.id === tc.id) { buf.id = tc.id; }
					if (tc.function?.name) { buf.name += tc.function.name; }
					if (tc.function?.arguments) { buf.args += tc.function.arguments; }
					if (tc.id || tc.function?.name) {
						events.push({ type: 'tool-input-delta', id: buf.id, name: buf.name, text: tc.function?.arguments ?? '' });
					}
				}
			}

			if (choice.finish_reason) {
				state.finishReason = mapFinishReason(choice.finish_reason);
				// Emit accumulated tool calls.
				for (const [, buf] of state.toolCallBuffers) {
					if (!state.emittedToolCalls.has(buf.id)) {
						state.emittedToolCalls.add(buf.id);
						let parsedInput: unknown = buf.args;
						try { parsedInput = buf.args ? JSON.parse(buf.args) : {}; } catch { /* keep raw */ }
						events.push({ type: 'tool-call', id: buf.id, name: buf.name, input: parsedInput });
					}
				}
			}
		}

		return { state, events };
	},

	finalize(state: ChatProtocolState): LLMEvent[] {
		const events: LLMEvent[] = [];
		// Emit any tool calls that weren't flushed by a finish_reason.
		for (const [, buf] of state.toolCallBuffers) {
			if (!state.emittedToolCalls.has(buf.id)) {
				state.emittedToolCalls.add(buf.id);
				let parsedInput: unknown = buf.args;
				try { parsedInput = buf.args ? JSON.parse(buf.args) : {}; } catch { /* keep raw */ }
				events.push({ type: 'tool-call', id: buf.id, name: buf.name, input: parsedInput });
			}
		}
		events.push({
			type: 'finish',
			reason: state.finishReason ?? 'stop',
			usage: state.usage
		});
		return events;
	}
};

function messageToChatMessage(msg: Message): ChatMessage {
	if (typeof msg.content === 'string') {
		return { role: msg.role, content: msg.content };
	}

	// Structured content: separate text from tool calls/results.
	const parts = msg.content;
	let text = '';
	const toolCalls: NonNullable<ChatMessage['tool_calls']> = [];

	for (const part of parts) {
		switch (part.type) {
			case 'text': text += part.text; break;
			case 'tool-call': toolCalls.push({
				id: part.id,
				type: 'function',
				function: { name: part.name, arguments: JSON.stringify(part.input) }
			}); break;
			case 'tool-result':
				break;
			case 'image': text += `[image: ${part.mediaType}]`; break;
			case 'reasoning': break; // OpenAI Chat doesn't surface reasoning as content
		}
	}

	if (msg.role === 'tool') {
		const resultPart = parts.find((p): p is Extract<ContentPart, { type: 'tool-result' }> => p.type === 'tool-result');
		return {
			role: 'tool',
			content: resultPart ? safeStringify(resultPart.output) : text,
			tool_call_id: resultPart?.id
		};
	}

	const chatMsg: ChatMessage = {
		role: msg.role,
		content: text || null
	};
	if (toolCalls.length) { chatMsg.tool_calls = toolCalls; }
	return chatMsg;
}

function safeStringify(value: unknown): string {
	if (typeof value === 'string') { return value; }
	try { return JSON.stringify(value); } catch { return String(value); }
}

function toolChoiceToString(choice: ToolChoice): string | { type: 'function'; function: { name: string } } {
	switch (choice.type) {
		case 'auto': return 'auto';
		case 'none': return 'none';
		case 'required': return 'required';
		case 'tool': return { type: 'function', function: { name: choice.name } };
	}
}

function applyGeneration(body: ChatRequestBody, gen: GenerationOptions): void {
	if (gen.temperature !== undefined) { body.temperature = gen.temperature; }
	if (gen.maxTokens !== undefined) { body.max_tokens = gen.maxTokens; }
	if (gen.topP !== undefined) { body.top_p = gen.topP; }
	if (gen.frequencyPenalty !== undefined) { body.frequency_penalty = gen.frequencyPenalty; }
	if (gen.presencePenalty !== undefined) { body.presence_penalty = gen.presencePenalty; }
	if (gen.seed !== undefined) { body.seed = gen.seed; }
	if (gen.stop) { body.stop = gen.stop; }
}

function mapFinishReason(reason: string): FinishReason {
	switch (reason) {
		case 'stop': return 'stop';
		case 'length': return 'length';
		case 'tool_calls': case 'function_call': return 'tool-calls';
		case 'content_filter': return 'content-filter';
		default: return 'other';
	}
}
