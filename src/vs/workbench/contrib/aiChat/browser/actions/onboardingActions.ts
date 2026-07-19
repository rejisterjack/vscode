/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IOnboardingService } from '../../../../../ai/onboarding/onboardingTypes.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';

registerAction2(class ImNewHereAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.onboarding.imNewHere',
			title: localize2('fewstepsaway.onboarding.imNewHere', "I'm New Here — Workspace Orientation"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const onboarding = accessor.get(IOnboardingService);
		const notifications = accessor.get(INotificationService);
		const steps = await onboarding.generateOrientation();
		const body = steps.map(s => `• ${s.title}: ${s.description}`).join('\n');
		notifications.info(body);
	}
});

registerAction2(class WhyCodeAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.onboarding.why',
			title: localize2('fewstepsaway.onboarding.why', "Why — Explain Code History"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const onboarding = accessor.get(IOnboardingService);
		const notifications = accessor.get(INotificationService);
		const answer = await onboarding.answerWhy('Why was this code written this way?');
		notifications.info(answer);
	}
});
