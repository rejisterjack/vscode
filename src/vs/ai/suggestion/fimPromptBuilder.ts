/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITextModel } from '../../editor/common/model.js';
import { Position } from '../../editor/common/core/position.js';

/**
 * A snippet of code used as context for FIM (fill-in-the-middle) completion.
 */
export interface CodeSnippet {
	readonly filePath: string;
	readonly text: string;
	readonly score: number;
}

/**
 * FIM (fill-in-the-middle) inputs: the code before the cursor, the code after,
 * and optional context snippets.
 */
export interface FimInputs {
	readonly prefix: string;
	readonly suffix: string;
	readonly language: string;
	readonly snippets: readonly CodeSnippet[];
}

/**
 * Extract the prefix and suffix from a text model at the given position.
 *
 * Port of `references/kilocode/packages/kilo-vscode/src/services/autocomplete/classic-auto-complete/FillInTheMiddle.ts`.
 */
export function extractPrefixSuffix(model: ITextModel, position: Position, contextLines = 100): { prefix: string; suffix: string } {
	const lineNumber = position.lineNumber;
	const column = position.column;

	const prefixEndLine = Math.max(1, lineNumber - contextLines);
	const prefixRange = {
		startLineNumber: prefixEndLine,
		startColumn: 1,
		endLineNumber: lineNumber,
		endColumn: column
	};
	const prefix = model.getValueInRange(prefixRange);

	const lineCount = model.getLineCount();
	const suffixEndLine = Math.min(lineCount, lineNumber + contextLines);
	const suffixRange = {
		startLineNumber: lineNumber,
		startColumn: column,
		endLineNumber: suffixEndLine,
		endColumn: suffixEndLine === lineNumber ? column : model.getLineMaxColumn(suffixEndLine)
	};
	const suffix = model.getValueInRange(suffixRange);

	return { prefix, suffix };
}

/**
 * Build the FIM prompt for the model. Different models expect different FIM
 * formats -- this uses a generic template that works with OpenAI-compatible
 * FIM endpoints and can be overridden per-provider.
 *
 * Port of `references/kilocode/packages/kilo-vscode/src/services/autocomplete/classic-auto-complete/FillInTheMiddle.ts`.
 */
export function buildFimPrompt(inputs: FimInputs, template?: FimTemplate): string {
	const tpl = template ?? DEFAULT_FIM_TEMPLATE;
	let prompt = tpl.prefix;
	prompt = prompt.replace('{prefix}', inputs.prefix);
	prompt = prompt.replace('{suffix}', inputs.suffix);
	prompt = prompt.replace('{language}', inputs.language);

	// Add context snippets before the prefix.
	if (inputs.snippets.length > 0) {
		const snippetText = inputs.snippets
			.map(s => `// ${s.filePath}\n${s.text}`)
			.join('\n\n');
		prompt = `// Relevant context:\n${snippetText}\n\n${prompt}`;
	}

	return prompt;
}

/**
 * FIM template: the prefix/suffix markers used by the model.
 */
export interface FimTemplate {
	readonly prefix: string;
}

/**
 * Default FIM template (OpenAI-compatible style).
 */
export const DEFAULT_FIM_TEMPLATE: FimTemplate = {
	prefix: '<|fim_prefix|>{prefix}<|fim_suffix|>{suffix}<|fim_middle|>'
};

/**
 * Anthropic/Claude FIM template (uses a prompt format Claude understands).
 */
export const CLAUDE_FIM_TEMPLATE: FimTemplate = {
	prefix: `Complete the code at the cursor. Return ONLY the completion, no explanations.\n\nLanguage: {language}\n\nCode before cursor:\n\`\`\`\n{prefix}\n\`\`\`\n\nCode after cursor:\n\`\`\`\n{suffix}\n\`\`\`\n\nCompletion:\n\`\`\`\n`
};
