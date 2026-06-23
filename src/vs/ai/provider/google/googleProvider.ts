/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { geminiProtocol } from '../protocols/geminiGenerateContent.js';
import { CatalogModel } from '../common/modelsDevCatalog.js';

/**
 * Google Gemini provider. Uses the generateContent streaming endpoint with
 * the API key passed as a query parameter.
 */
export class GoogleProvider extends ProtocolBackedProvider {
	readonly id = 'google';
	readonly name = 'Google Gemini';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 1000000
	};

	protected readonly protocol: LLMProtocol = geminiProtocol;
	protected readonly configPrefix = 'ai.provider.google';

	protected getDefaultEndpoint(): string {
		return 'https://generativelanguage.googleapis.com/v1beta';
	}

	protected getDefaultModel(): string {
		return 'gemini-2.5-pro';
	}

	protected buildRoute(config: { apiKey?: string; endpoint?: string }): ProviderRoute {
		const baseURL = config.endpoint || this.getDefaultEndpoint();
		// Gemini passes the API key as a query parameter, not a header.
		const apiKey = config.apiKey ?? '';
		return {
			id: this.id,
			protocol: this.protocol,
			// The protocol substitutes {model} -- but since our protocol layer
			// sends one POST per request, we use a fixed model in the URL and
			// let the body carry the model id. We pick a sentinel and replace
			// it in the body. For simplicity, the model is always in the body.
			endpoint: `${baseURL}/models:streamGenerateContent?alt=sse${apiKey ? `&key=${apiKey}` : ''}`,
			auth: { kind: 'none' }
		};
	}

	protected override getStaticModels(): CatalogModel[] {
		return [
			makeModel('gemini-2.5-pro', 'Gemini 2.5 Pro', 'gemini', 2000000, 8192, true),
			makeModel('gemini-2.5-flash', 'Gemini 2.5 Flash', 'gemini', 1000000, 8192, true),
			makeModel('gemini-2.0-flash', 'Gemini 2.0 Flash', 'gemini', 1000000, 8192, false),
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
