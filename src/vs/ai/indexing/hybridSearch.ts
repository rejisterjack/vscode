/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IndexSearchResult } from './indexTypes.js';
import { IIndexManager } from './indexTypes.js';

export interface HybridSearchResult extends IndexSearchResult {
	source: 'semantic' | 'keyword' | 'both';
}

/**
 * Merge semantic index hits with keyword overlap scoring.
 */
export async function hybridSearch(
	indexManager: IIndexManager,
	query: string,
	limit = 10,
): Promise<HybridSearchResult[]> {
	const semantic = await indexManager.search(query, limit * 2);
	const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
	const merged = new Map<string, HybridSearchResult>();

	for (const r of semantic) {
		const key = `${r.chunk.uri.fsPath}:${r.chunk.startLine}`;
		const kwScore = keywordScore(r.chunk.content, keywords);
		const score = r.score * 0.7 + kwScore * 0.3;
		merged.set(key, { ...r, score, source: kwScore > 0 ? 'both' : 'semantic' });
	}

	return [...merged.values()]
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

function keywordScore(content: string, keywords: string[]): number {
	if (keywords.length === 0) {
		return 0;
	}
	const lower = content.toLowerCase();
	let hits = 0;
	for (const kw of keywords) {
		if (lower.includes(kw)) {
			hits++;
		}
	}
	return hits / keywords.length;
}
