/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LLMProtocol, LLMRequest, Message, ContentPart } from '../common/llmProtocol.js';
import { LLMEvent, TokenUsage, FinishReason, generateBlockId } from '../common/llmEvent.js';
import { applyCachePolicy } from '../common/promptCache.js';

/**
 * Protocol id for the OpenAI Responses API. Used by GPT-5+ models and xAI.
 * The Responses API uses a different event taxonomy ("response.output_text.delta",
 * "response.function_call_arguments.delta", etc.) than Chat Completions.
 */
export const OPENAI_RESPONSES_PROTOCOL_ID = 'openai-responses';

interface ResponsesInputItem {
	type: string;
	role?: string;
	content?: Array<{ type: string; text?: string }>;
	id?: string;
	call_id?: string;
	name?: string;
	arguments?: string;
	output?: string;
	status?: string;
}

interface ResponsesRequestBody {
	model: string;
	input: ResponsesInputItem[];
	instructions?: string;
	tools?: Array<{ type: 'function'; name: string; description: string; parameters: Record<string, unknown> }>;
	tool_choice?: string;
	temperature?: number;
	max_output_tokens?: number;
	top_p?: number;
	stream: true;
}

interface ResponsesStreamEvent {
	type: string;
	item?: {
		id?: string;
		type?: string;
		name?: string;
		arguments?: string;
		call_id?: string;
	};
	delta?: string;
	response?: {
		usage?: {
			input_tokens?: number;
			output_tokens?: number;
			total_tokens?: number;
			input_tokens_details?: { cached_tokens?: number };
		};
	};
	status?: string;
}

interface ResponsesProtocolState {
	toolCallBuffers: Map<string, { id: string; name: string; args: string }>;
	emittedToolCalls: Set<string>;
	usage?: TokenUsage;
	finishReason?: FinishReason;
}

/**
 * The OpenAI Responses API protocol. Handles the newer event stream format
 * used by GPT-5+ models.
 *
 * Port of `references/kilocode/packages/llm/src/protocols/openai-responses.ts`.
 */
export const openAIResponsesProtocol: LLMProtocol = {
	id: OPENAI_RESPONSES_PROTOCOL_ID,

	async buildBody(request: LLMRequest): Promise<ResponsesRequestBody> {
		const system = applyCachePolicy(request);
		const instructions = system.map(p => p.type === 'text' || p.type === 'cached' ? p.text : '').join('\n\n');

		const input: ResponsesInputItem[] = [];
		for (const msg of request.messages) {
			input.push(...messageToInputItems(msg));
		}

		const body: ResponsesRequestBody = {
			model: request.model.id,
			input,
			stream: true
		};

		if (instructions) { body.instructions = instructions; }

		if (request.tools?.length) {
			body.tools = request.tools.map(t => ({
				type: 'function',
				name: t.name,
				description: t.description,
				parameters: t.parameters
			}));
		}

		if (request.toolChoice) {
			body.tool_choice = request.toolChoice.type === 'tool' ? request.toolChoice.name : request.toolChoice.type;
		}

		if (request.generation) {
			if (request.generation.temperature !== undefined) { body.temperature = request.generation.temperature; }
			if (request.generation.maxTokens !== undefined) { body.max_output_tokens = request.generation.maxTokens; }
			if (request.generation.topP !== undefined) { body.top_p = request.generation.topP; }
		}

		return body;
	},

	initialState(): ResponsesProtocolState {
		return {
			toolCallBuffers: new Map(),
			emittedToolCalls: new Set(),
			usage: undefined,
			finishReason: undefined
		};
	},

	decodeFrame(state: ResponsesProtocolState, event: ResponsesStreamEvent): { state: unknown; events: LLMEvent[] } {
		const events: LLMEvent[] = [];

		switch (event.type) {
			case 'response.output_text.delta':
				if (event.delta) {
					events.push({ type: 'text-delta', id: 'text-main', text: event.delta });
				}
				break;

			case 'response.function_call_arguments.delta':
				if (event.item?.id && event.delta) {
					let buf = state.toolCallBuffers.get(event.item.id);
					if (!buf) {
						buf = { id: event.item.call_id ?? event.item.id ?? generateBlockId(), name: event.item.name ?? '', args: '' };
						state.toolCallBuffers.set(event.item.id, buf);
					}
					buf.args += event.delta;
				}
				break;

			case 'response.output_item.added':
				if (event.item?.type === 'function_call' && event.item.id) {
					state.toolCallBuffers.set(event.item.id, {
						id: event.item.call_id ?? event.item.id,
						name: event.item.name ?? '',
						args: event.item.arguments ?? ''
					});
				}
				break;

			case 'response.completed':
				if (event.response?.usage) {
					state.usage = {
						inputTokens: event.response.usage.input_tokens,
						outputTokens: event.response.usage.output_tokens,
						totalTokens: event.response.usage.total_tokens,
						cacheReadInputTokens: event.response.usage.input_tokens_details?.cached_tokens
					};
				}
				state.finishReason = 'stop';
				break;

			case 'response.failed':
				state.finishReason = 'error';
				events.push({ type: 'provider-error', message: 'Responses API request failed', retryable: true });
				break;
		}

		return { state, events };
	},

	finalize(state: ResponsesProtocolState): LLMEvent[] {
		const events: LLMEvent[] = [];
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

function messageToInputItems(msg: Message): ResponsesInputItem[] {
	if (typeof msg.content === 'string') {
		return [{
			type: 'message',
			role: msg.role,
			content: [{ type: 'output_text', text: msg.content }]
		}];
	}

	const items: ResponsesInputItem[] = [];
	const parts = msg.content;
	const textParts = parts.filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text');

	if (textParts.length > 0 && msg.role !== 'tool') {
		items.push({
			type: 'message',
			role: msg.role,
			content: textParts.map(p => ({ type: 'output_text', text: p.text }))
		});
	}

	for (const part of parts) {
		if (part.type === 'tool-call') {
			items.push({
				type: 'function_call',
				id: part.id,
				call_id: part.id,
				name: part.name,
				arguments: JSON.stringify(part.input)
			});
		} else if (part.type === 'tool-result') {
			items.push({
				type: 'function_call_output',
				call_id: part.id,
				output: safeStringify(part.output)
			});
		}
	}

	return items;
}

function safeStringify(value: unknown): string {
	if (typeof value === 'string') { return value; }
	try { return JSON.stringify(value); } catch { return String(value); }
}
