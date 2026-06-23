/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute, AuthDef } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { IRequestService } from '../../../platform/request/common/request.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { openAIChatProtocol } from '../protocols/openaiChat.js';
import { CatalogModel } from '../common/modelsDevCatalog.js';
import { getProfile, ProviderProfile } from './profiles.js';

/**
 * Generic OpenAI-compatible provider. Powers DeepSeek, Groq, Together AI,
 * Cerebras, DeepInfra, Fireworks AI, Baseten, and any other provider that
 * speaks the OpenAI Chat Completions wire format. Each is configured with a
 * `ProviderProfile` (id + base URL).
 */
export class OpenAICompatibleProvider extends ProtocolBackedProvider {
	readonly id: string;
	readonly name: string;
	readonly capabilities: ProviderCapabilities;
	protected readonly protocol: LLMProtocol = openAIChatProtocol;
	protected readonly configPrefix: string;
	private readonly profile: ProviderProfile;

	constructor(
		profile: ProviderProfile,
		@IRequestService requestService: IRequestService,
		@IConfigurationService configService: IConfigurationService
	) {
		super(requestService, configService);
		this.profile = profile;
		this.id = profile.provider;
		this.name = profile.displayName ?? profile.provider;
		this.configPrefix = `ai.provider.${profile.provider}`;
		this.capabilities = { ...DEFAULT_TOOL_CAPABILITIES, maxContextLength: 128000 };
	}

	protected getDefaultEndpoint(): string {
		return this.profile.baseURL;
	}

	protected getDefaultModel(): string {
		return 'gpt-4o';
	}

	protected buildRoute(config: { apiKey?: string; endpoint?: string }): ProviderRoute {
		const baseURL = config.endpoint || this.profile.baseURL;
		const auth: AuthDef = config.apiKey
			? { kind: 'bearer', token: config.apiKey }
			: { kind: 'none' };
		return {
			id: this.profile.provider,
			protocol: this.protocol,
			endpoint: `${baseURL}/chat/completions`,
			auth
		};
	}

	protected override getStaticModels(): CatalogModel[] {
		return [];
	}
}

/**
 * Factory: create one OpenAI-compatible provider instance per profile.
 */
export function createOpenAICompatibleProviders(
	requestService: IRequestService,
	configService: IConfigurationService
): OpenAICompatibleProvider[] {
	const providers: OpenAICompatibleProvider[] = [];
	for (const id of ['deepseek', 'groq', 'togetherai', 'cerebras', 'deepinfra', 'fireworks', 'baseten']) {
		const profile = getProfile(id);
		if (profile) {
			providers.push(new OpenAICompatibleProvider(profile, requestService, configService));
		}
	}
	return providers;
}
