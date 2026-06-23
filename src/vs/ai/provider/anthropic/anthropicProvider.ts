/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute, AuthDef } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { anthropicMessagesProtocol } from '../protocols/anthropicMessages.js';
import { CatalogModel } from '../common/modelsDevCatalog.js';

/**
 * Anthropic provider. Uses the Anthropic Messages API with prompt caching,
 * extended thinking, and fine-grained tool streaming.
 */
export class AnthropicProvider extends ProtocolBackedProvider {
	readonly id = 'anthropic';
	readonly name = 'Anthropic';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 200000,
		supportedModes: ['coding', 'ask', 'architect', 'debug', 'plan', 'learning']
	};

	protected readonly protocol: LLMProtocol = anthropicMessagesProtocol;
	protected readonly configPrefix = 'ai.provider.anthropic';

	protected getDefaultEndpoint(): string {
		return 'https://api.anthropic.com/v1';
	}

	protected getDefaultModel(): string {
		return 'claude-sonnet-4-5-20250929';
	}

	protected buildRoute(config: { apiKey?: string; endpoint?: string }): ProviderRoute {
		const baseURL = config.endpoint || this.getDefaultEndpoint();
		const auth: AuthDef = config.apiKey
			? { kind: 'header', name: 'x-api-key', value: config.apiKey }
			: { kind: 'none' };
		return {
			id: this.id,
			protocol: this.protocol,
			endpoint: `${baseURL}/messages`,
			auth,
			headers: {
				'anthropic-version': '2023-06-01',
				'anthropic-beta': 'interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
			}
		};
	}

	protected override getStaticModels(): CatalogModel[] {
		return [
			makeModel('claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5', 'claude', 200000, 8192, true),
			makeModel('claude-opus-4-20250514', 'Claude Opus 4', 'claude', 200000, 32000, true),
			makeModel('claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 'claude', 200000, 8192, true),
		];
	}
}

function makeModel(id: string, name: string, family: string, context: number, output: number, reasoning: boolean): CatalogModel {
	return {
		id,
		name,
		family,
		releaseDate: '2025-01-01',
		attachment: true,
		reasoning,
		temperature: true,
		toolCall: true,
		limit: { context, output }
	};
}
