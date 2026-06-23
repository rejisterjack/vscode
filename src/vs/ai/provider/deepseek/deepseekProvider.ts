/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute, AuthDef } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { openAIChatProtocol } from '../protocols/openaiChat.js';

/**
 * DeepSeek provider. Uses the OpenAI Chat Completions wire format with
 * DeepSeek's native API.
 */
export class DeepSeekProvider extends ProtocolBackedProvider {
	readonly id = 'deepseek';
	readonly name = 'DeepSeek';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 128000
	};

	protected readonly protocol: LLMProtocol = openAIChatProtocol;
	protected readonly configPrefix = 'ai.provider.deepseek';

	protected getDefaultEndpoint(): string {
		return 'https://api.deepseek.com/v1';
	}

	protected getDefaultModel(): string {
		return 'deepseek-chat';
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
