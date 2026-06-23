/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute, AuthDef } from '../common/llmProtocol.js';
import { ProviderCapabilities, ProviderConfig } from '../../common/types/ai.types.js';
import { openAIChatProtocol } from '../protocols/openaiChat.js';
import { CatalogModel } from '../common/modelsDevCatalog.js';
import { IRequestService } from '../../../platform/request/common/request.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';

/** GLM Coding Plan endpoints (OpenAI-compatible). */
export const ZAI_CODING_ENDPOINT_INTL = 'https://api.z.ai/api/coding/paas/v4';
export const ZAI_CODING_ENDPOINT_CN = 'https://open.bigmodel.cn/api/coding/paas/v4';
export const ZAI_GENERAL_ENDPOINT_INTL = 'https://api.z.ai/api/paas/v4';
export const ZAI_GENERAL_ENDPOINT_CN = 'https://open.bigmodel.cn/api/paas/v4';

/**
 * Z.ai (Zhipu AI) provider with first-class GLM Coding Plan support.
 * Uses the OpenAI Chat Completions wire format.
 */
export class ZaiProvider extends ProtocolBackedProvider {
	readonly id = 'zai';
	readonly name = 'Z.ai';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 200000,
		supportedModes: ['coding', 'ask', 'architect', 'debug', 'plan', 'learning']
	};

	protected readonly protocol: LLMProtocol = openAIChatProtocol;
	protected readonly configPrefix = 'ai.provider.zai';

	constructor(
		@IRequestService requestService: IRequestService,
		@IConfigurationService configService: IConfigurationService
	) {
		super(requestService, configService);
	}

	protected override getConfig(): ProviderConfig {
		const config = super.getConfig();
		const endpoint = config.endpoint?.trim() || ZaiProvider.resolveEndpoint(this.configService);
		return { ...config, endpoint };
	}

	protected getDefaultEndpoint(): string {
		return this.resolveEndpoint(this.configService);
	}

	protected getDefaultModel(): string {
		return 'glm-5';
	}

	protected buildRoute(config: { apiKey?: string; endpoint?: string }): ProviderRoute {
		const baseURL = (config.endpoint || this.getDefaultEndpoint()).replace(/\/$/, '');
		const auth: AuthDef = config.apiKey
			? { kind: 'bearer', token: config.apiKey }
			: { kind: 'none' };
		const endpoint = baseURL.endsWith('/chat/completions')
			? baseURL
			: `${baseURL}/chat/completions`;
		return {
			id: this.id,
			protocol: this.protocol,
			endpoint,
			auth
		};
	}

	protected override getStaticModels(): CatalogModel[] {
		return [
			makeModel('glm-5.2', 'GLM-5.2', 'glm', 200000, 128000, true),
			makeModel('glm-5', 'GLM-5', 'glm', 200000, 128000, true),
			makeModel('glm-4.7', 'GLM-4.7', 'glm', 200000, 128000, true),
			makeModel('glm-4.7-flash', 'GLM-4.7 Flash', 'glm', 200000, 128000, true),
			makeModel('glm-4.6', 'GLM-4.6', 'glm', 200000, 128000, true),
			makeModel('glm-4.5-air', 'GLM-4.5 Air', 'glm', 128000, 96000, false),
			makeModel('glm-4.5-flash', 'GLM-4.5 Flash', 'glm', 128000, 96000, false),
		];
	}

	static resolveEndpoint(configService: IConfigurationService): string {
		const region = configService.getValue<string>('ai.provider.zai.region') ?? 'international';
		const codingPlan = configService.getValue<boolean>('ai.provider.zai.codingPlan') ?? true;
		const custom = configService.getValue<string>('ai.provider.zai.endpoint')?.trim();
		if (custom) {
			return custom;
		}
		if (codingPlan) {
			return region === 'china' ? ZAI_CODING_ENDPOINT_CN : ZAI_CODING_ENDPOINT_INTL;
		}
		return region === 'china' ? ZAI_GENERAL_ENDPOINT_CN : ZAI_GENERAL_ENDPOINT_INTL;
	}

	private resolveEndpoint(configService: IConfigurationService): string {
		return ZaiProvider.resolveEndpoint(configService);
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
		temperature: !reasoning,
		toolCall: true,
		limit: { context, output }
	};
}
