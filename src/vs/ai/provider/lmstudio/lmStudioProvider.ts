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
 * LM Studio local model provider. Runs GGUF models locally via the LM Studio
 * OpenAI-compatible server (default `http://localhost:1234/v1`). No API key
 * required.
 */
export class LMStudioProvider extends ProtocolBackedProvider {
	readonly id = 'lmstudio';
	readonly name = 'LM Studio (Local)';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 8192
	};

	protected readonly protocol: LLMProtocol = openAIChatProtocol;
	protected readonly configPrefix = 'ai.provider.lmstudio';

	protected getDefaultEndpoint(): string {
		return 'http://localhost:1234/v1';
	}

	protected getDefaultModel(): string {
		return 'local-model';
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
	 * Fetch live models from the LM Studio `/v1/models` endpoint.
	 */
	protected override async fetchModels(): Promise<readonly CatalogModel[]> {
		const baseURL = this.getConfig().endpoint || this.getDefaultEndpoint();
		try {
			const requestContext = await this.requestService.request({
				type: 'GET',
				url: `${baseURL}/models`
			}, CancellationToken.None);
			if (!isSuccess(requestContext)) { return this.getStaticModels(); }
			const result = await asJson<{ data?: Array<{ id: string }> }>(requestContext);
			if (!result?.data) { return this.getStaticModels(); }
			return result.data.map((m: { id: string }) => ({
				id: m.id,
				name: m.id,
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
		return [];
	}
}
