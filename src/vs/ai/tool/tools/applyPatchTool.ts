/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { IComposerService } from '../../composer/composerTypes.js';
import { IEditIntegrityService } from '../../integrity/editIntegrityService.js';
import { ITool, ToolContext, ToolResult } from '../toolTypes.js';
import { applyFilePatch, parseMultiFilePatch } from './applyPatchUtils.js';
import { toToolValidationResult } from '../toolValidationUtils.js';
import { EditSnapshot } from '../../integrity/editIntegrityTypes.js';

/**
 * Apply unified-diff patches to one or more files with per-hunk integrity checks.
 */
export class ApplyPatchTool implements ITool {
	readonly id = 'apply_patch';
	readonly description = 'Apply unified diff patch(es) to file(s). Supports multi-file diffs with ---/+++ headers, or single-file patches with filePath + @@ hunks.';
	readonly parameters = {
		type: 'object',
		properties: {
			filePath: { type: 'string', description: 'Target file path for single-file patches without ---/+++ headers.' },
			patch: { type: 'string', description: 'Unified diff patch content (single- or multi-file).' },
		},
		required: ['patch'],
	};

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IComposerService private readonly composerService: IComposerService,
		@IEditIntegrityService private readonly editIntegrity: IEditIntegrityService,
	) { }

	async execute(args: { filePath?: string; patch: string }, _ctx: ToolContext): Promise<ToolResult> {
		const filePatches = parseMultiFilePatch(args.patch, args.filePath);
		if (filePatches.length === 0) {
			throw new Error('No valid hunks found in patch');
		}

		const composerEnabled = this.configurationService.getValue<boolean>('ai.composer.enabled');
		const batchRevert = this.configurationService.getValue<boolean>('ai.edit.batchRevertOnFailure') ?? true;
		const snapshots: EditSnapshot[] = [];
		const applied: Array<{ filePath: string; hunkCount: number; original: string; modified: string }> = [];

		try {
			for (const filePatch of filePatches) {
				const uri = await this.editIntegrity.resolveWorkspaceUriAsync(filePatch.filePath);
				const original = await this.editIntegrity.readFileContent(uri);
				const modified = applyFilePatch(original, filePatch.hunks);
				await this.editIntegrity.preApply(uri, modified, original);
				snapshots.push(await this.editIntegrity.snapshot(uri));

				if (composerEnabled) {
					this.composerService.stageEdit(uri, original, modified);
					applied.push({ filePath: filePatch.filePath, hunkCount: filePatch.hunks.length, original, modified });
					continue;
				}

				const validation = await this.editIntegrity.safeWrite(uri, modified, { composerStaged: false });
				if (validation && !validation.ok) {
					throw new PatchApplicationError(filePatch.filePath, validation);
				}
				applied.push({ filePath: filePatch.filePath, hunkCount: filePatch.hunks.length, original, modified });
			}
		} catch (error) {
			if (batchRevert && !composerEnabled) {
				for (const snapshot of snapshots) {
					await this.editIntegrity.revert(snapshot);
				}
			}
			throw error;
		}

		const totalHunks = applied.reduce((sum, item) => sum + item.hunkCount, 0);
		const fileList = applied.map(item => item.filePath).join(', ');
		if (composerEnabled) {
			return {
				title: `Stage patch (${applied.length} file(s))`,
				output: `Staged ${totalHunks} hunk(s) across ${applied.length} file(s): ${fileList}`,
				metadata: {
					editContent: applied.length === 1
						? { filePath: applied[0]!.filePath, original: applied[0]!.original, modified: applied[0]!.modified, staged: true }
						: { staged: true, files: applied },
				},
			};
		}

		return {
			title: `Patch (${applied.length} file(s))`,
			output: `Applied ${totalHunks} hunk(s) across ${applied.length} file(s): ${fileList}`,
			metadata: applied.length === 1
				? { editContent: { filePath: applied[0]!.filePath, original: applied[0]!.original, modified: applied[0]!.modified } }
				: { files: applied },
		};
	}
}

class PatchApplicationError extends Error {
	constructor(
		readonly filePath: string,
		readonly validation: import('../../integrity/editIntegrityTypes.js').EditValidationResult,
	) {
		super(`Patch failed validation for ${filePath}`);
	}
}
