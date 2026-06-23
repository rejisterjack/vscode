/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRequestService } from '../../../platform/request/common/request.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { BaseAIProvider, IAIProvider } from './aiProvider.js';
import { AIRequestContext, AIResponse, AIResponseChunk, ProviderCapabilities, ProviderConfig } from '../../common/types/ai.types.js';
import {
	LLMProtocol, ProviderRoute, LLMRequest, ModelRef,
	Message, SystemPart, ToolDefinition, ToolChoice, GenerationOptions, CachePolicy,
	streamRoute, generateRoute, StreamResult
} from './llmProtocol.js';
import { LLMEvent } from './llmEvent.js';
import { CatalogModel } from './modelsDevCatalog.js';

/**
 * Common capabilities for tool-calling providers.
 */
export const DEFAULT_TOOL_CAPABILITIES: ProviderCapabilities = {
	supportsStreaming: true,
	supportsSystemMessages: true,
	supportsFunctionCalling: true,
	maxContextLength: 200000,
	supportedModes: ['coding', 'architect', 'debug', 'learning']
};

/**
 * A tool-enabled request. Extends the legacy `AIRequestContext` with the
 * structured message/tools shape needed for tool-calling providers.
 */
export interface ToolEnabledRequest {
	readonly model: ModelRef;
	readonly system: readonly SystemPart[];
	readonly messages: readonly Message[];
	readonly tools?: readonly ToolDefinition[];
	readonly toolChoice?: ToolChoice;
	readonly generation?: GenerationOptions;
	readonly cache?: CachePolicy;
}

/**
 * Extended provider interface that supports the new tool-calling / streaming
 * API. Concrete providers implement this; the legacy `IAIProvider` methods
 * (`sendRequest`/`streamRequest`) are provided by `ProtocolBackedProvider`
 * via adapters.
 */
export interface IToolEnabledProvider extends IAIProvider {
	/**
	 * Stream a tool-enabled request, yielding normalized `LLMEvent`s.
	 */
	streamWithTools(request: ToolEnabledRequest): AsyncIterable<LLMEvent>;
	/**
	 * Run a tool-enabled request to completion.
	 */
	generateWithTools(request: ToolEnabledRequest): Promise<StreamResult>;
	/**
	 * Get all models from this provider (from catalog or live API).
	 */
	getModels(): Promise<readonly CatalogModel[]>;
}

/**
 * Base class for providers backed by an `LLMProtocol` + `ProviderRoute`.
 *
 * Concrete providers (Anthropic, OpenAI, etc.) extend this class and supply
 * their protocol and a factory for the route (which depends on the user's
 * config: API key, endpoint). All HTTP/streaming logic is shared here.
 */
export abstract class ProtocolBackedProvider extends BaseAIProvider implements IToolEnabledProvider {
	private _modelsCache: readonly CatalogModel[] | undefined;

	constructor(
		@IRequestService protected readonly requestService: IRequestService,
		@IConfigurationService protected readonly configService: IConfigurationService
	) {
		super();
	}

	/** The protocol this provider uses (e.g. Anthropic Messages, OpenAI Chat). */
	protected abstract readonly protocol: LLMProtocol;

	/** Build the route for the current configuration. Called per-request. */
	protected abstract buildRoute(config: ProviderConfig): ProviderRoute;

	/** Get the config key prefix for this provider (e.g. "ai.provider.anthropic"). */
	protected abstract readonly configPrefix: string;

	/**
	 * Read the provider config from VS Code settings.
	 */
	protected getConfig(): ProviderConfig {
		const apiKey = this.configService.getValue<string>(`${this.configPrefix}.apiKey`) ?? '';
		const endpoint = this.configService.getValue<string>(`${this.configPrefix}.endpoint`) ?? this.getDefaultEndpoint();
		const defaultModel = this.configService.getValue<string>(`${this.configPrefix}.model`) ?? this.getDefaultModel();
		const enabled = this.configService.getValue<boolean>(`${this.configPrefix}.enabled`) ?? true;
		return {
			providerId: this.id,
			apiKey,
			endpoint,
			defaultModel,
			enabled
		};
	}

	/** Default endpoint; subclasses override. */
	protected abstract getDefaultEndpoint(): string;

	protected async doInitialize(): Promise<void> {
		this.config = this.getConfig();
	}

	/**
	 * Stream a tool-enabled request.
	 */
	async *streamWithTools(request: ToolEnabledRequest): AsyncIterable<LLMEvent> {
		const config = this.getConfig();
		if (!config.apiKey && this.requiresApiKey()) {
			yield { type: 'provider-error', message: `${this.name} API key is not configured. Set "${this.configPrefix}.apiKey".`, retryable: false };
			return;
		}
		const route = this.buildRoute(config);
		const llmRequest: LLMRequest = {
			model: request.model,
			system: request.system,
			messages: request.messages,
			tools: request.tools,
			toolChoice: request.toolChoice,
			generation: request.generation,
			cache: request.cache
		};
		yield* streamRoute(route, llmRequest, this.requestService);
	}

	/**
	 * Run a tool-enabled request to completion.
	 */
	async generateWithTools(request: ToolEnabledRequest): Promise<StreamResult> {
		const config = this.getConfig();
		if (!config.apiKey && this.requiresApiKey()) {
			throw new Error(`${this.name} API key is not configured. Set "${this.configPrefix}.apiKey".`);
		}
		const route = this.buildRoute(config);
		const llmRequest: LLMRequest = {
			model: request.model,
			system: request.system,
			messages: request.messages,
			tools: request.tools,
			toolChoice: request.toolChoice,
			generation: request.generation,
			cache: request.cache
		};
		return generateRoute(route, llmRequest, this.requestService);
	}

	/**
	 * Legacy `sendRequest` -- adapts a plain `AIRequestContext` into a
	 * tool-enabled request with no tools.
	 */
	async sendRequest(context: AIRequestContext): Promise<AIResponse> {
		this.validateInitialized();
		const config = this.getConfig();
		const result = await this.generateWithTools(this.contextToRequest(context, config));
		const usage = result.usage;
		const tokensUsed = usage?.totalTokens ?? usage?.inputTokens ?? 0;
		return {
			content: result.text,
			tokensUsed,
			inputTokens: usage?.inputTokens,
			outputTokens: usage?.outputTokens,
			provider: this.id,
			model: context.model ?? config.defaultModel,
			latency: 0,
			finishReason: result.finishReason ?? 'stop'
		};
	}

	/**
	 * Legacy `streamRequest` -- adapts a plain `AIRequestContext` into a
	 * tool-enabled request with no tools, yielding text deltas.
	 */
	async *streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk> {
		this.validateInitialized();
		const config = this.getConfig();
		for await (const event of this.streamWithTools(this.contextToRequest(context, config))) {
			if (event.type === 'text-delta') {
				yield { content: event.text, isComplete: false };
			} else if (event.type === 'finish' || event.type === 'step-finish') {
				yield {
					content: '',
					isComplete: true,
					metadata: {
						tokensUsed: event.usage?.totalTokens,
						finishReason: (event as { reason?: string }).reason
					}
				};
			} else if (event.type === 'provider-error') {
				throw new Error(event.message);
			}
		}
	}

	/**
	 * Get available model ids (legacy interface).
	 */
	async getAvailableModels(): Promise<string[]> {
		const models = await this.getModels();
		return models.map(m => m.id);
	}

	/**
	 * Get full model info from catalog or live API.
	 */
	async getModels(): Promise<readonly CatalogModel[]> {
		if (this._modelsCache) { return this._modelsCache; }
		// Subclasses override `fetchModels` to hit the catalog or the live API.
		try {
			this._modelsCache = await this.fetchModels();
		} catch {
			this._modelsCache = this.getStaticModels();
		}
		return this._modelsCache;
	}

	/** Fetch models from the catalog or provider's /models endpoint. */
	protected async fetchModels(): Promise<readonly CatalogModel[]> {
		// Default: use static models. Subclasses can override to hit /models.
		return this.getStaticModels();
	}

	/** Static fallback models. Subclasses override. */
	protected getStaticModels(): CatalogModel[] {
		return [];
	}

	async validateConfig(): Promise<boolean> {
		const config = this.getConfig();
		return !this.requiresApiKey() || !!config.apiKey;
	}

	async shutdown(): Promise<void> {
		// Nothing to clean up -- stateless HTTP.
	}

	/** Whether this provider requires an API key. Local providers (Ollama) override to false. */
	protected requiresApiKey(): boolean {
		return true;
	}

	/**
	 * Convert a legacy `AIRequestContext` into a tool-enabled request with
	 * a single user message.
	 */
	private contextToRequest(context: AIRequestContext, config: ProviderConfig): ToolEnabledRequest {
		const model: ModelRef = { id: context.model ?? config.defaultModel };
		const system: SystemPart[] = [
			{ type: 'text', text: this.buildSystemPrompt(context.mode) }
		];
		const userContent = this.buildUserContent(context);
		const messages: Message[] = [
			{ role: 'user', content: userContent }
		];
		const generation: GenerationOptions = {
			temperature: context.temperature,
			maxTokens: context.maxTokens
		};
		return { model, system, messages, generation };
	}

	/**
	 * Build the user message content from the context, embedding any code
	 * context (active file, open files) as text.
	 */
	private buildUserContent(context: AIRequestContext): string {
		let content = '';
		if (context.contextData?.currentFile) {
			const f = context.contextData.currentFile;
			content += `Active file: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\`\n\n`;
		}
		if (context.contextData?.openFiles?.length) {
			content += 'Other open files:\n';
			for (const f of context.contextData.openFiles) {
				content += `File: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\`\n\n`;
			}
		}
		content += `User Query: ${context.query}`;
		return content;
	}
}
