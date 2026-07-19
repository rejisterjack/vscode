/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { Emitter, Event } from '../../base/common/event.js';
import { Disposable } from '../../base/common/lifecycle.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../platform/log/common/log.js';
import { IRequestService } from '../../platform/request/common/request.js';
import { IStorageService, StorageScope, StorageTarget } from '../../platform/storage/common/storage.js';
import { AgentTaskStatus, FewStepsAwayApiClient } from '../auth/fewStepsAwayApiClient.js';
import { IFewStepsAwayAuthService } from '../auth/fewStepsAwayAuthService.js';
import { IAgentLoop } from './agentLoop.js';
import { IProviderRegistry } from '../common/types/provider.types.js';
import { IToolEnabledProvider } from '../provider/common/protocolBackedProvider.js';
import { IWorktreeService } from '../scm/worktreeService.js';

export const IBackgroundAgentService = createDecorator<IBackgroundAgentService>('ai.backgroundAgentService');

export type BackgroundAgentTaskStatus = 'queued' | 'running' | 'done' | 'failed';

export interface BackgroundAgentTask {
	readonly id: string;
	readonly prompt: string;
	readonly status: BackgroundAgentTaskStatus;
	readonly result?: string;
	readonly remoteId?: string;
}

export interface IBackgroundAgentService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	enqueue(prompt: string): string;
	cancel(id: string): boolean;
	list(): BackgroundAgentTask[];
	get(id: string): BackgroundAgentTask | undefined;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 120;
const STORAGE_KEY = 'fewstepsaway.backgroundAgent.tasks';

export class BackgroundAgentService extends Disposable implements IBackgroundAgentService {
	declare readonly _serviceBrand: undefined;

	private readonly tasks = new Map<string, BackgroundAgentTask>();
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;
	private apiClient: FewStepsAwayApiClient | undefined;

	constructor(
		@IFewStepsAwayAuthService private readonly authService: IFewStepsAwayAuthService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IRequestService private readonly requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IStorageService private readonly storageService: IStorageService,
		@IWorktreeService private readonly worktreeService: IWorktreeService,
	) {
		super();
		this.loadFromStorage();
		this.resumeInterruptedTasks();
	}

	enqueue(prompt: string): string {
		const id = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const task: BackgroundAgentTask = { id, prompt, status: 'queued' };
		this.tasks.set(id, task);
		this.persist();
		this._onDidChange.fire();
		void this.runTask(id);
		return id;
	}

	cancel(id: string): boolean {
		const task = this.tasks.get(id);
		if (!task || task.status === 'done' || task.status === 'failed') {
			return false;
		}
		if (task.remoteId) {
			void this.cancelRemote(task.remoteId);
		}
		this.updateTask(id, { status: 'failed', result: 'Cancelled by user.' });
		return true;
	}

	list(): BackgroundAgentTask[] {
		return [...this.tasks.values()];
	}

	get(id: string): BackgroundAgentTask | undefined {
		return this.tasks.get(id);
	}

	private resumeInterruptedTasks(): void {
		for (const task of this.tasks.values()) {
			if (task.status === 'queued' || task.status === 'running') {
				void this.runTask(task.id);
			}
		}
	}

	private loadFromStorage(): void {
		const raw = this.storageService.get(STORAGE_KEY, StorageScope.APPLICATION);
		if (!raw) {
			return;
		}
		try {
			const parsed = JSON.parse(raw) as BackgroundAgentTask[];
			for (const task of parsed) {
				this.tasks.set(task.id, task);
			}
		} catch {
			// ignore corrupt storage
		}
	}

	private persist(): void {
		this.storageService.store(
			STORAGE_KEY,
			JSON.stringify([...this.tasks.values()]),
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
		);
	}

	private async runTask(id: string): Promise<void> {
		const task = this.tasks.get(id);
		if (!task) {
			return;
		}

		this.updateTask(id, { status: 'running' });

		const token = await this.authService.getAccessToken();
		if (token) {
			try {
				const orgId = this.configurationService.getValue<string>('ai.backend.organizationId');
				const remote = await this.getApiClient().createTask(token, {
					prompt: task.prompt,
					organizationId: orgId || undefined,
				});
				this.updateTask(id, { remoteId: remote.id });
				await this.pollRemoteTask(id, remote.id, token);
				return;
			} catch (error) {
				this.logService.warn('[BackgroundAgent] Remote enqueue failed, using local fallback:', error);
			}
		}

		await this.runLocalFallback(id, task.prompt);
	}

	private async pollRemoteTask(id: string, remoteId: string, token: string): Promise<void> {
		for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
			await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
			const current = this.tasks.get(id);
			if (!current || current.status === 'failed') {
				return;
			}
			try {
				const remote = await this.getApiClient().getTask(token, remoteId);
				const status = this.mapRemoteStatus(remote.status);
				this.updateTask(id, {
					status,
					result: remote.result ?? remote.error,
				});
				if (status === 'done' || status === 'failed') {
					return;
				}
			} catch (error) {
				this.logService.warn('[BackgroundAgent] Poll failed:', error);
				this.updateTask(id, { status: 'failed', result: String(error) });
				return;
			}
		}
		this.updateTask(id, { status: 'failed', result: 'Task polling timed out.' });
	}

	private async cancelRemote(remoteId: string): Promise<void> {
		const token = await this.authService.getAccessToken();
		if (!token) {
			return;
		}
		try {
			await this.getApiClient().cancelTask(token, remoteId);
		} catch (error) {
			this.logService.warn('[BackgroundAgent] Cancel request failed:', error);
		}
	}

	private async runLocalFallback(id: string, prompt: string): Promise<void> {
		const worktree = await this.worktreeService.createWorktree(id);
		const agentLoop = this.instantiationService.invokeFunction(accessor => accessor.get(IAgentLoop));
		const providerRegistry = this.instantiationService.invokeFunction(accessor => accessor.get(IProviderRegistry));
		const provider = providerRegistry.getActiveProvider() as IToolEnabledProvider | undefined;
		if (!provider) {
			this.updateTask(id, { status: 'failed', result: 'No AI provider configured for local background execution.' });
			return;
		}

		const modelId = this.configurationService.getValue<string>('ai.chat.model') ?? 'gpt-4o';
		let output = '';
		try {
			for await (const event of agentLoop.run({
				provider,
				model: { id: modelId },
				system: [{ type: 'text', text: 'You are a background coding agent. Complete the task concisely and report results.' }],
				messages: [{ role: 'user', content: prompt }],
				sessionId: id,
				messageId: id,
				maxSteps: 8,
			})) {
				if (event.type === 'text-delta') {
					output += event.text;
				}
				if (event.type === 'step-finish' && event.step.text) {
					output = event.step.text;
				}
				if (event.type === 'error') {
					throw new Error(event.error);
				}
			}
			this.updateTask(id, { status: 'done', result: output || 'Background task completed with no text output.' });
		} catch (error) {
			this.updateTask(id, { status: 'failed', result: error instanceof Error ? error.message : String(error) });
		} finally {
			if (worktree) {
				await this.worktreeService.removeWorktree(worktree);
			}
		}
	}

	private mapRemoteStatus(status: AgentTaskStatus): BackgroundAgentTaskStatus {
		switch (status) {
			case 'queued':
			case 'running':
				return status;
			case 'done':
				return 'done';
			case 'failed':
			case 'cancelled':
				return 'failed';
		}
	}

	private updateTask(id: string, patch: Partial<BackgroundAgentTask>): void {
		const current = this.tasks.get(id);
		if (!current) {
			return;
		}
		this.tasks.set(id, { ...current, ...patch });
		this.persist();
		this._onDidChange.fire();
	}

	private getApiClient(): FewStepsAwayApiClient {
		if (!this.apiClient) {
			const baseUrl = (this.configurationService.getValue<string>('ai.backend.apiUrl') ?? 'http://localhost:21000/api/v1').replace(/\/$/, '');
			this.apiClient = new FewStepsAwayApiClient(this.requestService, baseUrl);
		}
		return this.apiClient;
	}
}

registerSingleton(IBackgroundAgentService, BackgroundAgentService, InstantiationType.Delayed);
