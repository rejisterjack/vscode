/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../base/common/cancellation.js';
import { asJson, isSuccess } from '../../../platform/request/common/request.js';
import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { openAIChatProtocol } from '../protocols/openaiChat.js';
import { CatalogModel } from '../common/modelsDevCatalog.js';

/**
 * Ollama local model provider. Runs models locally via the Ollama HTTP API
 * (default `http://localhost:11434/v1`). No API key required. Uses the
 * OpenAI Chat Completions wire format exposed by Ollama's compatibility layer.
 */
export class OllamaProvider extends ProtocolBackedProvider {
	readonly id = 'ollama';
	readonly name = 'Ollama (Local)';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 8192
	};

	protected readonly protocol: LLMProtocol = openAIChatProtocol;
	protected readonly configPrefix = 'ai.provider.ollama';

	protected getDefaultEndpoint(): string {
		return 'http://localhost:11434/v1';
	}

	protected getDefaultModel(): string {
		return 'llama3.2';
	}

	protected override requiresApiKey(): boolean {
		return false;
	}

	protected buildRoute(config: { apiKey?: string; endpoint?: string }): ProviderRoute {
		const baseURL = config.endpoint || this.getDefaultEndpoint();
		return {
			id: this.id,
			protocol: this.protocol,
			endpoint: `${baseURL}/chat/completions`,
			auth: { kind: 'none' }
		};
	}

	/**
	 * Fetch live models from the Ollama `/api/tags` endpoint.
	 */
	protected override async fetchModels(): Promise<readonly CatalogModel[]> {
		const baseURL = this.getConfig().endpoint || this.getDefaultEndpoint();
		try {
			const requestContext = await this.requestService.request({
				type: 'GET',
				url: `${baseURL.replace('/v1', '')}/api/tags`
			}, CancellationToken.None);
			if (!isSuccess(requestContext)) { return this.getStaticModels(); }
			const result = await asJson<{ models?: Array<{ name: string; details?: { parameter_size?: string } }> }>(requestContext);
			if (!result?.models) { return this.getStaticModels(); }
			return result.models.map((m: { name: string }) => ({
				id: m.name,
				name: m.name,
				releaseDate: '2024-01-01',
				attachment: false,
				reasoning: false,
				temperature: true,
				toolCall: true,
				limit: { context: 8192, output: 4096 }
			}));
		} catch {
			return this.getStaticModels();
		}
	}

	protected override getStaticModels(): CatalogModel[] {
		return [
			{ id: 'llama3.2', name: 'Llama 3.2', releaseDate: '2024-01-01', attachment: false, reasoning: false, temperature: true, toolCall: true, limit: { context: 8192, output: 4096 } },
			{ id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', releaseDate: '2024-01-01', attachment: false, reasoning: false, temperature: true, toolCall: true, limit: { context: 32768, output: 8192 } },
		];
	}
}
