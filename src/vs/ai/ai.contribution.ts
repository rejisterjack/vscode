/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../base/common/lifecycle.js';
import { Emitter, Event } from '../base/common/event.js';
import { InstantiationType, registerSingleton } from '../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../platform/instantiation/common/instantiation.js';
import { IAIService, AIRequest, IProviderRegistry } from './common/types/provider.types.js';
import { IChatService } from './common/types/conversation.types.js';
import { IContextManager } from './common/types/context.types.js';
import { ProviderRegistry } from './provider/common/providerRegistry.js';
import { IBackendService, BackendConnectionState, IBackendServerInfo, BackendStateChangeEvent, BackendRequestOptions, BackendSSEEvent } from './backend/backendService.js';
import { ConnectionService } from './backend/connectionService.js';
import { BackendHttpClient } from './backend/httpClient.js';
import { ContextManager } from './context/contextManager.js';
import { ChatService as ChatServiceImpl } from './chat/chatService.js';
import { IAttentionService, AttentionService } from './common/attentionService.js';
import { AIResponse, AIResponseChunk } from './common/types/ai.types.js';
import { IModelsDevCatalog, ModelsDevCatalog } from './provider/common/modelsDevCatalog.js';
import { IPromptEnhancementService, PromptEnhancementService } from './enhance/promptEnhancementService.js';
import { ICommitMessageService, CommitMessageService } from './scm/commitMessageService.js';
import { IAgentLoop, AgentLoop } from './agent/agentLoop.js';
import { IFewStepsAwayAuthService, FewStepsAwayAuthService } from './auth/fewStepsAwayAuthService.js';
import { registerLLMProviders } from './provider/providers.contribution.js';
import { registerBuiltinTools } from './tool/tools.contribution.js';
import { IModeRegistry } from './mode/modeRegistry.js';
import { registerBuiltinModes } from './mode/modes.contribution.js';
import { registerCodeActions } from './codeActions/codeActions.contribution.js';
import { IAutocompleteServiceManager } from './suggestion/autocompleteServiceManager.js';
import { IRateLimiterService, RateLimiter } from './common/rateLimiter.js';
import { IIndexManager } from './indexing/indexTypes.js';
import { IMcpToolBridge } from './mcp/mcpToolBridge.js';
import './agent/agentPermission.contribution.js';
import './agent/backgroundAgentService.js';
import './scm/worktreeService.js';
import './review/reviewFindingsService.js';
import './integrity/editIntegrityService.js';
import './integrity/workspaceTaskRunner.js';
import './indexing/embeddingService.js';
import './rules/rulesLoader.js';

/**
 * Minimal AIService implementation.
 * Will be expanded in later phases with provider delegation, rate limiting, etc.
 */
export class AIService extends Disposable implements IAIService {
	readonly _serviceBrand: undefined;

	private providersRegistered = false;

	constructor(
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IRateLimiterService private readonly rateLimiter: IRateLimiterService
	) {
		super();
		this.ensureRegistered();
	}

	/**
	 * Lazily register all LLM providers, tools, and modes. Safe to call
	 * multiple times -- does nothing after the first registration.
	 */
	private ensureRegistered(): void {
		if (this.providersRegistered) { return; }
		this.providersRegistered = true;
		try {
			registerLLMProviders(this.instantiationService, this.providerRegistry);
			registerBuiltinTools(this.instantiationService);
			const modeRegistry = this.instantiationService.invokeFunction(accessor => accessor.get(IModeRegistry));
			registerBuiltinModes(modeRegistry);
			registerCodeActions(this.instantiationService);
			this.instantiationService.invokeFunction(accessor => accessor.get(IAutocompleteServiceManager)).ensureProviderRegistered();
			// Warm MCP bridge and indexing services
			this.instantiationService.invokeFunction(accessor => {
				accessor.get(IMcpToolBridge).refresh();
				const indexManager = accessor.get(IIndexManager);
				void indexManager.indexWorkspace();
			});
		} catch (err) {
			// Registration failures must not crash the workbench.
			console.error('[AIService] Failed to register AI providers/tools/modes:', err);
		}
	}

	private readonly _onWillSendRequest = this._register(new Emitter<AIRequest>());
	readonly onWillSendRequest: Event<AIRequest> = this._onWillSendRequest.event;

	private readonly _onDidReceiveResponse = this._register(new Emitter<{ request: AIRequest; response: AIResponse }>());
	readonly onDidReceiveResponse: Event<{ request: AIRequest; response: AIResponse }> = this._onDidReceiveResponse.event;

	private readonly _onDidEncounterError = this._register(new Emitter<{ request: AIRequest; error: Error }>());
	readonly onDidEncounterError: Event<{ request: AIRequest; error: Error }> = this._onDidEncounterError.event;

	async sendRequest(request: AIRequest): Promise<AIResponse> {
		const provider = this.providerRegistry.getActiveProvider();
		if (!provider) {
			throw new Error('No active AI provider');
		}
		const tokenEstimate = this.estimateTokens(request.query ?? '');
		if (!this.rateLimiter.canMakeRequest(provider.id, tokenEstimate)) {
			const waitMs = this.rateLimiter.getTimeUntilNextRequest(provider.id);
			throw new Error(`Rate limit exceeded. Retry in ${Math.ceil(waitMs / 1000)}s.`);
		}
		this._onWillSendRequest.fire(request);
		try {
			const response = await provider.sendRequest(request);
			this.rateLimiter.recordRequest(provider.id, response.tokensUsed ?? tokenEstimate);
			this._onDidReceiveResponse.fire({ request, response });
			return response;
		} catch (error) {
			this._onDidEncounterError.fire({ request, error: error instanceof Error ? error : new Error(String(error)) });
			throw error;
		}
	}

	async *streamRequest(request: AIRequest): AsyncIterable<AIResponseChunk> {
		const provider = this.providerRegistry.getActiveProvider();
		if (!provider) {
			throw new Error('No active AI provider');
		}
		this._onWillSendRequest.fire(request);
		yield* provider.streamRequest(request);
	}

	getProviderRegistry(): IProviderRegistry {
		return this.providerRegistry;
	}

	async switchProvider(providerId: string): Promise<void> {
		this.providerRegistry.setActiveProvider(providerId);
	}

	getCurrentProvider(): { id: string; name: string; model: string } | undefined {
		const provider = this.providerRegistry.getActiveProvider();
		return provider ? { id: provider.id, name: provider.name, model: '' } : undefined;
	}

	estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}

	isProviderAvailable(providerId: string): boolean {
		return !!this.providerRegistry.getProvider(providerId);
	}
}

/**
 * BackendService implementation -- thin facade over ConnectionService.
 * Manages the CLI backend lifecycle and provides typed HTTP/SSE access.
 */
export class BackendService extends Disposable implements IBackendService {
	readonly _serviceBrand: undefined;

	private readonly connection: ConnectionService;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();
		this.connection = this._register(instantiationService.createInstance(ConnectionService));
	}

	get state(): BackendConnectionState {
		return this.connection.state;
	}

	getServerInfo(): IBackendServerInfo | undefined {
		const server = this.connection.getServerInfo();
		if (!server) { return undefined; }
		return {
			port: server.port,
			password: server.password,
			baseUrl: `http://127.0.0.1:${server.port}`
		};
	}

	async ensureConnected(workspaceDir?: string): Promise<void> {
		return this.connection.ensureConnected(workspaceDir);
	}

	async disconnect(): Promise<void> {
		return this.connection.disconnect();
	}

	async request<T>(path: string, options?: BackendRequestOptions): Promise<T> {
		await this.ensureConnected();
		const client = this.connection.getHttpClient();
		if (!client) {
			throw new Error('Backend not connected');
		}
		// Delegate typed requests via the HttpClient's convenience methods where possible.
		// For ad-hoc requests, use a direct fetch through the client's internal helper.
		return client.requestJson<T>(path, options ?? {});
	}

	subscribeToEvents(handler: (event: BackendSSEEvent) => void): IDisposable {
		return this.connection.subscribeToEvents(handler);
	}

	get onDidChangeState(): Event<BackendStateChangeEvent> {
		return this.connection.onDidChangeState;
	}

	getWorkspaceDirectory(): string | undefined {
		return this.connection.getWorkspaceDirectory();
	}

	/** Direct access to the HTTP client for typed session/message calls */
	getHttpClient(): BackendHttpClient | null {
		return this.connection.getHttpClient();
	}
}

// --- Service registrations --------------------------------------------------

registerSingleton(IBackendService, BackendService, InstantiationType.Delayed);
registerSingleton(IChatService, ChatServiceImpl, InstantiationType.Delayed);
registerSingleton(IAIService, AIService, InstantiationType.Delayed);
registerSingleton(IContextManager, ContextManager, InstantiationType.Delayed);
registerSingleton(IProviderRegistry, ProviderRegistry, InstantiationType.Delayed);
registerSingleton(IAttentionService, AttentionService, InstantiationType.Delayed);
registerSingleton(IModelsDevCatalog, ModelsDevCatalog, InstantiationType.Delayed);
registerSingleton(IPromptEnhancementService, PromptEnhancementService, InstantiationType.Delayed);
registerSingleton(ICommitMessageService, CommitMessageService, InstantiationType.Delayed);
registerSingleton(IAgentLoop, AgentLoop, InstantiationType.Delayed);
registerSingleton(IFewStepsAwayAuthService, FewStepsAwayAuthService, InstantiationType.Eager);
registerSingleton(IRateLimiterService, RateLimiter, InstantiationType.Delayed);
