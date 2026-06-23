/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IContextKey, IContextKeyService } from '../../platform/contextkey/common/contextkey.js';
import { ILogService } from '../../platform/log/common/log.js';
import { IOpenerService } from '../../platform/opener/common/opener.js';
import { IRequestService } from '../../platform/request/common/request.js';
import { ISecretStorageService } from '../../platform/secrets/common/secrets.js';
import { FewStepsAwayApiClient } from './fewStepsAwayApiClient.js';
import { FewStepsAwayAuthContextKeys } from './fewStepsAwayAuthContextKeys.js';
import { FewStepsAwayAuthSession, FewStepsAwayUserProfile } from './fewStepsAwayAuthTypes.js';
import { generateCodeChallenge, generateRandomString } from './fewStepsAwayPkce.js';

export const IFewStepsAwayAuthService = createDecorator<IFewStepsAwayAuthService>('fewStepsAwayAuthService');

const SECRET_ACCESS_TOKEN = 'fewstepsaway.auth.accessToken';
const SECRET_REFRESH_TOKEN = 'fewstepsaway.auth.refreshToken';
const SECRET_USER = 'fewstepsaway.auth.user';

export interface IFewStepsAwayAuthService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeAuthState: Event<void>;
	isSignedIn(): boolean;
	isAuthPending(): boolean;
	getUser(): FewStepsAwayUserProfile | undefined;
	getAccessToken(): Promise<string | undefined>;
	initialize(): Promise<void>;
	signInWithOAuth(): Promise<void>;
	completeMfa(mfaChallengeToken: string, code: string): Promise<void>;
	handleOAuthCallback(url: string): Promise<boolean>;
	signOut(): Promise<void>;
	refreshIfNeeded(): Promise<boolean>;
}

export class FewStepsAwayAuthService extends Disposable implements IFewStepsAwayAuthService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeAuthState = this._register(new Emitter<void>());
	readonly onDidChangeAuthState = this._onDidChangeAuthState.event;

	private readonly signedInContext: IContextKey<boolean>;
	private readonly authPendingContext: IContextKey<boolean>;

	private apiClient: FewStepsAwayApiClient | undefined;
	private session: FewStepsAwayAuthSession | undefined;
	private pendingOAuth: { codeVerifier: string; state: string; redirectUri: string; clientId: string } | undefined;
	private refreshPromise: Promise<boolean> | undefined;
	private initialized = false;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ISecretStorageService private readonly secretStorageService: ISecretStorageService,
		@IRequestService private readonly requestService: IRequestService,
		@IOpenerService private readonly openerService: IOpenerService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.signedInContext = FewStepsAwayAuthContextKeys.SignedIn.bindTo(contextKeyService);
		this.authPendingContext = FewStepsAwayAuthContextKeys.AuthPending.bindTo(contextKeyService);
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}
		this.initialized = true;
		this.apiClient = new FewStepsAwayApiClient(this.requestService, this.getApiBaseUrl());

		try {
			const accessToken = await this.secretStorageService.get(SECRET_ACCESS_TOKEN);
			const refreshToken = await this.secretStorageService.get(SECRET_REFRESH_TOKEN);
			const userJson = await this.secretStorageService.get(SECRET_USER);
			if (accessToken && refreshToken && userJson) {
				this.session = {
					accessToken,
					refreshToken,
					user: JSON.parse(userJson) as FewStepsAwayUserProfile,
				};
				try {
					const user = await this.getApiClient().getMe(accessToken);
					this.session = { ...this.session, user };
					await this.persistSession(this.session);
				} catch {
					const refreshed = await this.refreshIfNeeded();
					if (!refreshed) {
						await this.clearSession();
					}
				}
			}
		} catch (error) {
			this.logService.error('[FewStepsAwayAuth] Failed to restore session:', error);
			await this.clearSession();
		}

		this.updateContextKeys();
	}

	isSignedIn(): boolean {
		return !!this.session?.accessToken;
	}

	isAuthPending(): boolean {
		return !!this.pendingOAuth;
	}

	getUser(): FewStepsAwayUserProfile | undefined {
		return this.session?.user;
	}

	async getAccessToken(): Promise<string | undefined> {
		if (!this.session?.accessToken) {
			return undefined;
		}
		await this.refreshIfNeeded();
		return this.session?.accessToken;
	}

	async signInWithOAuth(): Promise<void> {
		const clientId = this.configurationService.getValue<string>('ai.auth.oauth.clientId') ?? 'fewstepsaway-ide';
		const redirectUri = this.configurationService.getValue<string>('ai.auth.oauth.redirectUri') ?? 'fewstepsaway://auth/callback';
		const codeVerifier = generateRandomString(64);
		const codeChallenge = await generateCodeChallenge(codeVerifier);
		const state = generateRandomString(32);

		this.pendingOAuth = { codeVerifier, state, redirectUri, clientId };
		this.updateContextKeys();

		const authorizeUrl = new URL(`${this.getApiBaseUrl()}/auth/authorize`);
		authorizeUrl.searchParams.set('response_type', 'code');
		authorizeUrl.searchParams.set('client_id', clientId);
		authorizeUrl.searchParams.set('redirect_uri', redirectUri);
		authorizeUrl.searchParams.set('state', state);
		authorizeUrl.searchParams.set('code_challenge', codeChallenge);
		authorizeUrl.searchParams.set('code_challenge_method', 'S256');

		await this.openerService.open(authorizeUrl.toString(), { openExternal: true });
	}

	async handleOAuthCallback(url: string): Promise<boolean> {
		if (!this.pendingOAuth) {
			return false;
		}

		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			return false;
		}

		if (parsed.pathname !== '/auth/callback' && !parsed.href.includes('auth/callback')) {
			return false;
		}

		const error = parsed.searchParams.get('error');
		if (error) {
			this.pendingOAuth = undefined;
			this.updateContextKeys();
			throw new Error(error);
		}

		const returnedState = parsed.searchParams.get('state');
		if (!returnedState || returnedState !== this.pendingOAuth.state) {
			this.pendingOAuth = undefined;
			this.updateContextKeys();
			throw new Error('OAuth state mismatch. Please try signing in again.');
		}

		const mfaRequired = parsed.searchParams.get('mfa_required');
		if (mfaRequired) {
			this.pendingOAuth = undefined;
			this.updateContextKeys();
			throw new Error('MFA is required. Use the web app to complete sign-in for now.');
		}

		const code = parsed.searchParams.get('code');
		if (!code) {
			return false;
		}

		const { codeVerifier, redirectUri, clientId } = this.pendingOAuth;
		this.pendingOAuth = undefined;
		this.updateContextKeys();

		const tokenResponse = await this.getApiClient().exchangeOAuthCode(code, codeVerifier, clientId, redirectUri);
		const user = await this.getApiClient().getMe(tokenResponse.access_token);
		await this.setSession({
			accessToken: tokenResponse.access_token,
			refreshToken: tokenResponse.refresh_token,
			user,
		});
		return true;
	}

	async completeMfa(mfaChallengeToken: string, code: string): Promise<void> {
		const result = await this.getApiClient().completeMfa(mfaChallengeToken, code);
		await this.setSession({
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
			user: result.user,
		});
	}

	async signOut(): Promise<void> {
		if (this.session) {
			try {
				await this.getApiClient().logout(this.session.accessToken, this.session.refreshToken);
			} catch (error) {
				this.logService.warn('[FewStepsAwayAuth] Logout request failed:', error);
			}
		}
		await this.clearSession();
	}

	async refreshIfNeeded(): Promise<boolean> {
		if (!this.session?.refreshToken) {
			return false;
		}
		if (this.refreshPromise) {
			return this.refreshPromise;
		}

		this.refreshPromise = (async () => {
			try {
				const result = await this.getApiClient().refresh(this.session!.refreshToken);
				await this.setSession({
					accessToken: result.accessToken,
					refreshToken: result.refreshToken,
					user: result.user,
				});
				return true;
			} catch (error) {
				this.logService.warn('[FewStepsAwayAuth] Token refresh failed:', error);
				await this.clearSession();
				return false;
			} finally {
				this.refreshPromise = undefined;
			}
		})();

		return this.refreshPromise;
	}

	private getApiBaseUrl(): string {
		const url = this.configurationService.getValue<string>('ai.backend.apiUrl') ?? 'http://localhost:7380/api/v1';
		return url.replace(/\/$/, '');
	}

	private getApiClient(): FewStepsAwayApiClient {
		if (!this.apiClient) {
			this.apiClient = new FewStepsAwayApiClient(this.requestService, this.getApiBaseUrl());
		}
		return this.apiClient;
	}

	private async setSession(session: FewStepsAwayAuthSession): Promise<void> {
		this.session = session;
		await this.persistSession(session);
		this.updateContextKeys();
		this._onDidChangeAuthState.fire();
	}

	private async persistSession(session: FewStepsAwayAuthSession): Promise<void> {
		await this.secretStorageService.set(SECRET_ACCESS_TOKEN, session.accessToken);
		await this.secretStorageService.set(SECRET_REFRESH_TOKEN, session.refreshToken);
		await this.secretStorageService.set(SECRET_USER, JSON.stringify(session.user));
	}

	private async clearSession(): Promise<void> {
		this.session = undefined;
		this.pendingOAuth = undefined;
		await this.secretStorageService.delete(SECRET_ACCESS_TOKEN);
		await this.secretStorageService.delete(SECRET_REFRESH_TOKEN);
		await this.secretStorageService.delete(SECRET_USER);
		this.updateContextKeys();
		this._onDidChangeAuthState.fire();
	}

	private updateContextKeys(): void {
		this.signedInContext.set(this.isSignedIn());
		this.authPendingContext.set(this.isAuthPending());
	}
}
