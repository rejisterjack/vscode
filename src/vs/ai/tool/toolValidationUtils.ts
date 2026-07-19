/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditValidationResult } from '../integrity/editIntegrityTypes.js';
import { ToolValidationResult } from './toolTypes.js';

export function toToolValidationResult(validation: EditValidationResult): ToolValidationResult {
	const mapDiag = (d: { line: number; message: string; severity: string }) => ({
		line: d.line,
		message: d.message,
		severity: d.severity,
	});
	return {
		ok: validation.ok,
		errorsBefore: validation.errorsBefore,
		errorsAfter: validation.errorsAfter,
		diagnostics: validation.diagnostics.map(mapDiag),
		newDiagnostics: validation.newDiagnostics.map(mapDiag),
	};
}
