/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITextFileService } from '../../../workbench/services/textfile/common/textfiles.js';
import { URI } from '../../../base/common/uri.js';
import { ITool, ToolResult } from '../toolTypes.js';

/**
 * Write (create or overwrite) a file. Port of
 * `references/kilocode/packages/opencode/src/tool/write.ts`.
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
		@ITextFileService private readonly textFileService: ITextFileService
	) { }

	async execute(args: { filePath: string; content: string }): Promise<ToolResult> {
		const uri = URI.file(args.filePath);
		await this.textFileService.write(uri, args.content);
		return {
			title: `Write ${args.filePath}`,
			output: `File written: ${args.filePath}`
		};
	}
}
