/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { IFileService } from '../../platform/files/common/files.js';
import { ITaskService } from '../../workbench/contrib/tasks/common/taskService.js';
import { Task } from '../../workbench/contrib/tasks/common/taskConfiguration.js';
import { URI } from '../../base/common/uri.js';
import { spawn } from 'child_process';

export const IWorkspaceTaskRunner = createDecorator<IWorkspaceTaskRunner>('ai.workspaceTaskRunner');

export interface IWorkspaceTaskRunner {
	readonly _serviceBrand: undefined;
	runTypecheck(): Promise<{ ok: boolean; output: string }>;
}

const OUTPUT_CAP = 8192;

export class WorkspaceTaskRunner implements IWorkspaceTaskRunner {
	declare readonly _serviceBrand: undefined;

	constructor(
		@ITaskService private readonly taskService: ITaskService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
	) { }

	async runTypecheck(): Promise<{ ok: boolean; output: string }> {
		const fromTask = await this.tryWorkspaceTask();
		if (fromTask) {
			return fromTask;
		}
		return this.runFallbackCommand();
	}

	private async tryWorkspaceTask(): Promise<{ ok: boolean; output: string } | undefined> {
		try {
			const tasks = await this.taskService.tasks();
			const match = tasks.find(t => this.isTypecheckTask(t));
			if (!match) {
				return undefined;
			}
			const summary = await this.taskService.run(match);
			const exitCode = summary?.exitCode;
			const ok = exitCode === 0 || exitCode === undefined;
			return {
				ok,
				output: ok ? 'Workspace typecheck task completed successfully.' : `Workspace typecheck task failed (exit ${exitCode ?? 'unknown'}).`,
			};
		} catch {
			return undefined;
		}
	}

	private isTypecheckTask(task: Task): boolean {
		const label = (task.configurationProperties?.label ?? '').toLowerCase();
		if (/typecheck|check-types|tsc/.test(label)) {
			return true;
		}
		const custom = task as Task & { command?: { name?: string } };
		const cmd = custom.command?.name?.toLowerCase() ?? '';
		return /typecheck|check-types|tsc/.test(cmd);
	}

	private async runFallbackCommand(): Promise<{ ok: boolean; output: string }> {
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!root) {
			return { ok: false, output: 'No workspace folder open.' };
		}

		const packageJsonUri = URI.joinPath(root, 'package.json');
		let hasPackageJson = false;
		try {
			await this.fileService.stat(packageJsonUri);
			hasPackageJson = true;
		} catch {
			hasPackageJson = false;
		}

		const command = hasPackageJson ? 'bun' : 'npx';
		const args = hasPackageJson ? ['run', 'check-types'] : ['tsc', '--noEmit'];
		return this.spawnCommand(command, args, root.fsPath);
	}

	private spawnCommand(command: string, args: string[], cwd: string): Promise<{ ok: boolean; output: string }> {
		return new Promise(resolve => {
			const child = spawn(command, args, { cwd, shell: true });
			let stdout = '';
			let stderr = '';
			child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
			child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
			child.on('close', code => {
				const output = capOutput([stdout, stderr].filter(Boolean).join('\n') || `Exit code ${code}`);
				resolve({ ok: code === 0, output });
			});
			child.on('error', err => {
				resolve({ ok: false, output: capOutput(err.message) });
			});
		});
	}
}

function capOutput(text: string): string {
	if (text.length <= OUTPUT_CAP) {
		return text;
	}
	return `${text.slice(0, OUTPUT_CAP)}…`;
}

registerSingleton(IWorkspaceTaskRunner, WorkspaceTaskRunner, InstantiationType.Delayed);
