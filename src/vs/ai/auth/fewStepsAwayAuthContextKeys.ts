/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from '../../platform/contextkey/common/contextkey.js';

export const FEWSTEPSAWAY_SIGNED_IN_KEY = 'fewstepsaway.signedIn';
export const FEWSTEPSAWAY_AUTH_PENDING_KEY = 'fewstepsaway.authPending';

export const FewStepsAwayAuthContextKeys = {
	SignedIn: new RawContextKey<boolean>(FEWSTEPSAWAY_SIGNED_IN_KEY, false, true),
	AuthPending: new RawContextKey<boolean>(FEWSTEPSAWAY_AUTH_PENDING_KEY, false, true),
} as const;
