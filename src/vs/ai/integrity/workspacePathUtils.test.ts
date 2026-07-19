import { describe, expect, test } from 'bun:test';
import { URI } from '../../base/common/uri.js';
import { resolveToolPath, resolveToolPathFsPath } from '../integrity/workspacePathUtils.js';
import type { IEditIntegrityService } from '../integrity/editIntegrityService.js';
import type { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import type { IFileService } from '../../platform/files/common/files.js';

function createContext(workspaceRoot: string) {
	const folderUri = URI.file(workspaceRoot);
	const editIntegrity = {
		resolveWorkspaceUriAsync: async (path: string) => URI.joinPath(folderUri, path),
	} as unknown as IEditIntegrityService;
	const workspaceService = {
		getWorkspace: () => ({
			folders: [{ uri: folderUri, name: 'workspace', index: 0, toResource: (p: string) => URI.joinPath(folderUri, p) }],
		}),
	} as unknown as IWorkspaceContextService;
	const fileService = {} as IFileService;
	return { editIntegrity, workspaceService, fileService, folderUri };
}

describe('workspacePathUtils', () => {
	test('resolveToolPath defaults to first workspace folder', async () => {
		const { editIntegrity, workspaceService, fileService, folderUri } = createContext('/workspace');
		const uri = await resolveToolPath(editIntegrity, workspaceService, fileService);
		expect(uri.toString()).toBe(folderUri.toString());
	});

	test('resolveToolPath resolves relative paths', async () => {
		const { editIntegrity, workspaceService, fileService } = createContext('/workspace');
		const uri = await resolveToolPath(editIntegrity, workspaceService, fileService, 'src/foo.ts');
		expect(uri.fsPath).toBe('/workspace/src/foo.ts');
	});

	test('resolveToolPathFsPath returns filesystem path', async () => {
		const { editIntegrity, workspaceService, fileService } = createContext('/workspace');
		expect(await resolveToolPathFsPath(editIntegrity, workspaceService, fileService, 'src')).toBe('/workspace/src');
	});
});
