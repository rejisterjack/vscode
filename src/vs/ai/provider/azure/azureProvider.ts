/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { ProviderRoute, AuthDef, LLMProtocol } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { openAIChatProtocol } from '../protocols/openaiChat.js';
import { openAIResponsesProtocol } from '../protocols/openaiResponses.js';
import { usesResponsesApi } from '../openai/openaiProvider.js';

/**
 * Azure OpenAI provider. Uses a resource-name-based URL
 * (`https://{resourceName}.openai.azure.com`) and `api-key` header auth.
 * Supports both Chat Completions and Responses API (via `api-version` query).
 */
export class AzureProvider extends ProtocolBackedProvider {
	readonly id = 'azure';
	readonly name = 'Azure OpenAI';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 128000
	};

	protected readonly configPrefix = 'ai.provider.azure';

	protected getDefaultEndpoint(): string {
		return 'https://YOUR_RESOURCE_NAME.openai.azure.com';
	}

	protected getDefaultModel(): string {
		return 'gpt-4o';
	}

	protected get protocol(): LLMProtocol {
		return openAIChatProtocol;
	}

	protected buildRoute(config: { apiKey?: string; endpoint?: string; defaultModel?: string }): ProviderRoute {
		// Azure endpoint is the full deployment URL, including api-version.
		// Users configure: ai.provider.azure.endpoint = https://{resource}.openai.azure.com
		// and ai.provider.azure.apiVersion = 2024-10-21
		const baseEndpoint = config.endpoint || this.getDefaultEndpoint();
		const resourceName = this.configService.getValue<string>('ai.provider.azure.resourceName') ?? '';
		const deploymentId = config.defaultModel || this.getDefaultModel();
		const apiVersion = this.configService.getValue<string>('ai.provider.azure.apiVersion') ?? '2024-10-21';
		const useResponses = usesResponsesApi(deploymentId);
		const endpoint = resourceName
			? `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentId}/${useResponses ? 'responses' : 'chat/completions'}?api-version=${apiVersion}`
			: `${baseEndpoint}/openai/deployments/${deploymentId}/${useResponses ? 'responses' : 'chat/completions'}?api-version=${apiVersion}`;
		const auth: AuthDef = config.apiKey
			? { kind: 'header', name: 'api-key', value: config.apiKey }
			: { kind: 'none' };
		return {
			id: this.id,
			protocol: useResponses ? openAIResponsesProtocol : openAIChatProtocol,
			endpoint,
			auth
		};
	}
}
