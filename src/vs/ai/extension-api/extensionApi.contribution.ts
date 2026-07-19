/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../base/common/lifecycle.js';
import { IAIExtensionApi, IExtensionContextProvider } from './aiExtensionApi.js';
import { ITool } from '../tool/toolTypes.js';
import { IToolRegistry } from '../tool/toolRegistry.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';

export class AIExtensionApi extends Disposable implements IAIExtensionApi {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IToolRegistry private readonly toolRegistry: IToolRegistry
	) {
		super();
	}

	registerTool(tool: ITool): IDisposable {
		this.toolRegistry.register(tool);
		return { dispose: () => { /* tools are not unregistered today */ } };
	}

	registerContextProvider(_provider: IExtensionContextProvider): IDisposable {
		// Context providers will be wired into IContextManager in a follow-up.
		return Disposable.None;
	}
}

registerSingleton(IAIExtensionApi, AIExtensionApi, InstantiationType.Delayed);
