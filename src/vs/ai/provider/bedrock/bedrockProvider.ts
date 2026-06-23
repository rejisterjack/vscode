/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute, AuthDef } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { anthropicMessagesProtocol } from '../protocols/anthropicMessages.js';

/**
 * AWS Bedrock provider. Uses the Bedrock Converse / Invoke Model With Response
 * Stream API. Auth is AWS SigV4 -- a production implementation would sign
 * requests with `@aws-sdk/credential-providers`. For now, users can supply a
 * bearer-style `apiKey` (Bedrock bearer tokens) or run with environment
 * credentials resolved by the CLI.
 *
 * The Anthropic Messages protocol is used since Bedrock-hosted Claude models
 * expose a compatible `invoke_with_response_stream` shape via the Converse API.
 */
export class BedrockProvider extends ProtocolBackedProvider {
	readonly id = 'amazon-bedrock';
	readonly name = 'AWS Bedrock';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 200000
	};

	protected readonly protocol: LLMProtocol = anthropicMessagesProtocol;
	protected readonly configPrefix = 'ai.provider.amazon-bedrock';

	protected getDefaultEndpoint(): string {
		const region = this.configService.getValue<string>('ai.provider.amazon-bedrock.region') ?? 'us-east-1';
		return `https://bedrock-runtime.${region}.amazonaws.com`;
	}

	protected getDefaultModel(): string {
		return 'anthropic.claude-sonnet-4-5-20250929-v1:0';
	}

	/**
	 * Bedrock bearer-token auth. SigV4 signing is deferred to a follow-up
	 * task that integrates `@aws-sdk/credential-providers`.
	 */
	protected buildRoute(config: { apiKey?: string; endpoint?: string }): ProviderRoute {
		const baseURL = config.endpoint || this.getDefaultEndpoint();
		const modelId = this.configService.getValue<string>('ai.provider.amazon-bedrock.model') ?? this.getDefaultModel();
		const encodedModel = encodeURIComponent(modelId);
		const auth: AuthDef = config.apiKey
			? { kind: 'bearer', token: config.apiKey }
			: { kind: 'none' };
		return {
			id: this.id,
			protocol: this.protocol,
			endpoint: `${baseURL}/model/${encodedModel}/invoke-with-response-stream`,
			auth
		};
	}
}
