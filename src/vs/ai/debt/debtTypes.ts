/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../base/common/uri.js';

export const IDebtRadarService = createDecorator<IDebtRadarService>('ai.debtRadarService');

export interface DebtScore {
	readonly uri: URI;
	readonly score: number;
	readonly factors: string[];
}

export interface IDebtRadarService {
	readonly _serviceBrand: undefined;

	/** Compute debt score for a file (0-100, higher = more debt). */
	scoreFile(uri: URI, content: string): DebtScore;

	/** Get top debt hotspots in the workspace. */
	getHotspots(limit?: number): Promise<DebtScore[]>;
}
