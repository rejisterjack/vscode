/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Prompt templates for code actions (explain, fix, improve, add to context).
 * Each template is filled with `${filePath}`, `${startLine}`, `${endLine}`,
 * `${selectedText}`, and `${diagnostics}`.
 *
 * Port of `references/kilocode/packages/kilo-vscode/src/services/code-actions/support-prompt.ts:27-101`.
 */
export interface SupportPromptParams {
	readonly filePath: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly selectedText: string;
	readonly diagnostics?: string;
}

export const EXPLAIN_PROMPT = 'Explain the following code from `${filePath}` (lines ${startLine}-${endLine}). Provide a clear, concise explanation of what the code does, how it works, and any notable patterns or potential issues.\n\n```\n${selectedText}\n${diagnostics}\n```';

export const FIX_PROMPT = 'Fix the following code from `${filePath}` (lines ${startLine}-${endLine}). Analyze the diagnostics, identify the root cause, and provide the corrected code.\n\nCurrent code:\n```\n${selectedText}\n${diagnostics}\n```';

export const IMPROVE_PROMPT = 'Improve the following code from `${filePath}` (lines ${startLine}-${endLine}). Refactor for readability, performance, and maintainability while preserving behavior. Explain your changes.\n\nCurrent code:\n```\n${selectedText}\n```';

export const ADD_TO_CONTEXT_PROMPT = '${filePath} (lines ${startLine}-${endLine}):\n```\n${selectedText}\n```';

export const TERMINAL_FIX_PROMPT = 'Fix the following terminal error:\n\nCommand output:\n```\n${selectedText}\n```';

export const TERMINAL_EXPLAIN_PROMPT = 'Explain the following terminal output:\n\n```\n${selectedText}\n```';

export const TERMINAL_ADD_TO_CONTEXT_PROMPT = 'Terminal output:\n```\n${selectedText}\n```';

export type SupportPromptType = 'EXPLAIN' | 'FIX' | 'IMPROVE' | 'ADD_TO_CONTEXT' | 'TERMINAL_FIX' | 'TERMINAL_EXPLAIN' | 'TERMINAL_ADD_TO_CONTEXT';

const PROMPTS: Record<SupportPromptType, string> = {
	EXPLAIN: EXPLAIN_PROMPT,
	FIX: FIX_PROMPT,
	IMPROVE: IMPROVE_PROMPT,
	ADD_TO_CONTEXT: ADD_TO_CONTEXT_PROMPT,
	TERMINAL_FIX: TERMINAL_FIX_PROMPT,
	TERMINAL_EXPLAIN: TERMINAL_EXPLAIN_PROMPT,
	TERMINAL_ADD_TO_CONTEXT: TERMINAL_ADD_TO_CONTEXT_PROMPT
};

/**
 * Render a support prompt template with the given params.
 */
export function renderSupportPrompt(type: SupportPromptType, params: SupportPromptParams): string {
	const template = PROMPTS[type];
	return template
		.replaceAll('${filePath}', params.filePath)
		.replaceAll('${startLine}', String(params.startLine))
		.replaceAll('${endLine}', String(params.endLine))
		.replaceAll('${selectedText}', params.selectedText)
		.replaceAll('${diagnostics}', params.diagnostics ?? '');
}
