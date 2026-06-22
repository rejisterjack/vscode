/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { IAIServerInstanceInfo } from './types/serverManager.types.js';

/**
 * IPC channel name shared between the main-process server
 * and the renderer/sandbox client.
 */
export const AI_SERVER_CHANNEL = 'aiServer';

/**
 * Commands supported over the AI server IPC channel.
 */
export enum AIServerCommand {
	GetServer = 'GetServer',
	DisposeServer = 'DisposeServer',
	IsRunning = 'IsRunning',
}

/**
 * Argument shape for {@link AIServerCommand.GetServer}.
 */
export interface IGetServerArgs {
	readonly workspaceDir?: string;
}

/**
 * Wire format for the {@link AIServerCommand.GetServer} response.
 * Kept as a plain object so it can cross IPC without losing prototype info.
 */
export type IServerInfoDto = IAIServerInstanceInfo;
