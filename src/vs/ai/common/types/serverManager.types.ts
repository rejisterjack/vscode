/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export const IAIServerManagerService = createDecorator<IAIServerManagerService>('aiServerManagerService');

/**
 * Serializable snapshot of a running CLI backend instance.
 * The native (main-process) owner keeps the ChildProcess; the renderer
 * only ever sees this plain-data view via IPC.
 */
export interface IAIServerInstanceInfo {
	readonly port: number;
	readonly password: string;
}

/**
 * Backend lifecycle service. The renderer-facing contract intentionally
 * exposes only serializable types — the actual `ChildProcess` is owned
 * by the main-process implementation.
 */
export interface IAIServerManagerService {
	readonly _serviceBrand: undefined;

	/**
	 * Resolves with connection info for the CLI backend, starting it if necessary.
	 * Concurrent callers share the same startup promise.
	 */
	getServer(workspaceDir?: string): Promise<IAIServerInstanceInfo>;

	/**
	 * Stops the CLI backend, if one is currently running.
	 */
	disposeServer(): Promise<void>;

	/**
	 * Whether a backend process is currently believed to be running.
	 */
	readonly isRunning: boolean;
}
