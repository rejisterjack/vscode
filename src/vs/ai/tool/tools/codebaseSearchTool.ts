/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IIndexManager } from '../../indexing/indexTypes.js';
import { hybridSearch } from '../../indexing/hybridSearch.js';
import { ITool, ToolResult } from '../toolTypes.js';

/**
 * Semantic + keyword search over the workspace index.
 */
export class CodebaseSearchTool implements ITool {
	readonly id = 'codebase_search';
	readonly description = 'Search the indexed codebase by meaning and keywords. Use to find implementations, patterns, and related files before editing.';
	readonly parameters = {
		type: 'object',
		properties: {
			query: { type: 'string', description: 'Natural language or keyword search query.' },
			limit: { type: 'number', description: 'Maximum number of results (default 10).' },
		},
		required: ['query'],
	};

	constructor(
		@IIndexManager private readonly indexManager: IIndexManager,
	) { }

	async execute(args: { query: string; limit?: number }): Promise<ToolResult> {
		if (!this.indexManager.indexedFileCount) {
			await this.indexManager.indexWorkspace();
		}
		const limit = args.limit ?? 10;
		const results = await hybridSearch(this.indexManager, args.query, limit);
		if (results.length === 0) {
			return {
				title: `Search: ${args.query}`,
				output: '(no results — the index may still be building; try grep for exact text)',
			};
		}
		const lines = results.map((r, index) => {
			const location = `${r.chunk.uri.fsPath}:${r.chunk.startLine}`;
			const preview = r.chunk.content.trim().slice(0, 400);
			return `${index + 1}. ${location} (score ${r.score.toFixed(2)}, ${r.source})\n${preview}`;
		});
		return {
			title: `Search: ${args.query}`,
			output: lines.join('\n\n'),
		};
	}
}
