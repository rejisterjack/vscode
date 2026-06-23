/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { IRequestService } from '../../platform/request/common/request.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IProviderRegistry } from '../common/types/provider.types.js';
import { IAIProvider } from './common/aiProvider.js';
import { AnthropicProvider } from './anthropic/anthropicProvider.js';
import { OpenAIProvider } from './openai/openaiProvider.js';
import { GoogleProvider } from './google/googleProvider.js';
import { VertexProvider } from './googleVertex/vertexProvider.js';
import { BedrockProvider } from './bedrock/bedrockProvider.js';
import { AzureProvider } from './azure/azureProvider.js';
import { OpenRouterProvider } from './openrouter/openrouterProvider.js';
import { XAIProvider } from './xai/xaiProvider.js';
import { MistralProvider } from './mistral/mistralProvider.js';
import { DeepSeekProvider } from './deepseek/deepseekProvider.js';
import { OllamaProvider } from './ollama/ollamaProvider.js';
import { LMStudioProvider } from './lmstudio/lmStudioProvider.js';
import { ZaiProvider } from './zai/zaiProvider.js';
import { createOpenAICompatibleProviders } from './openaiCompatible/openaiCompatibleProvider.js';

/**
 * Register all native LLM providers (excluding the Kilocode gateway). Called
 * once at startup. Each provider reads its config from VS Code settings
 * (`ai.provider.{id}.*`) and self-registers with the `IProviderRegistry`.
 *
 * Providers with an API key configured are marked enabled; local providers
 * (Ollama, LM Studio) are always available.
 */
export function registerLLMProviders(
	instantiationService: IInstantiationService,
	registry: IProviderRegistry
): void {
	const requestService = instantiationService.invokeFunction(accessor => accessor.get(IRequestService));
	const configService = instantiationService.invokeFunction(accessor => accessor.get(IConfigurationService));

	const providers: IAIProvider[] = [
		instantiationService.createInstance(AnthropicProvider),
		instantiationService.createInstance(OpenAIProvider),
		instantiationService.createInstance(GoogleProvider),
		instantiationService.createInstance(VertexProvider),
		instantiationService.createInstance(BedrockProvider),
		instantiationService.createInstance(AzureProvider),
		instantiationService.createInstance(OpenRouterProvider),
		instantiationService.createInstance(XAIProvider),
		instantiationService.createInstance(MistralProvider),
		instantiationService.createInstance(DeepSeekProvider),
		instantiationService.createInstance(OllamaProvider),
		instantiationService.createInstance(LMStudioProvider),
		instantiationService.createInstance(ZaiProvider),
		...createOpenAICompatibleProviders(requestService, configService),
	];

	// Avoid duplicate registration if already present.
	for (const provider of providers) {
		if (!registry.getProvider(provider.id)) {
			registry.register(provider);
		}
	}
}
