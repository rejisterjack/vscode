/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../base/common/cancellation.js';
import { ITool, ToolResult } from '../toolTypes.js';
import type { ChildProcessWithoutNullStreams } from 'child_process';

/**
 * Execute a shell command. Port of
 * `references/kilocode/packages/opencode/src/tool/shell.ts`. Uses Node's
 * `child_process.spawn`. In read-only modes, the permission ruleset gates
 * this tool to a safe allowlist.
 */
export class BashTool implements ITool {
	readonly id = 'bash';
	readonly description = 'Execute a shell command and return its stdout/stderr. Use for running tests, git commands, build scripts, etc. The command runs in the workspace root with a 2-minute timeout.';
	readonly parameters = {
		type: 'object',
		properties: {
			command: { type: 'string', description: 'The shell command to execute.' },
			cwd: { type: 'string', description: 'Working directory. Optional; defaults to the workspace root.' }
		},
		required: ['command']
	};

	async execute(args: { command: string; cwd?: string }, ctx: { abortSignal: CancellationToken }): Promise<ToolResult> {
		const cp = await import('child_process');
		return new Promise((resolve) => {
			const spawnOptions: { cwd?: string; shell: string } = { shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash' };
			if (args.cwd) {
				spawnOptions.cwd = args.cwd;
			}
			const child: ChildProcessWithoutNullStreams = cp.spawn(args.command, [], spawnOptions);
			let stdout = '';
			let stderr = '';
			child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
			child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
			child.on('error', (err: Error) => {
				resolve({
					title: `Bash: ${args.command}`,
					output: `Error: ${err.message}`,
					metadata: { exitCode: -1, stderr }
				});
			});
			child.on('close', (code: number | null) => {
				const output = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
				resolve({
					title: `Bash: ${args.command}`,
					output: output || `(no output, exit code ${code})`,
					metadata: { exitCode: code ?? -1, stdout, stderr }
				});
			});
			const abortTimer = setInterval(() => {
				if (ctx.abortSignal.isCancellationRequested && !child.killed) {
					child.kill('SIGTERM');
				}
			}, 500);
			child.on('close', () => clearInterval(abortTimer));
			setTimeout(() => {
				if (!child.killed) { child.kill('SIGTERM'); }
			}, 120000);
		});
	}
}
