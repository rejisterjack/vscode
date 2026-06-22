/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { IChannel } from '../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../platform/ipc/common/mainProcessService.js';
import { AI_SERVER_CHANNEL, AIServerCommand, IGetServerArgs, IServerInfoDto } from '../common/serverManagerIpc.js';
import { IAIServerInstanceInfo, IAIServerManagerService } from '../common/types/serverManager.types.js';

/**
 * Renderer-side proxy for the AI CLI server lifecycle service.
 *
 * The actual `ChildProcess` lives in the main process (see
 * `AIServerMainService`); this client only ever exchanges
 * serializable data over IPC.
 */
export class AIServerService extends Disposable implements IAIServerManagerService {
	declare readonly _serviceBrand: undefined;

	private readonly channel: IChannel;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService
	) {
		super();
		this.channel = mainProcessService.getChannel(AI_SERVER_CHANNEL);
	}

	get isRunning(): boolean {
		// Best-effort synchronous flag; the authoritative value lives in main.
		// Renderer consumers should rely on getServer()/disposeServer() for state changes.
		return false;
	}

	async getServer(workspaceDir?: string): Promise<IAIServerInstanceInfo> {
		const args: IGetServerArgs = workspaceDir ? { workspaceDir } : {};
		const info = await this.channel.call<IServerInfoDto>(AIServerCommand.GetServer, args);
		return { port: info.port, password: info.password };
	}

	async disposeServer(): Promise<void> {
		await this.channel.call<void>(AIServerCommand.DisposeServer);
	}
}

registerSingleton(IAIServerManagerService, AIServerService, InstantiationType.Delayed);
