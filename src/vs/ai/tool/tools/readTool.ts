/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileService } from '../../../platform/files/common/files.js';
import { ITextFileService } from '../../../workbench/services/textfile/common/textfiles.js';
import { IEditIntegrityService } from '../../integrity/editIntegrityService.js';
import { ITool, ToolResult } from '../toolTypes.js';

/**
 * Read a file (or list a directory). Port of
 * `references/kilocode/packages/opencode/src/tool/read.ts`.
 */
export class ReadFileTool implements ITool {
	readonly id = 'read';
	readonly description = 'Read the contents of a file. The input `filePath` is an absolute or workspace-relative path. Use `offset` and `limit` to read a specific line range (1-indexed). To list a directory, pass a directory path.';
	readonly parameters = {
		type: 'object',
		properties: {
			filePath: { type: 'string', description: 'The absolute or workspace-relative path of the file or directory to read.' },
			offset: { type: 'number', description: 'Starting line number (1-indexed). Optional.' },
			limit: { type: 'number', description: 'Maximum number of lines to read. Optional; defaults to 2000.' }
		},
		required: ['filePath']
	};

	constructor(
		@IFileService private readonly fileService: IFileService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IEditIntegrityService private readonly editIntegrity: IEditIntegrityService,
	) { }

	async execute(args: { filePath: string; offset?: number; limit?: number }): Promise<ToolResult> {
		const uri = await this.editIntegrity.resolveWorkspaceUriAsync(args.filePath);
		try {
			const stat = await this.fileService.resolve(uri);
			if (stat.isDirectory) {
				const entries = (stat.children ?? []).map(c => `${c.isDirectory ? '[dir]' : '[file]'} ${c.name}`);
				return {
					title: `List ${args.filePath}`,
					output: entries.join('\n') || '(empty directory)'
				};
			}
		} catch {
			// Not a directory or doesn't exist -- fall through to file read.
		}

		const content = await this.textFileService.read(uri);
		const lines = content.value.split('\n');
		const offset = args.offset && args.offset > 0 ? args.offset - 1 : 0;
		const limit = args.limit ?? 2000;
		const selected = lines.slice(offset, offset + limit);
		const numbered = selected.map((line, i) => `${String(offset + i + 1).padStart(6, ' ')}|${line}`);
		const contentHash = this.editIntegrity.computeContentHash(content.value);
		return {
			title: `Read ${args.filePath}`,
			output: `${numbered.join('\n')}\n\n(contentHash: ${contentHash} — pass as expectedHash to edit when replacing)`,
			metadata: { contentHash, filePath: args.filePath },
		};
	}
}
