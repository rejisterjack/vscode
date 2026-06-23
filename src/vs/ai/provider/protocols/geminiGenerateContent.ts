/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LLMProtocol, LLMRequest, Message, ToolChoice, GenerationOptions } from '../common/llmProtocol.js';
import { LLMEvent, TokenUsage, FinishReason, generateBlockId } from '../common/llmEvent.js';
import { applyCachePolicy } from '../common/promptCache.js';

/**
 * Protocol id for the Google Gemini generateContent API.
 */
export const GEMINI_PROTOCOL_ID = 'gemini-generate-content';

interface GeminiPart {
	text?: string;
	inlineData?: { mimeType: string; data: string };
	functionCall?: { name: string; args: Record<string, unknown> };
	functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
	role: 'user' | 'model';
	parts: GeminiPart[];
}

interface GeminiRequestBody {
	contents: GeminiContent[];
	systemInstruction?: { parts: Array<{ text: string }> };
	tools?: Array<{ functionDeclarations: Array<{ name: string; description: string; parameters: Record<string, unknown> }> }>;
	toolConfig?: { functionCallingConfig: { mode: string; allowedFunctionNames?: string[] } };
	generationConfig?: {
		maxOutputTokens?: number;
		temperature?: number;
		topP?: number;
		topK?: number;
		stopSequences?: string[];
	};
}

interface GeminiStreamChunk {
	candidates?: Array<{
		content?: { parts?: GeminiPart[]; role?: string };
		finishReason?: string;
	}>;
	usageMetadata?: {
		promptTokenCount?: number;
		candidatesTokenCount?: number;
		totalTokenCount?: number;
		cachedContentTokenCount?: number;
	};
}

interface GeminiProtocolState {
	usage?: TokenUsage;
	finishReason?: FinishReason;
}

/**
 * The Google Gemini generateContent streaming protocol.
 *
 * Port of `references/kilocode/packages/llm/src/protocols/gemini.ts`.
 */
export const geminiProtocol: LLMProtocol = {
	id: GEMINI_PROTOCOL_ID,

	async buildBody(request: LLMRequest): Promise<GeminiRequestBody> {
		const system = applyCachePolicy(request);
		const systemText = system
			.filter((p): p is Extract<typeof system[number], { type: 'text' }> => p.type === 'text')
			.map(p => p.text)
			.join('\n\n');

		const body: GeminiRequestBody = {
			contents: request.messages.map(messageToGeminiContent)
		};

		if (systemText) {
			body.systemInstruction = { parts: [{ text: systemText }] };
		}

		if (request.tools?.length) {
			body.tools = [{
				functionDeclarations: request.tools.map(t => ({
					name: t.name,
					description: t.description,
					parameters: t.parameters
				}))
			}];
		}

		if (request.toolChoice) {
			body.toolConfig = toolChoiceToGemini(request.toolChoice);
		}

		if (request.generation) {
			body.generationConfig = generationToGemini(request.generation);
		}

		return body;
	},

	initialState(): GeminiProtocolState {
		return { usage: undefined, finishReason: undefined };
	},

	decodeFrame(state: GeminiProtocolState, chunk: GeminiStreamChunk): { state: unknown; events: LLMEvent[] } {
		const events: LLMEvent[] = [];

		if (chunk.usageMetadata) {
			state.usage = {
				inputTokens: chunk.usageMetadata.promptTokenCount,
				outputTokens: chunk.usageMetadata.candidatesTokenCount,
				totalTokens: chunk.usageMetadata.totalTokenCount,
				cacheReadInputTokens: chunk.usageMetadata.cachedContentTokenCount
			};
		}

		if (!chunk.candidates?.length) {
			return { state, events };
		}

		for (const candidate of chunk.candidates) {
			const parts = candidate.content?.parts ?? [];
			for (const part of parts) {
				if (part.text) {
					events.push({ type: 'text-delta', id: 'text-main', text: part.text });
				}
				if (part.functionCall) {
					const id = generateBlockId();
					events.push({ type: 'tool-input-start', id, name: part.functionCall.name });
					events.push({ type: 'tool-call', id, name: part.functionCall.name, input: part.functionCall.args });
				}
			}
			if (candidate.finishReason) {
				state.finishReason = mapGeminiFinishReason(candidate.finishReason);
			}
		}

		return { state, events };
	},

	finalize(state: GeminiProtocolState): LLMEvent[] {
		return [{
			type: 'finish',
			reason: state.finishReason ?? 'stop',
			usage: state.usage
		}];
	}
};

function messageToGeminiContent(msg: Message): GeminiContent {
	const parts: GeminiPart[] = [];

	if (typeof msg.content === 'string') {
		parts.push({ text: msg.content });
	} else {
		for (const part of msg.content) {
			switch (part.type) {
				case 'text': parts.push({ text: part.text }); break;
				case 'image': parts.push({ inlineData: { mimeType: part.mediaType, data: part.data } }); break;
				case 'tool-call': parts.push({ functionCall: { name: part.name, args: part.input as Record<string, unknown> } }); break;
				case 'tool-result': parts.push({
					functionResponse: {
						name: part.name,
						response: typeof part.output === 'object' && part.output !== null
							? part.output as Record<string, unknown>
							: { result: safeStringify(part.output) }
					}
				}); break;
			}
		}
	}

	return {
		role: msg.role === 'assistant' ? 'model' : 'user',
		parts
	};
}

function toolChoiceToGemini(choice: ToolChoice): { functionCallingConfig: { mode: string; allowedFunctionNames?: string[] } } {
	switch (choice.type) {
		case 'auto': return { functionCallingConfig: { mode: 'AUTO' } };
		case 'none': return { functionCallingConfig: { mode: 'NONE' } };
		case 'required': return { functionCallingConfig: { mode: 'ANY' } };
		case 'tool': return { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [choice.name] } };
	}
}

function generationToGemini(gen: GenerationOptions): NonNullable<GeminiRequestBody['generationConfig']> {
	const config: NonNullable<GeminiRequestBody['generationConfig']> = {};
	if (gen.maxTokens !== undefined) { config.maxOutputTokens = gen.maxTokens; }
	if (gen.temperature !== undefined) { config.temperature = gen.temperature; }
	if (gen.topP !== undefined) { config.topP = gen.topP; }
	if (gen.topK !== undefined) { config.topK = gen.topK; }
	if (gen.stop) { config.stopSequences = gen.stop; }
	return config;
}

function safeStringify(value: unknown): string {
	if (typeof value === 'string') { return value; }
	try { return JSON.stringify(value); } catch { return String(value); }
}

function mapGeminiFinishReason(reason: string): FinishReason {
	switch (reason) {
		case 'STOP': return 'stop';
		case 'MAX_TOKENS': return 'length';
		case 'SAFETY': case 'RECITATION': return 'content-filter';
		default: return 'other';
	}
}
