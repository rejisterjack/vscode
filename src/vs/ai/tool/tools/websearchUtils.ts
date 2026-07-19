/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../base/common/cancellation.js';
import { IRequestService, asJson, isSuccess } from '../../../platform/request/common/request.js';

export async function fetchWebSearchResults(
	requestService: IRequestService,
	query: string,
	maxResults = 10,
	token = CancellationToken.None,
): Promise<string> {
	const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
	const requestContext = await requestService.request({
		type: 'GET',
		url,
		headers: { Accept: 'application/json' },
	}, token);

	if (!isSuccess(requestContext)) {
		throw new Error(`Web search failed: HTTP ${requestContext.res.statusCode}`);
	}

	const data = await asJson<{
		AbstractText?: string;
		AbstractURL?: string;
		Heading?: string;
		RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
	}>(requestContext);

	return formatWebSearchResponse(query, data, maxResults);
}

export function formatWebSearchResponse(
	query: string,
	data: {
		AbstractText?: string;
		AbstractURL?: string;
		Heading?: string;
		RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
	} | null | undefined,
	maxResults = 10,
): string {
	if (!data) {
		return '(no results)';
	}

	const results: string[] = [];
	if (data.AbstractText) {
		results.push(`# ${data.Heading ?? query}\n${data.AbstractText}\nURL: ${data.AbstractURL ?? ''}`);
	}
	if (data.RelatedTopics) {
		for (const topic of data.RelatedTopics.slice(0, maxResults)) {
			if (topic.Text && topic.FirstURL) {
				results.push(`- ${topic.Text}\n  URL: ${topic.FirstURL}`);
			}
		}
	}
	return results.length ? results.join('\n\n') : '(no results)';
}
