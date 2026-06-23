/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Token usage reported by an LLM provider. Mirrors the inclusive-totals
 * convention of the Vercel AI SDK / OpenAI / LangChain:
 *
 *  - `inputTokens` is the total prompt tokens (including cached reads/writes).
 *  - `outputTokens` is the total output tokens (including reasoning).
 *  - `totalTokens` is either the provider-supplied total or input + output.
 *
 * The non-overlapping breakdown fields (`nonCachedInputTokens`,
 * `cacheReadInputTokens`, `cacheWriteInputTokens`, `reasoningTokens`) are
 * independent -- consumers never need to subtract.
 */
export interface TokenUsage {
	inputTokens?: number;
	outputTokens?: number;
	nonCachedInputTokens?: number;
	cacheReadInputTokens?: number;
	cacheWriteInputTokens?: number;
	reasoningTokens?: number;
	totalTokens?: number;
	providerMetadata?: Record<string, unknown>;
}

/**
 * Visible output tokens -- `outputTokens` minus `reasoningTokens`, clamped to 0.
 */
export function visibleOutputTokens(usage: TokenUsage): number {
	return Math.max(0, (usage.outputTokens ?? 0) - (usage.reasoningTokens ?? 0));
}

/**
 * The universal streaming event union. All providers normalize to this shape,
 * which is a TypeScript-native port of Kilocode's Effect-based `LLMEvent`
 * (`references/kilocode/packages/llm/src/schema/events.ts:206-223`).
 */
export type LLMEvent =
	| { readonly type: 'step-start'; readonly index: number }
	| { readonly type: 'text-start'; readonly id: string }
	| { readonly type: 'text-delta'; readonly id: string; readonly text: string }
	| { readonly type: 'text-end'; readonly id: string }
	| { readonly type: 'reasoning-start'; readonly id: string }
	| { readonly type: 'reasoning-delta'; readonly id: string; readonly text: string }
	| { readonly type: 'reasoning-end'; readonly id: string }
	| { readonly type: 'tool-input-start'; readonly id: string; readonly name: string }
	| { readonly type: 'tool-input-delta'; readonly id: string; readonly name: string; readonly text: string }
	| { readonly type: 'tool-input-end'; readonly id: string; readonly name: string }
	| { readonly type: 'tool-call'; readonly id: string; readonly name: string; readonly input: unknown; readonly providerExecuted?: boolean }
	| { readonly type: 'tool-result'; readonly id: string; readonly name: string; readonly result: unknown; readonly providerExecuted?: boolean }
	| { readonly type: 'tool-error'; readonly id: string; readonly name: string; readonly message: string }
	| { readonly type: 'step-finish'; readonly index: number; readonly reason: FinishReason; readonly usage?: TokenUsage }
	| { readonly type: 'finish'; readonly reason: FinishReason; readonly usage?: TokenUsage }
	| { readonly type: 'provider-error'; readonly message: string; readonly retryable?: boolean };

/**
 * The reason a generation step finished.
 */
export type FinishReason =
	| 'stop'
	| 'length'
	| 'tool-calls'
	| 'content-filter'
	| 'error'
	| 'other';

/**
 * Type guards for discriminating LLMEvent variants. Lets consumers write
 * `events.filter(isTextDelta)` instead of checking `e.type === 'text-delta'`.
 */
export const isTextDelta = (e: LLMEvent): e is Extract<LLMEvent, { type: 'text-delta' }> => e.type === 'text-delta';
export const isReasoningDelta = (e: LLMEvent): e is Extract<LLMEvent, { type: 'reasoning-delta' }> => e.type === 'reasoning-delta';
export const isToolCall = (e: LLMEvent): e is Extract<LLMEvent, { type: 'tool-call' }> => e.type === 'tool-call';
export const isToolResult = (e: LLMEvent): e is Extract<LLMEvent, { type: 'tool-result' }> => e.type === 'tool-result';
export const isToolError = (e: LLMEvent): e is Extract<LLMEvent, { type: 'tool-error' }> => e.type === 'tool-error';
export const isFinish = (e: LLMEvent): e is Extract<LLMEvent, { type: 'finish' }> => e.type === 'finish';
export const isProviderError = (e: LLMEvent): e is Extract<LLMEvent, { type: 'provider-error' }> => e.type === 'provider-error';

/**
 * Generate a stable unique id for a content block or tool call.
 */
export function generateBlockId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
