/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IFewStepsAwayAuthService } from '../../../../../ai/auth/fewStepsAwayAuthService.js';
import { FEWSTEPSAWAY_SIGN_IN_COMMAND_ID, FEWSTEPSAWAY_SIGN_OUT_COMMAND_ID } from '../../../../../ai/mode/modeIcons.js';

registerAction2(class FewStepsAwaySignInAction extends Action2 {
	constructor() {
		super({
			id: FEWSTEPSAWAY_SIGN_IN_COMMAND_ID,
			title: localize2('fewstepsaway.auth.signIn', "Sign in to FewStepsAway"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const authService = accessor.get(IFewStepsAwayAuthService);
		const notificationService = accessor.get(INotificationService);
		try {
			await authService.signInWithOAuth();
		} catch (error) {
			notificationService.error(error instanceof Error ? error.message : String(error));
		}
	}
});

registerAction2(class FewStepsAwaySignOutAction extends Action2 {
	constructor() {
		super({
			id: FEWSTEPSAWAY_SIGN_OUT_COMMAND_ID,
			title: localize2('fewstepsaway.auth.signOut', "Sign out of FewStepsAway"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const authService = accessor.get(IFewStepsAwayAuthService);
		await authService.signOut();
		accessor.get(INotificationService).info(localize('fewstepsaway.auth.signedOut', "Signed out of FewStepsAway."));
	}
});
