/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IModeRegistry } from '../../../../../ai/mode/modeRegistry.js';
import { sendFewStepsAwayMessage } from '../fewStepsAwayChatUtils.js';
import { IFewStepsAwayAuthService } from '../../../../../ai/auth/fewStepsAwayAuthService.js';
import { IRequestService } from '../../../../../platform/request/common/request.js';
import { FewStepsAwayApiClient } from '../../../../../ai/auth/fewStepsAwayApiClient.js';
import { IReviewFindingsService } from '../../../../../ai/review/reviewFindingsService.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { ReviewFindingsViewId } from '../reviewPanel.contribution.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';

const REVIEW_PROMPT = `Review my uncommitted changes. Report findings as JSON in a fenced code block with a "findings" array (severity, file, line, message).`;

async function runReview(accessor: ServicesAccessor): Promise<void> {
	const configService = accessor.get(IConfigurationService);
	const modeRegistry = accessor.get(IModeRegistry);

	await configService.updateValue('ai.chat.mode', 'review');
	modeRegistry.setActiveMode('review');
	await sendFewStepsAwayMessage(accessor, REVIEW_PROMPT);
}

registerAction2(class ReviewChangesAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.reviewChanges',
			title: localize2('fewstepsaway.reviewChanges', "Review Changes"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		return runReview(accessor);
	}
});

CommandsRegistry.registerCommand('fewstepsaway.bugbot', (accessor: ServicesAccessor) => runReview(accessor));

registerAction2(class ReviewPrAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.reviewPr',
			title: localize2('fewstepsaway.reviewPr', "Review Pull Request"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const authService = accessor.get(IFewStepsAwayAuthService);
		const configService = accessor.get(IConfigurationService);
		const requestService = accessor.get(IRequestService);
		const reviewFindings = accessor.get(IReviewFindingsService);
		const viewsService = accessor.get(IViewsService);

		const prUrl = await quickInputService.input({
			prompt: localize2('fewstepsaway.reviewPr.url', "GitHub PR URL").value,
			placeHolder: 'https://github.com/org/repo/pull/123',
		});
		if (!prUrl) {
			return;
		}
		const repo = await quickInputService.input({
			prompt: localize2('fewstepsaway.reviewPr.repo', "Repository (org/repo)").value,
		});
		if (!repo) {
			return;
		}
		const orgId = configService.getValue<string>('ai.backend.organizationId');
		const token = await authService.getAccessToken();
		if (!token || !orgId) {
			await sendFewStepsAwayMessage(accessor, `Review this PR: ${prUrl}`);
			return;
		}
		const baseUrl = (configService.getValue<string>('ai.backend.apiUrl') ?? 'http://localhost:21000/api/v1').replace(/\/$/, '');
		const client = new FewStepsAwayApiClient(requestService, baseUrl);
		const { task } = await client.queuePrReview(token, {
			prUrl,
			repo,
			organizationId: orgId,
			postToGitHub: configService.getValue<boolean>('ai.review.postToGitHub') ?? false,
		});
		for (let i = 0; i < 60; i++) {
			await new Promise(r => setTimeout(r, 2000));
			const status = await client.getTask(token, task.id);
			if (status.status === 'done' && status.result) {
				const findings = reviewFindings.parseFindings(status.result);
				if (findings.length > 0) {
					reviewFindings.setFindings(findings);
					await viewsService.openView(ReviewFindingsViewId, true);
				}
				return;
			}
			if (status.status === 'failed') {
				return;
			}
		}
	}
});
