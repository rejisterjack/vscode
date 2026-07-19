import { describe, expect, test } from 'bun:test';
import { WorkspaceTaskRunner } from '../integrity/workspaceTaskRunner.ts';
import type { ITaskService } from '../../workbench/contrib/tasks/common/taskService.ts';
import type { IWorkspaceContextService } from '../../platform/workspace/common/workspace.ts';
import type { IFileService } from '../../platform/files/common/files.ts';
import type { Task } from '../../workbench/contrib/tasks/common/taskConfiguration.ts';

describe('WorkspaceTaskRunner', () => {
	test('runTypecheck uses matching workspace task', async () => {
		const task = {
			configurationProperties: { label: 'check-types' },
			command: { name: 'check-types' },
		} as unknown as Task;

		const taskService = {
			tasks: async () => [task],
			run: async () => ({ exitCode: 0 }),
		} as unknown as ITaskService;

		const runner = new WorkspaceTaskRunner(
			taskService,
			{ getWorkspace: () => ({ folders: [] }) } as unknown as IWorkspaceContextService,
			{} as IFileService,
		);

		const result = await runner.runTypecheck();
		expect(result.ok).toBe(true);
	});
});
