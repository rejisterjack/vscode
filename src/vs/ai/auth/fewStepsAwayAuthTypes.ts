/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface FewStepsAwayUserProfile {
	readonly id: string;
	readonly email: string;
	readonly name?: string | null;
	readonly status?: string;
	readonly role?: string;
	readonly mfaEnabled?: boolean;
}

export interface FewStepsAwayAuthSession {
	readonly accessToken: string;
	readonly refreshToken: string;
	readonly user: FewStepsAwayUserProfile;
}

export interface FewStepsAwayLoginResult {
	readonly status: 'success' | 'mfa_required';
	readonly accessToken?: string;
	readonly refreshToken?: string;
	readonly mfaChallengeToken?: string;
	readonly user?: FewStepsAwayUserProfile;
}

export interface FewStepsAwayOAuthTokenResponse {
	readonly access_token: string;
	readonly refresh_token: string;
	readonly token_type: string;
	readonly expires_in: number;
}

export interface FewStepsAwayRefreshResponse {
	readonly accessToken: string;
	readonly refreshToken: string;
	readonly user: FewStepsAwayUserProfile;
}
