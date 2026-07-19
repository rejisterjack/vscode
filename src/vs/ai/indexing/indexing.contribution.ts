/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { IIndexManager } from './indexTypes.js';
import { IndexManager } from './indexManager.js';

registerSingleton(IIndexManager, IndexManager, InstantiationType.Delayed);

export function registerIndexing(instantiationService: { createInstance: <T>(ctor: new (...args: never[]) => T) => T }): void {
	// Singleton registered above; trigger workspace index on first access via workbench contribution.
	void instantiationService;
}
