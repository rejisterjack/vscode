/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { ProviderRoute, AuthDef, LLMProtocol } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { openAIChatProtocol } from '../protocols/openaiChat.js';
import { openAIResponsesProtocol } from '../protocols/openaiResponses.js';
import { CatalogModel } from '../common/modelsDevCatalog.js';

/**
 * OpenAI provider. Uses the Responses API for GPT-5+ models and the Chat
 * Completions API for legacy models (GPT-4o, etc.).
 */
export class OpenAIProvider extends ProtocolBackedProvider {
	readonly id = 'openai';
	readonly name = 'OpenAI';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 128000,
		supportedModes: ['coding', 'ask', 'architect', 'debug', 'plan', 'learning']
	};

	protected readonly configPrefix = 'ai.provider.openai';

	protected getDefaultEndpoint(): string {
		return 'https://api.openai.com/v1';
	}

	protected getDefaultModel(): string {
		return 'gpt-4o';
	}

	/**
	 * Select the protocol based on the model id. GPT-5+ and o-series reasoning
	 * models use the Responses API; everything else uses Chat Completions.
	 */
	protected get protocol(): LLMProtocol {
		// The protocol is selected per-request in `buildRoute`, but the base
		// class exposes it as a property. We return the chat protocol as a
		// default; `buildRoute` picks the right one based on the model.
		return openAIChatProtocol;
	}

	protected buildRoute(config: { apiKey?: string; endpoint?: string; defaultModel?: string }): ProviderRoute {
		const baseURL = config.endpoint || this.getDefaultEndpoint();
		const auth: AuthDef = config.apiKey
			? { kind: 'bearer', token: config.apiKey }
			: { kind: 'none' };
		const useResponses = usesResponsesApi(config.defaultModel ?? '');
		return {
			id: this.id,
			protocol: useResponses ? openAIResponsesProtocol : openAIChatProtocol,
			endpoint: `${baseURL}${useResponses ? '/responses' : '/chat/completions'}`,
			auth
		};
	}

	protected override getStaticModels(): CatalogModel[] {
		return [
			makeModel('gpt-4o', 'GPT-4o', 'gpt-4o', 128000, 16384, false),
			makeModel('gpt-4o-mini', 'GPT-4o mini', 'gpt-4o', 128000, 16384, false),
			makeModel('o3', 'o3', 'o3', 200000, 100000, true),
			makeModel('o4-mini', 'o4-mini', 'o3', 200000, 100000, true),
			makeModel('gpt-5', 'GPT-5', 'gpt-5', 200000, 128000, true),
		];
	}
}

/**
 * Whether a model id should use the Responses API (GPT-5+, o-series).
 */
export function usesResponsesApi(modelId: string): boolean {
	const lower = modelId.toLowerCase();
	return lower.startsWith('gpt-5') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4');
}

function makeModel(id: string, name: string, family: string, context: number, output: number, reasoning: boolean): CatalogModel {
	return {
		id,
		name,
		family,
		releaseDate: '2024-01-01',
		attachment: true,
		reasoning,
		temperature: !reasoning,
		toolCall: true,
		limit: { context, output }
	};
}
