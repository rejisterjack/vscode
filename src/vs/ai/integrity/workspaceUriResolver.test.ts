import { describe, expect, test } from 'bun:test';
import { URI } from '../../base/common/uri.js';
import { WorkspaceUriResolver, AmbiguousWorkspacePathError } from './workspaceUriResolver.js';
import type { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import type { IFileService } from '../../platform/files/common/files.js';

function createResolver(
	folders: Array<{ name: string; uri: URI }>,
	existingPaths: Set<string> = new Set(),
): WorkspaceUriResolver {
	const workspaceService = {
		getWorkspace: () => ({
			folders: folders.map((f, index) => ({
				uri: f.uri,
				name: f.name,
				index,
				toResource: (p: string) => URI.joinPath(f.uri, p),
			})),
		}),
	} as unknown as IWorkspaceContextService;
	const fileService = {
		stat: async (uri: URI) => {
			if (!existingPaths.has(uri.fsPath)) {
				throw new Error('not found');
			}
			return { isDirectory: false, isFile: true };
		},
	} as unknown as IFileService;
	return new WorkspaceUriResolver(workspaceService, fileService);
}

describe('WorkspaceUriResolver', () => {
	test('resolves relative path in single-root workspace', async () => {
		const resolver = createResolver([{ name: 'root', uri: URI.file('/workspace') }]);
		const uri = await resolver.resolve('src/foo.ts');
		expect(uri.fsPath).toBe('/workspace/src/foo.ts');
	});

	test('resolves folder-prefixed path in multi-root workspace', async () => {
		const resolver = createResolver([
			{ name: 'backend', uri: URI.file('/repos/backend') },
			{ name: 'frontend', uri: URI.file('/repos/frontend') },
		]);
		const uri = await resolver.resolve('backend:src/foo.ts');
		expect(uri.fsPath).toBe('/repos/backend/src/foo.ts');
	});

	test('picks existing file among multi-root candidates', async () => {
		const resolver = createResolver(
			[
				{ name: 'a', uri: URI.file('/ws/a') },
				{ name: 'b', uri: URI.file('/ws/b') },
			],
			new Set(['/ws/b/src/index.ts']),
		);
		const uri = await resolver.resolve('src/index.ts');
		expect(uri.fsPath).toBe('/ws/b/src/index.ts');
	});

	test('throws when multiple roots contain the same relative path', async () => {
		const resolver = createResolver(
			[
				{ name: 'a', uri: URI.file('/ws/a') },
				{ name: 'b', uri: URI.file('/ws/b') },
			],
			new Set(['/ws/a/src/index.ts', '/ws/b/src/index.ts']),
		);
		await expect(resolver.resolve('src/index.ts')).rejects.toBeInstanceOf(AmbiguousWorkspacePathError);
	});

	test('resolveSync throws ambiguous for multi-root without prefix', () => {
		const resolver = createResolver([
			{ name: 'a', uri: URI.file('/ws/a') },
			{ name: 'b', uri: URI.file('/ws/b') },
		]);
		expect(() => resolver.resolveSync('src/foo.ts')).toThrow(AmbiguousWorkspacePathError);
	});
});
