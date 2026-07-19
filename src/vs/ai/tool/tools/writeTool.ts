/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { IComposerService } from '../../composer/composerTypes.js';
import { IEditIntegrityService } from '../../integrity/editIntegrityService.js';
import { ITool, ToolContext, ToolResult } from '../toolTypes.js';
import { toToolValidationResult } from '../toolValidationUtils.js';

/**
 * Write (create or overwrite) a file with integrity validation.
 */
export class WriteFileTool implements ITool {
	readonly id = 'write';
	readonly description = 'Write content to a file. If the file exists it will be overwritten; if it does not exist it will be created. Always show the complete intended file content.';
	readonly parameters = {
		type: 'object',
		properties: {
			filePath: { type: 'string', description: 'The absolute or workspace-relative path of the file to write.' },
			content: { type: 'string', description: 'The complete content to write to the file.' }
		},
		required: ['filePath', 'content']
	};

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IComposerService private readonly composerService: IComposerService,
		@IEditIntegrityService private readonly editIntegrity: IEditIntegrityService,
	) { }

	async execute(args: { filePath: string; content: string }, _ctx: ToolContext): Promise<ToolResult> {
		const uri = await this.editIntegrity.resolveWorkspaceUriAsync(args.filePath);
		let original = '';
		try {
			original = await this.editIntegrity.readFileContent(uri);
		} catch {
			original = '';
		}

		await this.editIntegrity.preApply(uri, args.content, original);

		const composerEnabled = this.configurationService.getValue<boolean>('ai.composer.enabled');
		const editMeta = { editContent: { filePath: args.filePath, original, modified: args.content } };
		if (composerEnabled) {
			this.composerService.stageEdit(uri, original, args.content);
			return {
				title: `Stage write ${args.filePath}`,
				output: `Staged write for ${args.filePath} in Composer. Accept or reject in the Composer dock.`,
				metadata: { ...editMeta, editContent: { ...editMeta.editContent, staged: true } },
			};
		}

		const validation = await this.editIntegrity.safeWrite(uri, args.content, { composerStaged: false });

		let output = `File written: ${args.filePath}`;
		if (validation) {
			output += ` Validation: errors ${validation.errorsBefore} → ${validation.errorsAfter}.`;
			if (!validation.ok) {
				output += ` Write was reverted due to new errors.`;
			}
		}
		return {
			title: `Write ${args.filePath}`,
			output,
			metadata: editMeta,
			validation: validation ? toToolValidationResult(validation) : undefined,
		};
	}
}
