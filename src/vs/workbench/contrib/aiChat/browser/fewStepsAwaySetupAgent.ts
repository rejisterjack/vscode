/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IFewStepsAwayAuthService } from '../../../../ai/auth/fewStepsAwayAuthService.js';
import {
	FEWSTEPSAWAY_OPEN_PROVIDER_SETTINGS_COMMAND_ID,
	FEWSTEPSAWAY_SIGN_IN_COMMAND_ID,
} from '../../../../ai/mode/modeIcons.js';
import {
	IChatAgentHistoryEntry,
	IChatAgentImplementation,
	IChatAgentRequest,
	IChatAgentResult,
} from '../../chat/common/participants/chatAgents.js';
import { IChatProgress } from '../../chat/common/chatService/chatService.js';

/**
 * Placeholder agent shown when the user is not signed in to FewStepsAway.
 */
export class FewStepsAwaySetupAgent extends Disposable implements IChatAgentImplementation {

	private static readonly SETUP_MESSAGE = new MarkdownString(
		localize(
			'fewstepsaway.setupNeeded',
			"Sign in to FewStepsAway to use AI chat. You can still configure API keys in settings before signing in."
		)
	);

	constructor(
		@IFewStepsAwayAuthService private readonly authService: IFewStepsAwayAuthService,
	) {
		super();
	}

	async invoke(
		request: IChatAgentRequest,
		progress: (parts: IChatProgress[]) => void,
		_history: IChatAgentHistoryEntry[],
		_token: CancellationToken
	): Promise<IChatAgentResult> {
		if (this.authService.isSignedIn()) {
			return {
				errorDetails: {
					message: localize('fewstepsaway.setupAlreadySignedIn', "You are signed in. Start a new chat if responses still show this message."),
					responseIsIncomplete: true,
				},
			};
		}

		progress([{
			kind: 'markdownContent',
			content: FewStepsAwaySetupAgent.SETUP_MESSAGE,
		}]);
		progress([{
			kind: 'command',
			command: {
				id: FEWSTEPSAWAY_SIGN_IN_COMMAND_ID,
				title: localize('fewstepsaway.setup.signIn', "Sign in to FewStepsAway"),
			},
		}]);
		progress([{
			kind: 'command',
			command: {
				id: FEWSTEPSAWAY_OPEN_PROVIDER_SETTINGS_COMMAND_ID,
				title: localize('fewstepsaway.setup.configureProviders', "Configure AI Providers"),
			},
		}]);

		return {};
	}
}
