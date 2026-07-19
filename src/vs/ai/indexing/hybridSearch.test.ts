import { describe, expect, test } from 'bun:test';
import { URI } from '../../base/common/uri.js';
import { hybridSearch } from './hybridSearch.ts';
import type { IIndexManager } from './indexTypes.ts';

function createIndexManager(results: Array<{ path: string; line: number; content: string; score: number }>): IIndexManager {
	return {
		isIndexing: false,
		indexedFileCount: results.length > 0 ? 1 : 0,
		onDidChangeProgress: (() => ({ dispose() { } })) as never,
		indexWorkspace: async () => { },
		search: async () => results.map((r, index) => ({
			chunk: {
				id: String(index),
				uri: URI.file(r.path),
				startLine: r.line,
				endLine: r.line,
				content: r.content,
				hash: 'hash',
			},
			score: r.score,
		})),
		rebuild: async () => { },
		updateFile: async () => { },
		removeFile: () => { },
	} as unknown as IIndexManager;
}

describe('hybridSearch', () => {
	test('merges semantic and keyword scores', async () => {
		const results = await hybridSearch(createIndexManager([
			{ path: '/workspace/src/a.ts', line: 12, content: 'export function foo() {}', score: 0.9 },
		]), 'foo function', 5);
		expect(results.length).toBe(1);
		expect(results[0]?.chunk.uri.fsPath).toContain('a.ts');
		expect(results[0]?.source).toBe('both');
	});
});
