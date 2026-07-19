/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AIRequestContext, AIResponse, AIResponseChunk, ProviderCapabilities } from '../../common/types/ai.types.js';
import { BaseAIProvider } from './common/aiProvider.js';
import { DEFAULT_TOOL_CAPABILITIES, IToolEnabledProvider, ToolEnabledRequest } from './common/protocolBackedProvider.js';
import { LLMEvent, generateBlockId } from './common/llmEvent.js';
import { StreamResult } from './common/llmProtocol.js';
import { CatalogModel } from './common/modelsDevCatalog.js';

export class TestProvider extends BaseAIProvider implements IToolEnabledProvider {
	readonly id = 'fewstepsaway-test';
	readonly name = 'FewStepsAway Test Provider';
	readonly capabilities: ProviderCapabilities = DEFAULT_TOOL_CAPABILITIES;

	protected override async doInitialize(): Promise<void> {
		// no-op
	}

	async sendRequest(context: AIRequestContext): Promise<AIResponse> {
		const text = await this.buildResponseText(context.query ?? '');
		return {
			content: text,
			tokensUsed: 10,
			provider: this.id,
			model: 'test-model',
			latency: 1,
			finishReason: 'stop',
		};
	}

	async *streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk> {
		const text = await this.buildResponseText(context.query ?? '');
		yield { content: text, isComplete: false };
		yield { content: '', isComplete: true };
	}

	async *streamWithTools(request: ToolEnabledRequest): AsyncIterable<LLMEvent> {
		const lastUser = [...request.messages].reverse().find(m => m.role === 'user');
		const query = typeof lastUser?.content === 'string' ? lastUser.content : '';
		const textId = generateBlockId();
		yield { type: 'text-start', id: textId };
		const response = await this.buildResponseText(query);
		yield { type: 'text-delta', id: textId, text: response };
		yield { type: 'text-end', id: textId };
		yield { type: 'step-finish', index: 0, reason: 'stop' };
		yield { type: 'finish', reason: 'stop' };
	}

	async generateWithTools(request: ToolEnabledRequest): Promise<StreamResult> {
		let text = '';
		for await (const event of this.streamWithTools(request)) {
			if (event.type === 'text-delta') {
				text += event.text;
			}
		}
		return { text, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } };
	}

	async getModels(): Promise<readonly CatalogModel[]> {
		return [{
			id: 'test-model',
			name: 'test-model',
			releaseDate: '2024-01-01',
			attachment: false,
			reasoning: false,
			temperature: true,
			toolCall: true,
			limit: { context: 8192, output: 4096 },
		}];
	}

	async getAvailableModels(): Promise<string[]> {
		return ['test-model'];
	}

	async validateConfig(): Promise<boolean> {
		return true;
	}

	estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}

	async shutdown(): Promise<void> {
		// no-op
	}

	private async buildResponseText(query: string): Promise<string> {
		if (query.includes('__TEST_TOOL_BASH__')) {
			return 'Running test bash command.';
		}
		if (query.includes('__TEST_VALIDATION_RETRY__')) {
			return 'Validation failed once; retrying automatically.';
		}
		if (query.includes('__TEST_COMPOSER__')) {
			return '```typescript\nexport const test = 1;\n```';
		}
		return 'Test provider response.';
	}
}

export function isTestProviderEnabled(): boolean {
	return process.env['VSCODE_TEST'] === '1' || process.env['VSCODE_TEST'] === 'true';
}
