/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { IComposerService } from '../../composer/composerTypes.js';
import { IEditIntegrityService } from '../../integrity/editIntegrityService.js';
import { ITool, ToolContext, ToolResult } from '../toolTypes.js';
import { countOccurrences } from './editStringUtils.js';
import { toToolValidationResult } from '../toolValidationUtils.js';

/**
 * Edit a file via exact string replacement with integrity validation.
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
			replaceAll: { type: 'boolean', description: 'Replace all occurrences of oldString. Optional; defaults to false.' },
			expectedHash: { type: 'string', description: 'Optional content hash from a prior read; rejects the edit if the file changed.' },
		},
		required: ['filePath', 'oldString', 'newString']
	};

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IComposerService private readonly composerService: IComposerService,
		@IEditIntegrityService private readonly editIntegrity: IEditIntegrityService,
	) { }

	async execute(args: { filePath: string; oldString: string; newString: string; replaceAll?: boolean; expectedHash?: string }, _ctx: ToolContext): Promise<ToolResult> {
		const uri = await this.editIntegrity.resolveWorkspaceUriAsync(args.filePath);
		const content = await this.editIntegrity.readFileContent(uri);
		const text = content;

		if (args.expectedHash) {
			const actualHash = this.editIntegrity.computeContentHash(text);
			if (actualHash !== args.expectedHash) {
				throw new Error(`File ${args.filePath} changed since read (hash mismatch). Re-read the file and retry.`);
			}
		}

		if (args.oldString === args.newString) {
			throw new Error('oldString and newString must be different');
		}

		const occurrences = countOccurrences(text, args.oldString);
		if (occurrences === 0) {
			throw new Error(`oldString not found in ${args.filePath} (file may have changed since planning — re-read and retry)`);
		}
		if (occurrences > 1 && !args.replaceAll) {
			throw new Error(`oldString appears ${occurrences} times in ${args.filePath}. Provide more context to make it unique, or set replaceAll: true.`);
		}

		const newText = args.replaceAll
			? text.split(args.oldString).join(args.newString)
			: text.replace(args.oldString, args.newString);

		await this.editIntegrity.preApply(uri, newText, text);

		const composerEnabled = this.configurationService.getValue<boolean>('ai.composer.enabled');
		const editMeta = { editContent: { filePath: args.filePath, original: text, modified: newText } };
		if (composerEnabled) {
			this.composerService.stageEdit(uri, text, newText);
			return {
				title: `Stage edit ${args.filePath}`,
				output: `Staged edit for ${args.filePath} in Composer. Accept or reject in the Composer dock.`,
				metadata: { ...editMeta, editContent: { ...editMeta.editContent, staged: true } },
			};
		}

		const validation = await this.editIntegrity.safeWrite(uri, newText, { composerStaged: false });
		return buildEditResult(args.filePath, occurrences, args.replaceAll, validation, editMeta);
	}
}

function buildEditResult(
	filePath: string,
	occurrences: number,
	replaceAll: boolean | undefined,
	validation: import('../../integrity/editIntegrityTypes.js').EditValidationResult | undefined,
	metadata?: Record<string, unknown>,
): ToolResult {
	const replaced = replaceAll ? occurrences : 1;
	let output = `Edited ${filePath}: replaced ${replaced} occurrence(s).`;
	if (validation) {
		output += ` Validation: errors ${validation.errorsBefore} → ${validation.errorsAfter}.`;
		if (!validation.ok) {
			output += ` Edit was reverted due to new errors.`;
		}
	}
	return {
		title: `Edit ${filePath}`,
		output,
		metadata,
		validation: validation ? toToolValidationResult(validation) : undefined,
	};
}

