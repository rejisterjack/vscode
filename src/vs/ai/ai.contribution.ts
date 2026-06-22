/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
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

/**
 * Minimal AIService implementation.
 * Will be expanded in later phases with provider delegation, rate limiting, etc.
 */
export class AIService extends Disposable implements IAIService {
	readonly _serviceBrand: undefined;

	constructor(
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry
	) {
		super();
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
		this._onWillSendRequest.fire(request);
		try {
			const response = await provider.sendRequest(request);
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
 * BackendService implementation — thin facade over ConnectionService.
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
registerSingleton(IChatService, ChatServiceImpl as any, InstantiationType.Delayed);
registerSingleton(IAIService, AIService as any, InstantiationType.Delayed);
registerSingleton(IContextManager, ContextManager as any, InstantiationType.Delayed);
registerSingleton(IProviderRegistry, ProviderRegistry as any, InstantiationType.Delayed);
registerSingleton(IAttentionService, AttentionService as any, InstantiationType.Delayed);
