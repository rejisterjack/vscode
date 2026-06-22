/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { ILogService } from '../../platform/log/common/log.js';
import { IAIServerInstanceInfo, IAIServerManagerService } from '../common/types/serverManager.types.js';
import { BackendHttpClient } from './httpClient.js';
import { BackendSSEClient } from './sseClient.js';
import { BackendConnectionState, BackendStateChangeEvent, BackendSSEEvent } from './backendService.js';

const HEALTH_POLL_INTERVAL_MS = 10_000;

/**
 * Manages the connection to the CLI backend.
 *
 * Owns the ServerManager (process lifecycle), HttpClient (REST), and SSEClient
 * (event stream). Exposes a state machine (disconnected → connecting →
 * connected → error) and fans out SSE events to subscribers.
 *
 * Ported from the extension's ConnectionService.
 */
export class ConnectionService extends Disposable {

	private readonly serverManager: IAIServerManagerService;
	private httpClient: BackendHttpClient | null = null;
	private sseClient: BackendSSEClient | null = null;
	private serverInstance: IAIServerInstanceInfo | null = null;

	private connectionState: BackendConnectionState = 'disconnected';
	private connectPromise: Promise<void> | null = null;
	private workspaceDirectory: string | undefined;
	private healthTimer: ReturnType<typeof setInterval> | null = null;

	private readonly eventHandlers = new Set<(event: BackendSSEEvent) => void>();

	private readonly _onDidChangeState = this._register(new Emitter<BackendStateChangeEvent>());
	readonly onDidChangeState: Event<BackendStateChangeEvent> = this._onDidChangeState.event;

	private readonly _onDidReceiveEvent = this._register(new Emitter<BackendSSEEvent>());
	readonly onDidReceiveEvent: Event<BackendSSEEvent> = this._onDidReceiveEvent.event;

	constructor(
		@IAIServerManagerService serverManager: IAIServerManagerService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		this.serverManager = serverManager;
	}

	get state(): BackendConnectionState {
		return this.connectionState;
	}

	getServerInfo(): IAIServerInstanceInfo | null {
		return this.serverInstance;
	}

	getHttpClient(): BackendHttpClient | null {
		return this.httpClient;
	}

	getWorkspaceDirectory(): string | undefined {
		return this.workspaceDirectory;
	}

	async ensureConnected(workspaceDir?: string): Promise<void> {
		if (this.connectionState === 'connected' && this.httpClient) {
			return;
		}
		if (this.connectPromise) {
			return this.connectPromise;
		}
		this.workspaceDirectory = workspaceDir;
		this.connectPromise = this.doConnect();
		try {
			await this.connectPromise;
		} finally {
			this.connectPromise = null;
		}
	}

	private async doConnect(): Promise<void> {
		this.setState('connecting');
		try {
			const server = await this.serverManager.getServer(this.workspaceDirectory);
			this.serverInstance = server;

			const baseUrl = `http://127.0.0.1:${server.port}`;
			this.httpClient = new BackendHttpClient(baseUrl, server.password);

			this.sseClient = this._register(new BackendSSEClient(this.httpClient));
			this.sseClient.onEvent(event => {
				const sseEvent: BackendSSEEvent = { type: event.type, data: event.payload };
				this._onDidReceiveEvent.fire(sseEvent);
				for (const handler of this.eventHandlers) {
					try {
						handler(sseEvent);
					} catch (err) {
						this.logService.error('[ConnectionService] Event handler error:', err);
					}
				}
			});
			this.sseClient.onError(error => {
				this.logService.error('[ConnectionService] SSE error:', error);
			});
			this.sseClient.onStateChange(state => {
				if (state === 'disconnected' && this.connectionState === 'connected') {
					this.logService.warn('[ConnectionService] SSE disconnected unexpectedly');
				}
			});

			this.sseClient.connect();
			this.startHealthPolling();

			this.setState('connected');
			this.logService.info('[ConnectionService] Connected to CLI backend on port', server.port);
		} catch (error) {
			this.logService.error('[ConnectionService] Connection failed:', error);
			this.setState('error', error instanceof Error ? error.message : String(error));
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		this.stopHealthPolling();
		this.sseClient?.disconnect();
		await this.serverManager.disposeServer();
		this.httpClient = null;
		this.sseClient = null;
		this.serverInstance = null;
		this.setState('disconnected');
	}

	subscribeToEvents(handler: (event: BackendSSEEvent) => void): IDisposable {
		this.eventHandlers.add(handler);
		return { dispose: () => this.eventHandlers.delete(handler) };
	}

	private startHealthPolling(): void {
		this.stopHealthPolling();
		this.healthTimer = setInterval(async () => {
			if (!this.httpClient) { return; }
			const healthy = await this.httpClient.checkHealth();
			if (!healthy && this.connectionState === 'connected') {
				this.logService.warn('[ConnectionService] Health check failed — forcing SSE reconnect');
				this.sseClient?.reconnect();
			}
		}, HEALTH_POLL_INTERVAL_MS);
		(this.healthTimer as any).unref?.();
	}

	private stopHealthPolling(): void {
		if (this.healthTimer) {
			clearInterval(this.healthTimer);
			this.healthTimer = null;
		}
	}

	private setState(state: BackendConnectionState, error?: string): void {
		if (this.connectionState === state) { return; }
		this.connectionState = state;
		this._onDidChangeState.fire({ state, error });
	}

	override dispose(): void {
		this.stopHealthPolling();
		this.eventHandlers.clear();
		super.dispose();
	}
}
