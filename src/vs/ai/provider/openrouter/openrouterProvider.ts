/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute, AuthDef } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { openAIChatProtocol } from '../protocols/openaiChat.js';

/**
 * OpenRouter provider. Routes to many upstream models via a single API.
 * Uses the OpenAI Chat Completions wire format with extra usage/reasoning
 * options. Models are prefixed with their upstream provider (e.g.
 * `anthropic/claude-3.5-sonnet`).
 */
export class OpenRouterProvider extends ProtocolBackedProvider {
	readonly id = 'openrouter';
	readonly name = 'OpenRouter';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 200000
	};

	protected readonly protocol: LLMProtocol = openAIChatProtocol;
	protected readonly configPrefix = 'ai.provider.openrouter';

	protected getDefaultEndpoint(): string {
		return 'https://openrouter.ai/api/v1';
	}

	protected getDefaultModel(): string {
		return 'anthropic/claude-sonnet-4-5-20250929';
	}

	protected buildRoute(config: { apiKey?: string; endpoint?: string }): ProviderRoute {
		const baseURL = config.endpoint || this.getDefaultEndpoint();
		const auth: AuthDef = config.apiKey
			? { kind: 'bearer', token: config.apiKey }
			: { kind: 'none' };
		return {
			id: this.id,
			protocol: this.protocol,
			endpoint: `${baseURL}/chat/completions`,
			auth,
			headers: {
				'HTTP-Referer': 'https://fewstepsaway.ai',
				'X-Title': 'FewStepsAway'
			}
		};
	}
}
