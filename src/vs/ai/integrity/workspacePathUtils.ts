/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../base/common/uri.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { IFileService } from '../../platform/files/common/files.js';
import { IEditIntegrityService } from './editIntegrityService.js';
import { WorkspaceUriResolver } from './workspaceUriResolver.js';

/**
 * Resolve an optional workspace-relative or absolute path for search/bash tools.
 * Falls back to the first workspace folder root when path is omitted.
 */
export function resolveToolPath(
	editIntegrity: IEditIntegrityService,
	workspaceService: IWorkspaceContextService,
	fileService: IFileService,
	path?: string,
): Promise<URI> {
	if (path?.trim()) {
		return editIntegrity.resolveWorkspaceUriAsync(path);
	}
	const folder = workspaceService.getWorkspace().folders[0];
	if (!folder) {
		throw new Error('No workspace folder open');
	}
	return Promise.resolve(folder.uri);
}

export async function resolveToolPathFsPath(
	editIntegrity: IEditIntegrityService,
	workspaceService: IWorkspaceContextService,
	fileService: IFileService,
	path?: string,
): Promise<string> {
	const uri = await resolveToolPath(editIntegrity, workspaceService, fileService, path);
	return uri.fsPath;
}
