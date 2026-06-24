/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNative } from '../../../../base/common/platform.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IFewStepsAwayAuthService } from '../../../../ai/auth/fewStepsAwayAuthService.js';

export class FewStepsAwayAuthContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewStepsAwayAuth';

	constructor(
		@IFewStepsAwayAuthService authService: IFewStepsAwayAuthService,
	) {
		if (!isNative) {
			void authService.initialize();
		}
	}
}

registerWorkbenchContribution2(
	FewStepsAwayAuthContribution.ID,
	FewStepsAwayAuthContribution,
	WorkbenchPhase.BlockStartup,
);
