/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { URI } from '../../../base/common/uri.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { IIndexManager, IndexProgress, IndexSearchResult } from './indexTypes.js';
import { SemanticIndex } from './semanticIndex.js';

const BINARY_EXTENSIONS = new Set([
	'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'woff', 'woff2', 'ttf', 'eot',
	'zip', 'gz', 'tar', 'pdf', 'exe', 'dll', 'so', 'dylib', 'wasm', 'mp4', 'mp3',
]);

const IGNORE_DIRS = new Set([
	'node_modules', '.git', 'dist', 'out', 'build', '.next', 'coverage', '__pycache__',
]);

/**
 * Workspace indexer with incremental updates and local semantic search.
 */
export class IndexManager extends Disposable implements IIndexManager {
	declare readonly _serviceBrand: undefined;

	private readonly index = new SemanticIndex();
	private indexing = false;
	private fileCount = 0;

	private readonly _onDidChangeProgress = this._register(new Emitter<IndexProgress>());
	readonly onDidChangeProgress: Event<IndexProgress> = this._onDidChangeProgress.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
		this._register(this.fileService.onDidFilesChange(e => {
			if (!this.configurationService.getValue<boolean>('ai.indexing.enabled')) {
				return;
			}
			for (const uri of e.rawUpdated) {
				void this.updateFile(uri);
			}
			for (const uri of e.rawDeleted) {
				this.removeFile(uri);
			}
		}));
	}

	get isIndexing(): boolean {
		return this.indexing;
	}

	get indexedFileCount(): number {
		return this.fileCount;
	}

	async indexWorkspace(): Promise<void> {
		if (!this.configurationService.getValue<boolean>('ai.indexing.enabled')) {
			return;
		}
		if (this.indexing) {
			return;
		}
		this.indexing = true;
		this.fileCount = 0;
		try {
			const folders = this.workspaceService.getWorkspace().folders;
			const maxFiles = this.configurationService.getValue<number>('ai.indexing.maxFiles') ?? 10_000;
			const files: URI[] = [];

			for (const folder of folders) {
				await this.collectFiles(folder.uri, files, maxFiles);
			}

			this._onDidChangeProgress.fire({ phase: 'chunking', filesProcessed: 0, totalFiles: files.length });

			for (let i = 0; i < files.length; i++) {
				await this.updateFile(files[i]!);
				if (i % 50 === 0) {
					this._onDidChangeProgress.fire({
						phase: 'embedding',
						filesProcessed: i,
						totalFiles: files.length,
					});
				}
			}

			this._onDidChangeProgress.fire({
				phase: 'done',
				filesProcessed: files.length,
				totalFiles: files.length,
			});
		} catch (err) {
			this._onDidChangeProgress.fire({
				phase: 'error',
				filesProcessed: this.fileCount,
				totalFiles: 0,
				message: err instanceof Error ? err.message : String(err),
			});
		} finally {
			this.indexing = false;
		}
	}

	async search(query: string, limit = 10): Promise<IndexSearchResult[]> {
		return this.index.search(query, limit);
	}

	async rebuild(): Promise<void> {
		this.index.clear();
		this.fileCount = 0;
		await this.indexWorkspace();
	}

	async updateFile(uri: URI): Promise<void> {
		if (!this.shouldIndex(uri)) {
			return;
		}
		try {
			const content = await this.fileService.readFile(uri);
			this.index.indexFile(uri, content.value.toString());
			this.fileCount = this.index.size;
		} catch {
			// Skip unreadable files
		}
	}

	removeFile(uri: URI): void {
		this.index.removeFile(uri);
	}

	private shouldIndex(uri: URI): boolean {
		const ext = uri.path.split('.').pop()?.toLowerCase() ?? '';
		if (BINARY_EXTENSIONS.has(ext)) {
			return false;
		}
		const parts = uri.path.split('/');
		for (const part of parts) {
			if (IGNORE_DIRS.has(part)) {
				return false;
			}
		}
		return true;
	}

	private async collectFiles(folder: URI, out: URI[], maxFiles: number, token?: CancellationToken): Promise<void> {
		if (out.length >= maxFiles) {
			return;
		}
		try {
			const stat = await this.fileService.resolve(folder);
			if (!stat.children) {
				return;
			}
			for (const child of stat.children) {
				if (token?.isCancellationRequested || out.length >= maxFiles) {
					return;
				}
				if (child.isDirectory) {
					const name = child.name;
					if (IGNORE_DIRS.has(name) || name.startsWith('.')) {
						continue;
					}
					await this.collectFiles(child.resource, out, maxFiles, token);
				} else if (this.shouldIndex(child.resource)) {
					out.push(child.resource);
				}
			}
		} catch {
			// Skip inaccessible folders
		}
	}
}
