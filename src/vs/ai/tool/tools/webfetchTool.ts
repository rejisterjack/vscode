/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRequestService, asJson, isSuccess } from '../../../platform/request/common/request.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { streamToBuffer } from '../../../base/common/buffer.js';
import { ITool, ToolResult } from '../toolTypes.js';

/**
 * Fetch the content of a URL. Port of
 * `references/kilocode/packages/opencode/src/tool/webfetch.ts`. Returns the
 * raw response body (truncated to a reasonable size).
 */
export class WebFetchTool implements ITool {
	readonly id = 'webfetch';
	readonly description = 'Fetch the content of a URL and return it as text. Use to read documentation, APIs, or any web page. HTML is returned as-is (the model can parse it).';
	readonly parameters = {
		type: 'object',
		properties: {
			url: { type: 'string', description: 'The URL to fetch.' },
			maxChars: { type: 'number', description: 'Maximum characters to return. Optional; defaults to 50000.' }
		},
		required: ['url']
	};

	private static readonly MAX_CHARS = 50000;

	constructor(
		@IRequestService private readonly requestService: IRequestService
	) { }

	async execute(args: { url: string; maxChars?: number }): Promise<ToolResult> {
		const requestContext = await this.requestService.request({
			type: 'GET',
			url: args.url,
			headers: { 'Accept': 'text/html,application/json,text/plain,*/*' }
		}, CancellationToken.None);

		if (!isSuccess(requestContext)) {
			const buffer = await streamToBuffer(requestContext.stream);
			throw new Error(`Failed to fetch ${args.url}: HTTP ${requestContext.res.statusCode}: ${buffer.toString()}`);
		}

		const contentType = requestContext.res.headers['content-type'] ?? '';
		const limit = args.maxChars ?? WebFetchTool.MAX_CHARS;

		if (contentType.includes('application/json')) {
			const json = await asJson<unknown>(requestContext);
			const text = JSON.stringify(json, null, 2);
			return {
				title: `Fetch ${args.url}`,
				output: text.slice(0, limit)
			};
		}

		const buffer = await streamToBuffer(requestContext.stream);
		const text = buffer.toString().slice(0, limit);
		return {
			title: `Fetch ${args.url}`,
			output: text
		};
	}
}
