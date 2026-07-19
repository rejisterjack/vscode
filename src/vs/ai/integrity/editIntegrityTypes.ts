/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../base/common/uri.js';

export interface EditDiagnostic {
	readonly line: number;
	readonly message: string;
	readonly severity: 'error' | 'warning' | 'info' | 'hint';
}

export interface EditValidationResult {
	readonly ok: boolean;
	readonly errorsBefore: number;
	readonly errorsAfter: number;
	readonly warningsBefore: number;
	readonly warningsAfter: number;
	readonly diagnostics: readonly EditDiagnostic[];
	readonly newDiagnostics: readonly EditDiagnostic[];
}

export interface EditSnapshot {
	readonly uri: URI;
	readonly content: string;
	readonly errorsBefore: number;
	readonly warningsBefore: number;
	readonly diagnosticsBefore: readonly EditDiagnostic[];
}

export interface SafeWriteOptions {
	readonly skipValidation?: boolean;
	readonly composerStaged?: boolean;
}
