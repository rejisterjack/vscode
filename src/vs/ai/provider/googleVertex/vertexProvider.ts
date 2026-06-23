/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProtocolBackedProvider, DEFAULT_TOOL_CAPABILITIES } from '../common/protocolBackedProvider.js';
import { LLMProtocol, ProviderRoute, AuthDef } from '../common/llmProtocol.js';
import { ProviderCapabilities } from '../../common/types/ai.types.js';
import { anthropicMessagesProtocol } from '../protocols/anthropicMessages.js';

/**
 * Google Vertex AI provider (Anthropic models hosted on Vertex). Uses ADC
 * (Application Default Credentials) for auth. Users must run
 * `gcloud auth application-default login` and set the project/location.
 *
 * The Vertex-hosted Anthropic endpoint uses the same Messages API wire
 * format, but auth is an OAuth2 bearer token instead of an API key.
 */
export class VertexProvider extends ProtocolBackedProvider {
	readonly id = 'google-vertex';
	readonly name = 'Google Vertex AI';
	readonly capabilities: ProviderCapabilities = {
		...DEFAULT_TOOL_CAPABILITIES,
		maxContextLength: 200000
	};

	protected readonly protocol: LLMProtocol = anthropicMessagesProtocol;
	protected readonly configPrefix = 'ai.provider.google-vertex';

	protected getDefaultEndpoint(): string {
		const project = this.configService.getValue<string>('ai.provider.google-vertex.project') ?? 'YOUR_PROJECT';
		const location = this.configService.getValue<string>('ai.provider.google-vertex.location') ?? 'us-east5';
		return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}`;
	}

	protected getDefaultModel(): string {
		return 'claude-sonnet-4-5-20250929';
	}

	/**
	 * Auth: OAuth2 access token from `gcloud auth print-access-token`. The
	 * token is short-lived; users must refresh it. A production
	 * implementation would use `google-auth-library` to auto-refresh.
	 */
	protected buildRoute(config: { apiKey?: string; endpoint?: string }): ProviderRoute {
		const baseURL = config.endpoint || this.getDefaultEndpoint();
		const accessToken = this.configService.getValue<string>('ai.provider.google-vertex.accessToken') ?? '';
		const auth: AuthDef = accessToken
			? { kind: 'bearer', token: accessToken }
			: { kind: 'none' };
		return {
			id: this.id,
			protocol: this.protocol,
			endpoint: `${baseURL}/publishers/anthropic/models/${this.configService.getValue('ai.provider.google-vertex.model') ?? this.getDefaultModel()}:streamRawPredict`,
			auth
		};
	}
}
