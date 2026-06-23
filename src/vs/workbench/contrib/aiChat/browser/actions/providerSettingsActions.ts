/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { FEWSTEPSAWAY_OPEN_PROVIDER_SETTINGS_COMMAND_ID } from '../../../../../ai/mode/modeIcons.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';

/** Settings search query -- `@id:ai` matches a setting *key*, not the configuration section id. */
const AI_SETTINGS_QUERY = 'ai.provider';

const COPILOT_SETUP_COMMANDS = [
	'workbench.action.chat.triggerSetup',
	'workbench.action.chat.triggerSetupAnonymousWithoutDialog',
	'workbench.action.chat.triggerSetupForceSignIn',
	'workbench.action.chat.triggerSetupFromAccounts',
	'workbench.action.chat.upgradePlan',
] as const;

export function openFewStepsAwayProviderSettings(accessor: ServicesAccessor): Promise<unknown> {
	return accessor.get(IPreferencesService).openSettings({
		query: AI_SETTINGS_QUERY,
		focusSearch: true,
	});
}

registerAction2(class OpenProviderSettingsAction extends Action2 {
	constructor() {
		super({
			id: FEWSTEPSAWAY_OPEN_PROVIDER_SETTINGS_COMMAND_ID,
			title: localize2('fewstepsaway.openProviderSettings', "Configure AI Providers"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): Promise<unknown> {
		return openFewStepsAwayProviderSettings(accessor);
	}
});

/**
 * Redirect Copilot setup flows to FewStepsAway provider settings.
 * Registered last so it takes precedence over GitHub Copilot handlers.
 */
export function registerCopilotSetupRedirects(): void {
	for (const commandId of COPILOT_SETUP_COMMANDS) {
		CommandsRegistry.registerCommand(commandId, accessor => openFewStepsAwayProviderSettings(accessor));
	}
}

registerCopilotSetupRedirects();
