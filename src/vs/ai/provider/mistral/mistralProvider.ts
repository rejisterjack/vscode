/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute, AuthDef } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { openAIChatProtocol } from '../protocols/openaiChat.js';

/**
 * Mistral AI (La Plateforme) provider. Uses the OpenAI Chat Completions wire
 * format.
 */
export class MistralProvider extends ProtocolBackedProvider {
	readonly id = 'mistral';
	readonly name = 'Mistral AI';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 128000
	};

	protected readonly protocol: LLMProtocol = openAIChatProtocol;
	protected readonly configPrefix = 'ai.provider.mistral';

	protected getDefaultEndpoint(): string {
		return 'https://api.mistral.ai/v1';
	}

	protected getDefaultModel(): string {
		return 'mistral-large-latest';
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
			auth
		};
	}
}
