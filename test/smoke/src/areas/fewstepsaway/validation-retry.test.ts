/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application, Logger } from '../../../../automation';
import { installAllHandlers } from '../../utils';

export function setup(logger: Logger) {
	describe('FewStepsAway Validation Retry', () => {

		installAllHandlers(logger);

		it('opens chat for validation retry flow', async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.runCommand('fewstepsaway.panel.chat');
			await app.workbench.quickaccess.runCommand('fewstepsaway.backgroundAgent.enqueue');
		});
	});
}
