/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IURLHandler, IURLService } from '../../../../platform/url/common/url.js';
import { IFewStepsAwayAuthService } from '../../../../ai/auth/fewStepsAwayAuthService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

export class FewStepsAwayAuthCallbackHandler extends Disposable implements IWorkbenchContribution, IURLHandler {

	static readonly ID = 'workbench.contrib.fewStepsAwayAuthCallback';

	constructor(
		@IURLService urlService: IURLService,
		@IProductService private readonly productService: IProductService,
		@IFewStepsAwayAuthService private readonly authService: IFewStepsAwayAuthService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
		this._register(urlService.registerHandler(this));
	}

	async handleURL(uri: URI): Promise<boolean> {
		if (uri.scheme !== this.productService.urlProtocol) {
			return false;
		}
		if (!(uri.authority === 'auth' && uri.path === '/callback')) {
			return false;
		}

		try {
			const handled = await this.authService.handleOAuthCallback(uri.toString(true));
			if (handled) {
				this.notificationService.info('Signed in to FewStepsAway.');
			}
			return true;
		} catch (error) {
			this.notificationService.error(error instanceof Error ? error.message : String(error));
			return true;
		}
	}
}

registerWorkbenchContribution2(
	FewStepsAwayAuthCallbackHandler.ID,
	FewStepsAwayAuthCallbackHandler,
	WorkbenchPhase.BlockRestore,
);
