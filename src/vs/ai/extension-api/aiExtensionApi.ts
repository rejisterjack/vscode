/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { ITool } from '../tool/toolTypes.js';

export const IAIExtensionApi = createDecorator<IAIExtensionApi>('ai.extensionApi');

/**
 * Public extension API for third-party integrations with FewStepsAway AI.
 */
export interface IAIExtensionApi {
	readonly _serviceBrand: undefined;

	/** Register a custom tool available to the agent loop. */
	registerTool(tool: ITool): { dispose(): void };

	/** Register a context provider that contributes snippets to chat context. */
	registerContextProvider(provider: IExtensionContextProvider): { dispose(): void };
}

export interface IExtensionContextProvider {
	readonly id: string;
	readonly label: string;
	provideContext(): Promise<{ snippets: string[]; priority: number }>;
}
