/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { spawn, ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, statSync } from 'fs';
import { join, isAbsolute } from 'path';
import { Disposable } from '../../base/common/lifecycle.js';
import { IProductService } from '../../platform/product/common/productService.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IEnvironmentMainService } from '../../platform/environment/electron-main/environmentMainService.js';
import { ILogService } from '../../platform/log/common/log.js';
import { IAIServerInstanceInfo } from '../common/types/serverManager.types.js';

/**
 * Error thrown when the CLI server fails to start.
 */
export class ServerStartupError extends Error {
	constructor(
		message: string,
		readonly details?: string
	) {
		super(message);
		this.name = 'ServerStartupError';
	}
}

interface IInternalServerInstance {
	readonly port: number;
	readonly password: string;
	readonly process: ChildProcess;
}

const STARTUP_TIMEOUT_SECONDS = 30;

function parseServerPort(output: string): number | null {
	const match = output.match(/listening on http:\/\/[\w.]+:(\d+)/);
	if (!match) { return null; }
	return parseInt(match[1], 10);
}

/**
 * Manages the lifecycle of the `fewstepsaway serve` CLI process.
 *
 * This is the electron-main (native) implementation. It owns the
 * ChildProcess and exposes only serializable info to IPC clients.
 */
export class AIServerMainService extends Disposable {

	private instance: IInternalServerInstance | null = null;
	private startupPromise: Promise<IAIServerInstanceInfo> | null = null;

	constructor(
		@IProductService private readonly productService: IProductService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	get isRunning(): boolean {
		return this.instance !== null;
	}

	async getServer(workspaceDir?: string): Promise<IAIServerInstanceInfo> {
		if (this.instance) {
			return { port: this.instance.port, password: this.instance.password };
		}
		if (this.startupPromise) {
			return this.startupPromise;
		}
		this.startupPromise = this.startServer(workspaceDir);
		try {
			const info = await this.startupPromise;
			return info;
		} finally {
			this.startupPromise = null;
		}
	}

	async disposeServer(): Promise<void> {
		if (!this.instance) {
			return;
		}
		const proc = this.instance.process;
		const port = this.instance.port;
		this.instance = null;
		this.logService.info(`[AIServerMainService] Disposing server on port ${port} — sending SIGTERM`);
		AIServerMainService.killProcess(proc, 'SIGTERM');
		const timer = setTimeout(() => {
			if (proc.exitCode === null) {
				this.logService.warn('[AIServerMainService] SIGTERM timeout, sending SIGKILL');
				AIServerMainService.killProcess(proc, 'SIGKILL');
			}
		}, 5000);
		(timer as any).unref?.();
		proc.on('exit', () => clearTimeout(timer));
	}

	private async startServer(workspaceDir?: string): Promise<IAIServerInstanceInfo> {
		const password = randomBytes(32).toString('hex');
		const cliPath = this.getCliPath();
		this.logService.info('[AIServerMainService] CLI path:', cliPath);

		if (!existsSync(cliPath)) {
			throw new ServerStartupError(
				`CLI binary not found at: ${cliPath}`,
				'Ensure the CLI is built and available. See product.json `cli.fewstepsawayPath`.'
			);
		}

		const stat = statSync(cliPath);
		if (!stat.isFile()) {
			throw new ServerStartupError(`CLI path is not a file: ${cliPath}`);
		}

		const spawnCwd = this.resolveServerCwd(workspaceDir);
		mkdirSync(spawnCwd, { recursive: true });

		return new Promise<IAIServerInstanceInfo>((resolve, reject) => {
			const serverProcess = spawn(cliPath, ['serve', '--port', '0'], {
				cwd: spawnCwd,
				env: {
					NODE_USE_SYSTEM_CA: '1',
					...process.env,
					MIMALLOC_PURGE_DELAY: '0',
					FEWSTEPSAWAY_SERVER_PASSWORD: password,
					FEWSTEPSAWAY_CLIENT: 'vscode',
					FEWSTEPSAWAY_ENABLE_QUESTION_TOOL: 'true',
					FEWSTEPSAWAY_FEATURE: 'vscode-native',
					FEWSTEPSAWAY_TELEMETRY_LEVEL: 'off',
					FEWSTEPSAWAY_APP_NAME: 'fewstepsaway',
					FEWSTEPSAWAY_PLATFORM: 'vscode',
					...this.buildProxyEnv(),
					FEWSTEPSAWAY_DISABLE_CHANNEL_DB: 'true'
				} as NodeJS.ProcessEnv,
				stdio: ['ignore', 'pipe', 'pipe'],
				windowsHide: true,
				detached: true
			});

			let resolved = false;
			const stderrLines: string[] = [];

			serverProcess.stdout?.on('data', (data: Buffer) => {
				const output = data.toString();
				this.logService.debug('[AIServerMainService] CLI stdout:', output);
				const port = parseServerPort(output);
				if (port !== null && !resolved) {
					resolved = true;
					this.logService.info('[AIServerMainService] Port detected:', port);
					this.instance = { port, password, process: serverProcess };
					resolve({ port, password });
				}
			});

			serverProcess.stderr?.on('data', (data: Buffer) => {
				const errorOutput = data.toString();
				this.logService.warn('[AIServerMainService] CLI stderr:', errorOutput);
				stderrLines.push(errorOutput);
			});

			serverProcess.on('error', (error: Error) => {
				this.logService.error('[AIServerMainService] Process error:', error);
				if (!resolved) {
					reject(error);
				}
			});

			serverProcess.on('exit', (code: number | null) => {
				this.logService.info('[AIServerMainService] Process exited with code:', code);
				if (this.instance?.process === serverProcess) {
					this.instance = null;
				}
				if (!resolved) {
					const stderr = stderrLines.join('\n');
					reject(new ServerStartupError(
						`CLI server exited with code ${code ?? 'null'}`,
						stderr
					));
				}
			});

			setTimeout(() => {
				if (!resolved) {
					this.logService.error(`[AIServerMainService] Startup timeout (${STARTUP_TIMEOUT_SECONDS}s)`);
					AIServerMainService.killProcess(serverProcess);
					const stderr = stderrLines.join('\n');
					reject(new ServerStartupError(
						`CLI server startup timed out after ${STARTUP_TIMEOUT_SECONDS}s`,
						stderr
					));
				}
			}, STARTUP_TIMEOUT_SECONDS * 1000);
		});
	}

	private getCliPath(): string {
		const productName = process.platform === 'win32' ? 'fewstepsaway.exe' : 'fewstepsaway';
		const configured = this.productService.cli?.fewstepsawayPath;
		const relativePath = configured ?? join('extensions', 'fewstepsaway-ai', 'bin', productName);
		if (isAbsolute(relativePath)) {
			return relativePath;
		}
		return join(this.environmentMainService.appRoot, relativePath);
	}

	private resolveServerCwd(workspaceDir?: string): string {
		if (workspaceDir && workspaceDir.trim() !== '') {
			return workspaceDir;
		}
		return this.environmentMainService.userDataPath;
	}

	private buildProxyEnv(): Record<string, string> {
		const proxy = this.configurationService.getValue<string>('http.proxy');
		const noProxy = this.configurationService.getValue<string[]>('http.noProxy');
		const proxySupport = this.configurationService.getValue<string>('http.proxySupport');

		if (proxySupport === 'off') {
			return { HTTP_PROXY: '', HTTPS_PROXY: '', NO_PROXY: '', http_proxy: '', https_proxy: '', no_proxy: '' };
		}

		const env: Record<string, string> = {};
		if (proxy && proxy.trim() !== '') {
			env.HTTP_PROXY = proxy;
			env.HTTPS_PROXY = proxy;
			env.http_proxy = proxy;
			env.https_proxy = proxy;
		}
		if (Array.isArray(noProxy) && noProxy.length > 0) {
			env.NO_PROXY = noProxy.join(',');
			env.no_proxy = noProxy.join(',');
		}
		return env;
	}

	static killProcess(proc: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
		if (proc.pid === undefined) { return; }
		try {
			if (process.platform !== 'win32') {
				process.kill(-proc.pid, signal);
			} else {
				proc.kill(signal);
			}
		} catch {
			// Process may already be dead
		}
	}

	override dispose(): void {
		void this.disposeServer();
		super.dispose();
	}
}
