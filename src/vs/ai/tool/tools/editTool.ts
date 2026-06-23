/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITextFileService } from '../../../workbench/services/textfile/common/textfiles.js';
import { URI } from '../../../base/common/uri.js';
import { ITool, ToolResult } from '../toolTypes.js';

/**
 * Edit a file via exact string replacement. Port of
 * `references/kilocode/packages/opencode/src/tool/edit.ts`.
 */
export class EditFileTool implements ITool {
	readonly id = 'edit';
	readonly description = 'Perform exact string replacements in a file. The `oldString` must appear exactly once in the file unless `replaceAll` is true. Prefer this over `write` for targeted changes.';
	readonly parameters = {
		type: 'object',
		properties: {
			filePath: { type: 'string', description: 'The absolute or workspace-relative path of the file to edit.' },
			oldString: { type: 'string', description: 'The exact text to replace (must match uniquely).' },
			newString: { type: 'string', description: 'The replacement text.' },
			replaceAll: { type: 'boolean', description: 'Replace all occurrences of oldString. Optional; defaults to false.' }
		},
		required: ['filePath', 'oldString', 'newString']
	};

	constructor(
		@ITextFileService private readonly textFileService: ITextFileService
	) { }

	async execute(args: { filePath: string; oldString: string; newString: string; replaceAll?: boolean }): Promise<ToolResult> {
		const uri = URI.file(args.filePath);
		const content = await this.textFileService.read(uri);
		const text = content.value;

		if (args.oldString === args.newString) {
			throw new Error('oldString and newString must be different');
		}

		const occurrences = countOccurrences(text, args.oldString);
		if (occurrences === 0) {
			throw new Error(`oldString not found in ${args.filePath}`);
		}
		if (occurrences > 1 && !args.replaceAll) {
			throw new Error(`oldString appears ${occurrences} times in ${args.filePath}. Provide more context to make it unique, or set replaceAll: true.`);
		}

		const newText = args.replaceAll
			? text.split(args.oldString).join(args.newString)
			: text.replace(args.oldString, args.newString);

		await this.textFileService.write(uri, newText);

		return {
			title: `Edit ${args.filePath}`,
			output: `Edited ${args.filePath}: replaced ${args.replaceAll ? occurrences : 1} occurrence(s).`
		};
	}
}

function countOccurrences(haystack: string, needle: string): number {
	if (!needle) { return 0; }
	let count = 0;
	let idx = haystack.indexOf(needle);
	while (idx !== -1) {
		count++;
		idx = haystack.indexOf(needle, idx + needle.length);
	}
	return count;
}
