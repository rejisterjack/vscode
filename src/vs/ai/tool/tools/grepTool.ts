/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../base/common/cancellation.js';
import { ISearchService, QueryType, ITextQuery } from '../../../workbench/services/search/common/search.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { ITool, ToolResult } from '../toolTypes.js';

/**
 * Search file contents with a regex. Port of
 * `references/kilocode/packages/opencode/src/tool/grep.ts`. Uses VS Code's
 * built-in ripgrep-backed search service.
 */
export class GrepTool implements ITool {
	readonly id = 'grep';
	readonly description = 'Search file contents with a regex pattern. Returns matching lines with file paths and line numbers. Uses ripgrep under the hood.';
	readonly parameters = {
		type: 'object',
		properties: {
			pattern: { type: 'string', description: 'The regular expression pattern to search for.' },
			path: { type: 'string', description: 'The directory or file to search in. Optional; defaults to the workspace root.' },
			include: { type: 'string', description: 'Glob pattern to include (e.g. "*.ts"). Optional.' },
			outputMode: { type: 'string', enum: ['content', 'files_with_matches'], description: 'How to present results. Optional; defaults to "content".' }
		},
		required: ['pattern']
	};

	constructor(
		@ISearchService private readonly searchService: ISearchService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService
	) { }

	async execute(args: { pattern: string; path?: string; include?: string; outputMode?: 'content' | 'files_with_matches' }): Promise<ToolResult> {
		const folder = this.workspaceService.getWorkspace().folders[0];
		if (!folder) {
			throw new Error('No workspace folder open');
		}
		const query: ITextQuery = {
			contentPattern: { pattern: args.pattern, isRegExp: true, isCaseSensitive: false },
			folderQueries: [{ folder: args.path ? folder.uri.with({ path: args.path }) : folder.uri }],
			type: QueryType.Text,
			maxResults: 200,
		};
		if (args.include) {
			query.includePattern = { [args.include]: true };
		}
		const result = await this.searchService.textSearch(query, CancellationToken.None);

		if (args.outputMode === 'files_with_matches') {
			const files = result.results.map(r => r.resource.fsPath);
			const unique = Array.from(new Set(files));
			return {
				title: `Grep ${args.pattern}`,
				output: unique.length ? unique.join('\n') : '(no matches)'
			};
		}

		const lines = result.results.map(r => {
			const match = r as { resource: { fsPath: string }; ranges?: unknown; preview?: { text: string } };
			const preview = (match as { preview?: { text: string } }).preview?.text ?? '';
			return `${match.resource.fsPath}: ${preview.trim()}`;
		});
		return {
			title: `Grep ${args.pattern}`,
			output: lines.length ? lines.join('\n') : '(no matches)'
		};
	}
}
