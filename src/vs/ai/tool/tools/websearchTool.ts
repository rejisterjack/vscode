/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRequestService, asJson, isSuccess } from '../../../platform/request/common/request.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { ITool, ToolResult } from '../toolTypes.js';

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
		const maxResults = args.maxResults ?? 10;
		// Use DuckDuckGo's instant answer API as a no-key fallback.
		const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1&skip_disambig=1`;
		const requestContext = await this.requestService.request({
			type: 'GET',
			url,
			headers: { 'Accept': 'application/json' }
		}, CancellationToken.None);

		if (!isSuccess(requestContext)) {
			throw new Error(`Web search failed: HTTP ${requestContext.res.statusCode}`);
		}

		const data = await asJson<{
			AbstractText?: string;
			AbstractURL?: string;
			Heading?: string;
			RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
		}>(requestContext);

		if (!data) {
			throw new Error('Web search returned no data');
		}

		const results: string[] = [];
		if (data.AbstractText) {
			results.push(`# ${data.Heading ?? args.query}\n${data.AbstractText}\nURL: ${data.AbstractURL ?? ''}`);
		}
		if (data.RelatedTopics) {
			for (const topic of data.RelatedTopics.slice(0, maxResults)) {
				if (topic.Text && topic.FirstURL) {
					results.push(`- ${topic.Text}\n  URL: ${topic.FirstURL}`);
				}
			}
		}

		return {
			title: `Search: ${args.query}`,
			output: results.length ? results.join('\n\n') : '(no results)'
		};
	}
}
