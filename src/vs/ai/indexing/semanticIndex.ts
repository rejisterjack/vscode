/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../base/common/uri.js';
import { hash } from '../../../base/common/hash.js';
import { CodeChunk, IndexSearchResult } from './indexTypes.js';

const CHUNK_LINES = 40;
const CHUNK_OVERLAP = 8;

/**
 * Simple in-memory semantic index using term-frequency vectors.
 * Production Org-Brain uses pgvector on the platform; this powers local @codebase.
 */
export class SemanticIndex {
	private readonly chunks = new Map<string, CodeChunk>();
	private readonly vectors = new Map<string, Map<string, number>>();

	clear(): void {
		this.chunks.clear();
		this.vectors.clear();
	}

	get size(): number {
		return this.chunks.size;
	}

	indexFile(uri: URI, content: string): void {
		this.removeFile(uri);
		const lines = content.split(/\r?\n/);
		for (let start = 0; start < lines.length; start += CHUNK_LINES - CHUNK_OVERLAP) {
			const end = Math.min(start + CHUNK_LINES, lines.length);
			const slice = lines.slice(start, end).join('\n');
			if (!slice.trim()) {
				continue;
			}
			const id = `${uri.toString()}#${start}`;
			const chunk: CodeChunk = {
				id,
				uri,
				startLine: start + 1,
				endLine: end,
				content: slice,
				hash: String(hash(slice)),
			};
			this.chunks.set(id, chunk);
			this.vectors.set(id, this.toVector(slice));
		}
	}

	removeFile(uri: URI): void {
		const prefix = uri.toString();
		for (const id of [...this.chunks.keys()]) {
			if (id.startsWith(prefix)) {
				this.chunks.delete(id);
				this.vectors.delete(id);
			}
		}
	}

	search(query: string, limit = 10): IndexSearchResult[] {
		const queryVec = this.toVector(query);
		const results: IndexSearchResult[] = [];
		for (const [id, vec] of this.vectors) {
			const score = this.cosineSimilarity(queryVec, vec);
			if (score > 0.05) {
				const chunk = this.chunks.get(id)!;
				results.push({ chunk, score });
			}
		}
		return results.sort((a, b) => b.score - a.score).slice(0, limit);
	}

	private toVector(text: string): Map<string, number> {
		const vec = new Map<string, number>();
		const tokens = text.toLowerCase().match(/[a-z0-9_$.]+/g) ?? [];
		for (const token of tokens) {
			vec.set(token, (vec.get(token) ?? 0) + 1);
		}
		return vec;
	}

	private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
		let dot = 0;
		let normA = 0;
		let normB = 0;
		for (const [, v] of a) {
			normA += v * v;
		}
		for (const [, v] of b) {
			normB += v * v;
		}
		for (const [key, va] of a) {
			const vb = b.get(key);
			if (vb) {
				dot += va * vb;
			}
		}
		if (normA === 0 || normB === 0) {
			return 0;
		}
		return dot / (Math.sqrt(normA) * Math.sqrt(normB));
	}
}

