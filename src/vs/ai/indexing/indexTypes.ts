/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../base/common/event.js';

export interface CodeChunk {
	readonly id: string;
	readonly uri: URI;
	readonly startLine: number;
	readonly endLine: number;
	readonly content: string;
	readonly hash: string;
}

export interface IndexSearchResult {
	readonly chunk: CodeChunk;
	readonly score: number;
	readonly explanation?: string;
}

export interface IndexProgress {
	readonly phase: 'scanning' | 'chunking' | 'embedding' | 'done' | 'error';
	readonly filesProcessed: number;
	readonly totalFiles: number;
	readonly message?: string;
}

export const IIndexManager = createDecorator<IIndexManager>('ai.indexManager');

export interface IIndexManager {
	readonly _serviceBrand: undefined;

	readonly isIndexing: boolean;
	readonly indexedFileCount: number;

	onDidChangeProgress: Event<IndexProgress>;

	/**
	 * Start or resume indexing the workspace.
	 */
	indexWorkspace(): Promise<void>;

	/**
	 * Semantic + keyword search over indexed chunks.
	 */
	search(query: string, limit?: number): Promise<IndexSearchResult[]>;

	/**
	 * Invalidate and rebuild the index.
	 */
	rebuild(): Promise<void>;

	/**
	 * Update a single file in the index.
	 */
	updateFile(uri: URI): Promise<void>;

	/**
	 * Remove a file from the index.
	 */
	removeFile(uri: URI): void;
}
