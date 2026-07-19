/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ToolResult } from '../tool/toolTypes.js';

const EDIT_TOOLS = new Set(['edit', 'write', 'apply_patch']);

function isEditTool(toolId: string): boolean {
	return EDIT_TOOLS.has(toolId);
}

export function claimsEditWithoutTool(text: string): boolean {
	const lower = text.toLowerCase();
	const editPhrases = ['i\'ve updated', 'i have updated', 'i\'ve changed', 'file has been', 'applied the change', 'modified the file', 'here\'s the fix'];
	return editPhrases.some(p => lower.includes(p));
}

export function enrichValidationResult(
	result: ToolResult,
	toolName: string,
	fixAttempts: number,
	maxAttempts: number,
): ToolResult {
	if (!isEditTool(toolName) || !result.validation || result.validation.ok) {
		return result;
	}
	if (fixAttempts >= maxAttempts) {
		const diagSource = result.validation.newDiagnostics?.length
			? result.validation.newDiagnostics
			: result.validation.diagnostics;
		const diagLines = diagSource
			.filter(d => d.severity === 'error')
			.slice(0, 10)
			.map(d => `- line ${d.line}: ${d.message}`);
		const appendix = [
			'',
			'AUTO-FIX LIMIT REACHED — validation errors remain:',
			...diagLines,
			'Fix these manually or ask the user how to proceed.',
		].join('\n');
		const output = typeof result.output === 'string' ? result.output + appendix : appendix;
		return { ...result, output };
	}
	const diagSource = result.validation.newDiagnostics?.length
		? result.validation.newDiagnostics
		: result.validation.diagnostics;
	const diagLines = diagSource
		.filter(d => d.severity === 'error')
		.slice(0, 15)
		.map(d => `- line ${d.line}: ${d.message}`);
	const appendix = [
		'',
		'EDIT FAILED VALIDATION — fix these errors before continuing:',
		...diagLines,
	].join('\n');
	const output = typeof result.output === 'string' ? result.output + appendix : appendix;
	return { ...result, output };
}
