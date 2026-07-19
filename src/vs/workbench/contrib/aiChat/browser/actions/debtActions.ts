/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IDebtRadarService } from '../../../../../ai/debt/debtTypes.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';

registerAction2(class DebtHotspotsAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.debt.hotspots',
			title: localize2('fewstepsaway.debt.hotspots', "Technical Debt Radar — Show Hotspots"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const debt = accessor.get(IDebtRadarService);
		const notifications = accessor.get(INotificationService);
		const hotspots = await debt.getHotspots(10);
		if (hotspots.length === 0) {
			notifications.info('No debt hotspots found.');
			return;
		}
		const body = hotspots
			.map(h => `${h.uri.fsPath} (score ${h.score}): ${h.factors.join(', ')}`)
			.join('\n');
		notifications.info(body);
	}
});
