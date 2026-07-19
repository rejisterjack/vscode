/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRequestService } from '../../platform/request/common/request.js';
import { CancellationToken } from '../../base/common/cancellation.js';
import { streamToBuffer } from '../../base/common/buffer.js';
import {
	FewStepsAwayOAuthTokenResponse,
	FewStepsAwayRefreshResponse,
	FewStepsAwayUserProfile,
} from './fewStepsAwayAuthTypes.js';

export type AgentTaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface AgentTaskResponse {
	readonly id: string;
	readonly prompt: string;
	readonly status: AgentTaskStatus;
	readonly result?: string;
	readonly error?: string;
}

const NATIVE_PLATFORM_HEADER = 'native';

export class FewStepsAwayApiClient {

	constructor(
		private readonly requestService: IRequestService,
		private readonly baseUrl: string,
	) { }

	async createTask(accessToken: string, body: { prompt: string; organizationId?: string }): Promise<AgentTaskResponse> {
		return this.postJson<AgentTaskResponse>('/ai/agents/tasks', body, {
			'Authorization': `Bearer ${accessToken}`,
		});
	}

	async getTask(accessToken: string, taskId: string): Promise<AgentTaskResponse> {
		return this.getJson<AgentTaskResponse>(`/ai/agents/tasks/${encodeURIComponent(taskId)}`, accessToken);
	}

	async cancelTask(accessToken: string, taskId: string): Promise<AgentTaskResponse> {
		return this.postJson<AgentTaskResponse>(`/ai/agents/tasks/${encodeURIComponent(taskId)}/cancel`, undefined, {
			'Authorization': `Bearer ${accessToken}`,
		});
	}

	async queuePrReview(accessToken: string, body: {
		prUrl: string;
		repo: string;
		organizationId: string;
		diff?: string;
		postToGitHub?: boolean;
	}): Promise<{ task: AgentTaskResponse; queued: boolean }> {
		return this.postJson('/ai/agents/pr-review', body, {
			'Authorization': `Bearer ${accessToken}`,
		});
	}

	async exchangeOAuthCode(
		code: string,
		codeVerifier: string,
		clientId: string,
		redirectUri: string,
	): Promise<FewStepsAwayOAuthTokenResponse> {
		return this.postJson<FewStepsAwayOAuthTokenResponse>('/auth/token', {
			code,
			code_verifier: codeVerifier,
			client_id: clientId,
			redirect_uri: redirectUri,
		});
	}

	async refresh(refreshToken: string): Promise<FewStepsAwayRefreshResponse> {
		return this.postJson<FewStepsAwayRefreshResponse>('/auth/refresh', undefined, {
			'X-Refresh-Token': refreshToken,
		});
	}

	async getMe(accessToken: string): Promise<FewStepsAwayUserProfile> {
		return this.getJson<FewStepsAwayUserProfile>('/auth/me', accessToken);
	}

	async logout(accessToken: string, refreshToken: string): Promise<void> {
		await this.postJson('/auth/logout', undefined, {
			'Authorization': `Bearer ${accessToken}`,
			'X-Refresh-Token': refreshToken,
		});
	}

	async securityPreflight(accessToken: string, body: {
		content: string;
		organizationId?: string;
		filePath?: string;
		model?: string;
	}): Promise<{ allowed: boolean; redacted?: string; policy?: { allowed: boolean; violations: string[] } }> {
		return this.postJson('/security/preflight', body, {
			'Authorization': `Bearer ${accessToken}`,
		});
	}

	async logAiAudit(accessToken: string, body: {
		organizationId?: string;
		suggestionType: string;
		outcome: 'SHOWN' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED';
		model?: string;
		promptLength?: number;
		filePath?: string;
	}): Promise<void> {
		await this.postJson('/ai-audit', body, {
			'Authorization': `Bearer ${accessToken}`,
		});
	}

	async embedTexts(accessToken: string, texts: string[]): Promise<number[][]> {
		const result = await this.postJson<{ embeddings: number[][] }>('/ai/embeddings', { texts }, {
			'Authorization': `Bearer ${accessToken}`,
		});
		return result.embeddings;
	}

	private async postJson<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
		let response: Awaited<ReturnType<IRequestService['request']>>;
		try {
			response = await this.requestService.request({
				type: 'POST',
				url: `${this.baseUrl}${path}`,
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'X-Client-Platform': NATIVE_PLATFORM_HEADER,
					...extraHeaders,
				},
				data: body ? JSON.stringify(body) : undefined,
			}, CancellationToken.None);
		} catch (error) {
			throw this.toNetworkError(error);
		}

		return this.parseJsonResponse<T>(response);
	}

	private async getJson<T>(path: string, accessToken: string): Promise<T> {
		let response: Awaited<ReturnType<IRequestService['request']>>;
		try {
			response = await this.requestService.request({
				type: 'GET',
				url: `${this.baseUrl}${path}`,
				headers: {
					'Accept': 'application/json',
					'X-Client-Platform': NATIVE_PLATFORM_HEADER,
					'Authorization': `Bearer ${accessToken}`,
				},
			}, CancellationToken.None);
		} catch (error) {
			throw this.toNetworkError(error);
		}

		return this.parseJsonResponse<T>(response);
	}

	private toNetworkError(error: unknown): Error {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			if (message === 'failed to fetch' || message.includes('networkerror') || message.includes('econnrefused')) {
				return new Error(`Cannot reach FewStepsAway API at ${this.baseUrl}. Ensure the backend is running.`);
			}
			return error;
		}
		return new Error(String(error));
	}

	private async parseJsonResponse<T>(response: Awaited<ReturnType<IRequestService['request']>>): Promise<T> {
		const buffer = await streamToBuffer(response.stream);
		const text = buffer.toString();
		if (response.res.statusCode && response.res.statusCode >= 400) {
			let message = `Request failed (${response.res.statusCode})`;
			try {
				const body = JSON.parse(text) as { message?: string; error?: string; detail?: string };
				message = body.detail ?? body.message ?? body.error ?? message;
			} catch {
				if (text) {
					message = text;
				}
			}
			throw new Error(message);
		}
		if (!text) {
			throw new Error('Empty response from server');
		}
		return JSON.parse(text) as T;
	}
}
