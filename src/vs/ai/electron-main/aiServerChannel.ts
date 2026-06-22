/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../base/common/event.js';
import { IServerChannel } from '../../base/parts/ipc/common/ipc.js';
import { AIServerCommand, IGetServerArgs } from '../common/serverManagerIpc.js';
import { IAIServerManagerService } from '../common/types/serverManager.types.js';

/**
 * IPC channel implementation for the AI server lifecycle service.
 * Forwards renderer calls to the underlying {@link IAIServerManagerService}.
 */
export class AIServerChannel implements IServerChannel {

	constructor(private readonly service: IAIServerManagerService) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case AIServerCommand.GetServer: {
				const args = (arg ?? {}) as IGetServerArgs;
				return this.service.getServer(args.workspaceDir);
			}
			case AIServerCommand.DisposeServer:
				return this.service.disposeServer();
			case AIServerCommand.IsRunning:
				return this.service.isRunning;
			default:
				throw new Error(`Call not found: ${command}`);
		}
	}
}
