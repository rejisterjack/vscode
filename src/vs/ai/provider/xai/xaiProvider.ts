/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { ProviderRoute, AuthDef, type LLMProtocol } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { openAIChatProtocol } from '../protocols/openaiChat.js';

/**
 * xAI (Grok) provider. Uses the OpenAI Chat Completions wire format.
 */
export class XAIProvider extends ProtocolBackedProvider {
	readonly id = 'xai';
	readonly name = 'xAI (Grok)';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 131072
	};

	protected readonly protocol: LLMProtocol = openAIChatProtocol as LLMProtocol;
	protected readonly configPrefix = 'ai.provider.xai';

	protected getDefaultEndpoint(): string {
		return 'https://api.x.ai/v1';
	}

	protected getDefaultModel(): string {
		return 'grok-4';
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
