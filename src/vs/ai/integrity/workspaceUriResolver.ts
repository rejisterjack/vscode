/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../base/common/uri.js';
import { isAbsolute } from '../../base/common/path.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { IFileService } from '../../platform/files/common/files.js';

export class AmbiguousWorkspacePathError extends Error {
	constructor(public readonly candidates: readonly URI[]) {
		super(`Ambiguous workspace path. Candidates: ${candidates.map(c => c.fsPath).join(', ')}`);
		this.name = 'AmbiguousWorkspacePathError';
	}
}

/**
 * Resolves workspace-relative, folder-prefixed, and absolute paths across multi-root workspaces.
 */
export class WorkspaceUriResolver {
	constructor(
		private readonly workspaceService: IWorkspaceContextService,
		private readonly fileService: IFileService,
	) { }

	async resolve(filePath: string): Promise<URI> {
		const trimmed = filePath.trim();
		if (!trimmed) {
			throw new Error('filePath is required');
		}
		if (isAbsolute(trimmed) || trimmed.startsWith('file://')) {
			return trimmed.startsWith('file://') ? URI.parse(trimmed) : URI.file(trimmed);
		}

		const folderPrefixed = this.tryParseFolderPrefix(trimmed);
		if (folderPrefixed) {
			return folderPrefixed;
		}

		const folders = this.workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			return URI.file(trimmed);
		}
		if (folders.length === 1) {
			return URI.joinPath(folders[0].uri, trimmed);
		}

		const candidates = folders.map(folder => URI.joinPath(folder.uri, trimmed));
		const existing: URI[] = [];
		for (const candidate of candidates) {
			try {
				await this.fileService.stat(candidate);
				existing.push(candidate);
			} catch {
				// not in this root
			}
		}

		if (existing.length === 1) {
			return existing[0]!;
		}
		if (existing.length > 1) {
			throw new AmbiguousWorkspacePathError(existing);
		}

		// New file — default to first workspace folder.
		return candidates[0]!;
	}

	resolveSync(filePath: string): URI {
		const trimmed = filePath.trim();
		if (!trimmed) {
			throw new Error('filePath is required');
		}
		if (isAbsolute(trimmed) || trimmed.startsWith('file://')) {
			return trimmed.startsWith('file://') ? URI.parse(trimmed) : URI.file(trimmed);
		}

		const folderPrefixed = this.tryParseFolderPrefix(trimmed);
		if (folderPrefixed) {
			return folderPrefixed;
		}

		const folders = this.workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			return URI.file(trimmed);
		}
		if (folders.length === 1) {
			return URI.joinPath(folders[0].uri, trimmed);
		}

		const candidates = folders.map(folder => URI.joinPath(folder.uri, trimmed));
		throw new AmbiguousWorkspacePathError(candidates);
	}

	private tryParseFolderPrefix(trimmed: string): URI | undefined {
		const colonIndex = trimmed.indexOf(':');
		if (colonIndex <= 0 || trimmed.includes('://')) {
			return undefined;
		}
		const folderName = trimmed.slice(0, colonIndex);
		const relativePath = trimmed.slice(colonIndex + 1).replace(/^\//, '');
		const folder = this.workspaceService.getWorkspace().folders.find(f => f.name === folderName);
		if (!folder) {
			throw new Error(`Unknown workspace folder: ${folderName}`);
		}
		return URI.joinPath(folder.uri, relativePath);
	}
}
