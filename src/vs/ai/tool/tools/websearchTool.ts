/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../base/common/cancellation.js';
import { IRequestService } from '../../../platform/request/common/request.js';
import { ITool, ToolResult } from '../toolTypes.js';
import { fetchWebSearchResults } from './websearchUtils.js';

/**
 * Search the web for a query. Port of
 * `references/kilocode/packages/opencode/src/tool/websearch.ts`. Uses a
 * configurable search endpoint (default: DuckDuckGo HTML, no API key needed).
 * A production deployment would use a real search API (Exa, Brave, etc.).
 */
export class WebSearchTool implements ITool {
	readonly id = 'websearch';
	readonly description = 'Search the web for a query and return the top results with titles, URLs, and snippets.';
	readonly parameters = {
		type: 'object',
		properties: {
			query: { type: 'string', description: 'The search query.' },
			maxResults: { type: 'number', description: 'Maximum number of results. Optional; defaults to 10.' }
		},
		required: ['query']
	};

	constructor(
		@IRequestService private readonly requestService: IRequestService
	) { }

	async execute(args: { query: string; maxResults?: number }): Promise<ToolResult> {
		const output = await fetchWebSearchResults(this.requestService, args.query, args.maxResults ?? 10, CancellationToken.None);
		return {
			title: `Search: ${args.query}`,
			output,
		};
	}
}
