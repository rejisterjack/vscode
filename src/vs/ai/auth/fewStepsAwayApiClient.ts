/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRequestService } from '../../platform/request/common/request.js';
import { CancellationToken } from '../../base/common/cancellation.js';
import { streamToBuffer } from '../../base/common/buffer.js';
import {
	FewStepsAwayLoginResult,
	FewStepsAwayOAuthTokenResponse,
	FewStepsAwayRefreshResponse,
	FewStepsAwayUserProfile,
} from './fewStepsAwayAuthTypes.js';

const NATIVE_PLATFORM_HEADER = 'native';

export class FewStepsAwayApiClient {

	constructor(
		private readonly requestService: IRequestService,
		private readonly baseUrl: string,
	) { }

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

	async login(email: string, password: string): Promise<FewStepsAwayLoginResult> {
		return this.postJson<FewStepsAwayLoginResult>('/auth/login', { email, password });
	}

	async completeMfa(mfaChallengeToken: string, code: string): Promise<FewStepsAwayRefreshResponse> {
		return this.postJson<FewStepsAwayRefreshResponse>('/auth/login/mfa', { code }, {
			'Authorization': `Bearer ${mfaChallengeToken}`,
		});
	}

	private async getJson<T>(path: string, accessToken: string): Promise<T> {
		const response = await this.requestService.request({
			type: 'GET',
			url: `${this.baseUrl}${path}`,
			headers: {
				'Accept': 'application/json',
				'X-Client-Platform': NATIVE_PLATFORM_HEADER,
				'Authorization': `Bearer ${accessToken}`,
			},
		}, CancellationToken.None);

		return this.parseJsonResponse<T>(response);
	}

	private async postJson<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
		const response = await this.requestService.request({
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

		return this.parseJsonResponse<T>(response);
	}

	private async parseJsonResponse<T>(response: Awaited<ReturnType<IRequestService['request']>>): Promise<T> {
		const buffer = await streamToBuffer(response.stream);
		const text = buffer.toString();
		if (response.res.statusCode && response.res.statusCode >= 400) {
			let message = `Request failed (${response.res.statusCode})`;
			try {
				const body = JSON.parse(text) as { message?: string; error?: string };
				message = body.message ?? body.error ?? message;
			} catch {
				if (text) {
					message = text;
				}
			}
			throw new Error(message);
		}
		return JSON.parse(text) as T;
	}
}
