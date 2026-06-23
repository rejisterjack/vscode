/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileService } from '../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { URI } from '../../../base/common/uri.js';
import { ITool, ToolResult } from '../toolTypes.js';
import { parse as parseGlob } from '../../../base/common/glob.js';

/**
 * Fast file pattern matching using glob patterns. Port of
 * `references/kilocode/packages/opencode/src/tool/glob.ts`.
 */
export class GlobTool implements ITool {
	readonly id = 'glob';
	readonly description = 'Fast file pattern matching. Returns file paths matching the glob pattern (e.g. "**/*.ts", "src/**/*.js"). Uses the workspace root as the base.';
	readonly parameters = {
		type: 'object',
		properties: {
			pattern: { type: 'string', description: 'The glob pattern (e.g. "**/*.ts").' },
			path: { type: 'string', description: 'The directory to search in. Optional; defaults to the workspace root.' }
		},
		required: ['pattern']
	};

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService
	) { }

	async execute(args: { pattern: string; path?: string }): Promise<ToolResult> {
		const workspaceRoot = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!workspaceRoot) {
			throw new Error('No workspace folder open');
		}
		const baseUri = args.path ? URI.file(args.path) : workspaceRoot;
		const matches: string[] = [];
		await this.collectMatches(baseUri, args.pattern, matches, 1000);
		return {
			title: `Glob ${args.pattern}`,
			output: matches.length ? matches.join('\n') : '(no matches)'
		};
	}

	private async collectMatches(uri: URI, pattern: string, results: string[], limit: number): Promise<void> {
		if (results.length >= limit) { return; }
		const matcher = parseGlob(pattern, { ignoreCase: process.platform === 'win32' });
		const stat = await this.fileService.resolve(uri, { resolveMetadata: false });
		if (!stat.children) { return; }
		for (const child of stat.children) {
			if (results.length >= limit) { return; }
			const childPath = child.resource.fsPath;
			if (!child.isDirectory && matcher(childPath)) {
				results.push(childPath);
			}
			if (child.isDirectory && !child.name.startsWith('.') && child.name !== 'node_modules') {
				await this.collectMatches(child.resource, pattern, results, limit);
			}
		}
	}
}
