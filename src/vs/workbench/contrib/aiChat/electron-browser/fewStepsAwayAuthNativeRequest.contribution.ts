/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestChannelClient } from '../../../../platform/request/common/requestIpc.js';
import { ISharedProcessService } from '../../../../platform/ipc/electron-browser/services.js';
import { FewStepsAwayAuthService, IFewStepsAwayAuthService } from '../../../../ai/auth/fewStepsAwayAuthService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

const FEWSTEPSAWAY_REQUEST_CHANNEL = 'fewStepsAwayRequest';

export class FewStepsAwayAuthNativeRequestContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewStepsAwayAuthNativeRequest';

	constructor(
		@ISharedProcessService sharedProcessService: ISharedProcessService,
		@IFewStepsAwayAuthService authService: IFewStepsAwayAuthService,
	) {
		const nativeRequestService = new RequestChannelClient(
			sharedProcessService.getChannel(FEWSTEPSAWAY_REQUEST_CHANNEL),
		);
		(authService as FewStepsAwayAuthService).useNativeRequest(nativeRequestService);
		void authService.initialize();
	}
}

registerWorkbenchContribution2(
	FewStepsAwayAuthNativeRequestContribution.ID,
	FewStepsAwayAuthNativeRequestContribution,
	WorkbenchPhase.AfterRestored,
);
