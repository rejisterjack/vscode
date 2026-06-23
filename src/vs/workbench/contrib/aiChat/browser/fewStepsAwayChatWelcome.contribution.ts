/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { localize } from '../../../../nls.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { FewStepsAwayAuthContextKeys } from '../../../../ai/auth/fewStepsAwayAuthContextKeys.js';
import { FEWSTEPSAWAY_SIGN_IN_COMMAND_ID } from '../../../../ai/mode/modeIcons.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { chatViewsWelcomeRegistry } from '../../chat/browser/viewsWelcome/chatViewsWelcome.js';
import { FewStepsAwayChatViewId } from './aiChatIds.js';

export class FewStepsAwayChatWelcomeContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewStepsAwayChatWelcome';

	constructor(
		@IInstantiationService _instantiationService: IInstantiationService,
	) {
		chatViewsWelcomeRegistry.register({
			icon: Codicon.account,
			title: localize('fewstepsaway.welcome.title', "Sign in to FewStepsAway"),
			content: new MarkdownString(
				localize(
					'fewstepsaway.welcome.message',
					"Sign in with your FewStepsAway account to use AI chat. After signing in, configure your model providers (Z.ai, OpenAI, etc.) in settings.\n\n[Sign in](command:{0})",
					FEWSTEPSAWAY_SIGN_IN_COMMAND_ID,
				),
				{ isTrusted: { enabledCommands: [FEWSTEPSAWAY_SIGN_IN_COMMAND_ID] } }
			),
			when: ContextKeyExpr.and(
				ContextKeyExpr.equals('view', FewStepsAwayChatViewId),
				ContextKeyExpr.equals(FewStepsAwayAuthContextKeys.SignedIn.key, false),
				ContextKeyExpr.equals(FewStepsAwayAuthContextKeys.AuthPending.key, false),
			)!,
		});
	}
}

registerWorkbenchContribution2(
	FewStepsAwayChatWelcomeContribution.ID,
	FewStepsAwayChatWelcomeContribution,
	WorkbenchPhase.BlockRestore,
);
