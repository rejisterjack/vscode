/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRequestService, isSuccess } from '../../../platform/request/common/request.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { streamToBuffer, VSBuffer } from '../../../base/common/buffer.js';
import { listenStream } from '../../../base/common/stream.js';
import { LLMEvent, TokenUsage, FinishReason } from './llmEvent.js';

/**
 * Roles for chat messages.
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * A single content part within a message.
 */
export type ContentPart =
	| { readonly type: 'text'; readonly text: string }
	| { readonly type: 'image'; readonly mediaType: string; readonly data: string } // base64-encoded
	| { readonly type: 'tool-call'; readonly id: string; readonly name: string; readonly input: unknown }
	| { readonly type: 'tool-result'; readonly id: string; readonly name: string; readonly output: unknown; readonly error?: string }
	| { readonly type: 'reasoning'; readonly text: string };

/**
 * A chat message in the common normalized format. All provider protocols
 * translate between this shape and their provider-native request body.
 */
export interface Message {
	readonly id?: string;
	readonly role: MessageRole;
	readonly content: string | readonly ContentPart[];
	readonly metadata?: Record<string, unknown>;
}

/**
 * Definition of a tool that the model can call. Translated to each provider's
 * native tool format by the protocol's `body.from()`.
 */
export interface ToolDefinition {
	readonly name: string;
	readonly description: string;
	readonly parameters: Record<string, unknown>; // JSON Schema
}

/**
 * How the model should choose tools.
 */
export type ToolChoice =
	| { readonly type: 'auto' }
	| { readonly type: 'none' }
	| { readonly type: 'required' }
	| { readonly type: 'tool'; readonly name: string };

/**
 * Generation parameters forwarded to the provider.
 */
export interface GenerationOptions {
	readonly maxTokens?: number;
	readonly temperature?: number;
	readonly topP?: number;
	readonly topK?: number;
	readonly frequencyPenalty?: number;
	readonly presencePenalty?: number;
	readonly seed?: number;
	readonly stop?: string[];
}

/**
 * Prompt-cache policy. `"auto"` lets the protocol place cache breakpoints at
 * the last tool definition, last system part, and the latest user message.
 */
export type CachePolicy =
	| 'auto'
	| 'none'
	| { readonly tools?: boolean; readonly system?: boolean; readonly messages?: boolean; readonly ttlSeconds?: number };

/**
 * The common LLM request shape. A protocol's `body.from()` translates this
 * into the provider-native request body.
 *
 * Port of `references/kilocode/packages/llm/src/schema/messages.ts:229-242`.
 */
export interface LLMRequest {
	readonly id?: string;
	readonly model: ModelRef;
	readonly system: readonly SystemPart[];
	readonly messages: readonly Message[];
	readonly tools?: readonly ToolDefinition[];
	readonly toolChoice?: ToolChoice;
	readonly generation?: GenerationOptions;
	readonly providerOptions?: Record<string, unknown>;
	readonly cache?: CachePolicy;
	readonly abortSignal?: CancellationToken;
}

/**
 * A reference to a model: just an id plus optional provider-scoped options.
 */
export interface ModelRef {
	readonly id: string;
	readonly options?: Record<string, unknown>;
}

/**
 * A part of the system prompt.
 */
export type SystemPart =
	| { readonly type: 'text'; readonly text: string; readonly cache?: boolean }
	| { readonly type: 'cached'; readonly text: string };

/**
 * A protocol owns: (a) how a common `LLMRequest` becomes a provider-native
 * body, and (b) how the provider's streaming response decodes into common
 * `LLMEvent`s. It does NOT know URLs, headers, or auth -- that is the
 * `ProviderRoute`'s job.
 *
 * Port of `references/kilocode/packages/llm/src/route/protocol.ts:36-63`.
 */
export interface LLMProtocol<Body = unknown, Frame = unknown> {
	/** Stable id for the wire protocol implementation (e.g. "anthropic-messages"). */
	readonly id: string;
	/**
	 * Build the provider-native body from a common `LLMRequest`.
	 */
	buildBody(request: LLMRequest): Promise<Body>;
	/**
	 * Decode a single raw transport frame (e.g. one SSE `data:` line, or one
	 * parsed JSON object) into zero or more common `LLMEvent`s. The protocol
	 * may keep state in the returned `state` value across calls.
	 *
	 * @param state The mutable state from the previous call (or `initialState()`).
	 * @param frame The raw decoded frame.
	 * @returns The updated state plus the events to emit.
	 */
	decodeFrame(state: unknown, frame: Frame): { state: unknown; events: LLMEvent[] };
	/** Initial parser state for a new response. */
	initialState(): unknown;
	/**
	 * Called once after the stream closes. Returns any final events (e.g.
	 * `finish`) derived from accumulated state.
	 */
	finalize(state: unknown): LLMEvent[];
}

/**
 * Authentication definition for a route. The route composes this with the
 * endpoint URL to produce the final headers.
 */
export type AuthDef =
	| { readonly kind: 'bearer'; readonly token: string }
	| { readonly kind: 'header'; readonly name: string; readonly value: string }
	| { readonly kind: 'none' };

/**
 * A route binds a protocol to a deployment: the endpoint URL, auth, and any
 * extra static headers. This is the port of Kilocode's `Route` interface
 * (`references/kilocode/packages/llm/src/route/client.ts:38-55`).
 *
 * One protocol can power many providers -- e.g. the OpenAI Chat protocol is
 * reused by 10+ OpenAI-compatible providers, each with a different route.
 */
export interface ProviderRoute {
	/** Stable id for this route (e.g. "anthropic", "openrouter"). */
	readonly id: string;
	/** The protocol this route uses. */
	readonly protocol: LLMProtocol;
	/** Full request URL (the protocol's `/messages` or `/chat/completions` path is already included). */
	readonly endpoint: string;
	/** Authentication to apply. */
	readonly auth: AuthDef;
	/** Extra static headers (e.g. `anthropic-version: 2023-06-01`). */
	readonly headers?: Record<string, string>;
}

/**
 * Aggregated result of running a stream to completion.
 */
export interface StreamResult {
	readonly events: LLMEvent[];
	readonly text: string;
	readonly reasoning: string;
	readonly usage?: TokenUsage;
	readonly finishReason?: FinishReason;
}

/**
 * Run a route's protocol against the given request, returning an
 * `AsyncIterable<LLMEvent>`. This is the universal entry point used by every
 * concrete provider facade. Uses VS Code's `IRequestService` + `listenStream`
 * for HTTP, matching the existing pattern in `kiloProvider.ts:98-175`.
 */
export async function* streamRoute(
	route: ProviderRoute,
	request: LLMRequest,
	requestService: IRequestService
): AsyncIterable<LLMEvent> {
	const body = await route.protocol.buildBody(request);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'Accept': 'text/event-stream',
		...route.headers
	};
	applyAuth(headers, route.auth);

	const requestContext = await requestService.request({
		type: 'POST',
		url: route.endpoint,
		headers,
		data: JSON.stringify(body)
	}, request.abortSignal ?? CancellationToken.None);

	if (!isSuccess(requestContext)) {
		const buffer = await streamToBuffer(requestContext.stream);
		const statusCode = requestContext.res.statusCode ?? 0;
		const errorText = buffer.toString();
		yield {
			type: 'provider-error',
			message: `${route.id} request failed (HTTP ${statusCode}): ${errorText}`,
			retryable: statusCode === 429 || statusCode >= 500
		};
		return;
	}

	const queue: LLMEvent[] = [];
	let done = false;
	let error: Error | null = null;
	let resolveNext: (() => void) | null = null;

	let state = route.protocol.initialState();
	let bufferStr = '';

	const push = (events: LLMEvent[]) => {
		for (const e of events) {
			queue.push(e);
		}
		if (resolveNext) {
			resolveNext();
			resolveNext = null;
		}
	};

	listenStream(requestContext.stream, {
		onData: (chunk: VSBuffer) => {
			bufferStr += chunk.toString();
			const lines = bufferStr.split('\n');
			bufferStr = lines.pop() ?? '';
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) { continue; }
				if (trimmed.startsWith(':')) { continue; } // SSE comment / heartbeat
				const frame = extractFrame(trimmed);
				if (frame === null) { continue; }
				const decoded = route.protocol.decodeFrame(state, frame);
				state = decoded.state;
				push(decoded.events);
			}
		},
		onError: (err: Error) => {
			error = err;
			done = true;
			if (resolveNext) { resolveNext(); resolveNext = null; }
		},
		onEnd: () => {
			// Flush any partial line left in the buffer.
			if (bufferStr.trim()) {
				const frame = extractFrame(bufferStr.trim());
				if (frame !== null) {
					const decoded = route.protocol.decodeFrame(state, frame);
					state = decoded.state;
					push(decoded.events);
				}
			}
			push(route.protocol.finalize(state));
			done = true;
			if (resolveNext) { resolveNext(); resolveNext = null; }
		}
	});

	while (!done || queue.length > 0) {
		if (queue.length === 0) {
			await new Promise<void>(resolve => { resolveNext = resolve; });
		}
		if (error) { throw error; }
		const next = queue.shift();
		if (next) {
			yield next;
		}
	}
}

/**
 * Run a route to completion, accumulating events into a single result.
 * Equivalent to Kilocode's `generate = stream.runFold`.
 */
export async function generateRoute(
	route: ProviderRoute,
	request: LLMRequest,
	requestService: IRequestService
): Promise<StreamResult> {
	const events: LLMEvent[] = [];
	let text = '';
	let reasoning = '';
	let usage: TokenUsage | undefined;
	let finishReason: FinishReason | undefined;

	for await (const event of streamRoute(route, request, requestService)) {
		events.push(event);
		switch (event.type) {
			case 'text-delta': text += event.text; break;
			case 'reasoning-delta': reasoning += event.text; break;
			case 'finish':
				usage = event.usage;
				finishReason = event.reason;
				break;
			case 'step-finish':
				if (!usage && event.usage) { usage = event.usage; }
				if (!finishReason) { finishReason = event.reason; }
				break;
			case 'provider-error':
				// The provider emitted an in-stream error (e.g. model not found,
				// content filter, upstream 4xx). Surface it rather than returning
				// an empty result, which downstream callers can't distinguish
				// from a legitimately empty completion.
				throw new Error(event.message);
		}
	}

	return { events, text, reasoning, usage, finishReason };
}

function applyAuth(headers: Record<string, string>, auth: AuthDef): void {
	switch (auth.kind) {
		case 'bearer': headers['Authorization'] = `Bearer ${auth.token}`; break;
		case 'header': headers[auth.name] = auth.value; break;
		case 'none': break;
	}
}

/**
 * Extract a decodable frame from a raw SSE line. Handles the common
 * `data: <json>` and `data: [DONE]` patterns. Returns the parsed JSON value
 * (object or string), or `null` if the line is not a data line.
 */
function extractFrame(line: string): unknown {
	if (line === 'data: [DONE]') { return null; }
	if (line.startsWith('data: ')) {
		const jsonStr = line.slice(6);
		try { return JSON.parse(jsonStr); } catch { return null; }
	}
	// Some providers emit plain JSON lines (not SSE). Try parsing as JSON.
	if (line.startsWith('{') || line.startsWith('[')) {
		try { return JSON.parse(line); } catch { return null; }
	}
	return null;
}
