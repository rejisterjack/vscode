/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { generateUuid } from '../../base/common/uuid.js';

export interface WorktreeHandle {
	readonly id: string;
	readonly path: string;
	readonly branch: string;
}

export const IWorktreeService = createDecorator<IWorktreeService>('fewstepsaway.worktreeService');

export interface IWorktreeService {
	readonly _serviceBrand: undefined;
	createWorktree(taskId: string): Promise<WorktreeHandle | undefined>;
	removeWorktree(handle: WorktreeHandle): Promise<void>;
}

export class WorktreeService implements IWorktreeService {
	declare readonly _serviceBrand: undefined;

	private readonly active = new Map<string, WorktreeHandle>();

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService,
	) { }

	async createWorktree(taskId: string): Promise<WorktreeHandle | undefined> {
		const root = this.workspaceService.getWorkspace().folders[0]?.uri.fsPath;
		if (!root) {
			return undefined;
		}
		const id = taskId || generateUuid();
		const branch = `fsa-agent-${id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
		const worktreePath = `${root}/.fewstepsaway/worktrees/${id}`;
		try {
			await this.execGit(root, `worktree add -b ${branch} "${worktreePath}"`);
			const handle = { id, path: worktreePath, branch };
			this.active.set(id, handle);
			return handle;
		} catch (error) {
			this.logService.warn('[WorktreeService] Failed to create worktree:', error);
			return undefined;
		}
	}

	async removeWorktree(handle: WorktreeHandle): Promise<void> {
		const root = this.workspaceService.getWorkspace().folders[0]?.uri.fsPath;
		if (!root) {
			return;
		}
		try {
			await this.execGit(root, `worktree remove --force "${handle.path}"`);
			await this.execGit(root, `branch -D ${handle.branch}`).catch(() => undefined);
		} catch (error) {
			this.logService.warn('[WorktreeService] Failed to remove worktree:', error);
		} finally {
			this.active.delete(handle.id);
		}
	}

	private async execGit(cwd: string, args: string): Promise<string> {
		const cp = await import('child_process');
		return new Promise<string>((resolve, reject) => {
			cp.exec(`git ${args}`, { cwd, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
				if (err) {
					reject(new Error(stderr || err.message));
					return;
				}
				resolve((stdout || stderr || '').trim());
			});
		});
	}
}

registerSingleton(IWorktreeService, WorktreeService, InstantiationType.Delayed);
