/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../base/common/event.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IDisposable } from '../../base/common/lifecycle.js';
import { BackendHttpClient } from './httpClient.js';

/**
 * Backend connection state
 */
export type BackendConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Backend server info
 */
export interface IBackendServerInfo {
	/** Server port */
	readonly port: number;
	/** Auth password */
	readonly password: string;
	/** Base URL */
	readonly baseUrl: string;
}

/**
 * Backend connection state change event
 */
export interface BackendStateChangeEvent {
	readonly state: BackendConnectionState;
	readonly error?: string;
}

/**
 * Backend service interface - manages the lifecycle of the CLI backend process
 * and provides access to the HTTP/SSE clients.
 */
export interface IBackendService extends IDisposable {
	readonly _serviceBrand: undefined;

	/**
	 * Current connection state
	 */
	readonly state: BackendConnectionState;

	/**
	 * Get server info if connected
	 */
	getServerInfo(): IBackendServerInfo | undefined;

	/**
	 * Ensure the backend is connected, starting it if necessary
	 */
	ensureConnected(workspaceDir?: string): Promise<void>;

	/**
	 * Disconnect from the backend
	 */
	disconnect(): Promise<void>;

	/**
	 * Send an HTTP request to the backend
	 */
	request<T>(path: string, options?: BackendRequestOptions): Promise<T>;

	/**
	 * Subscribe to SSE events from the backend
	 */
	subscribeToEvents(handler: (event: BackendSSEEvent) => void): IDisposable;

	/**
	 * Event fired when connection state changes
	 */
	readonly onDidChangeState: Event<BackendStateChangeEvent>;

	/**
	 * Get the workspace directory the backend is connected to
	 */
	getWorkspaceDirectory(): string | undefined;

	/**
	 * Direct access to the HTTP client for typed session/message calls
	 */
	getHttpClient(): BackendHttpClient | null; // Trigger watcher refresh
}

/**
 * Backend request options
 */
export interface BackendRequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	body?: unknown;
	headers?: Record<string, string>;
	signal?: AbortSignal;
	directory?: string;
}

/**
 * Backend SSE event (raw, before typing)
 */
export interface BackendSSEEvent {
	readonly type: string;
	readonly data: unknown;
}

export const IBackendService = createDecorator<IBackendService>('backendService');
