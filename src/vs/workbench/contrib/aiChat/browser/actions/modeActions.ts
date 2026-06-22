/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { FewStepsAwayChatViewId } from '../aiChatIds.js';

/**
 * Chat mode switching actions.
 *
 * The mode (coding, architect, debug, learning) controls the system prompt
 * and behavior of the assistant. Cycled via Ctrl+. or selected via toolbar.
 */

const MODES = ['coding', 'architect', 'debug', 'learning'] as const;
type ChatMode = typeof MODES[number];

function getModeLabel(mode: ChatMode): string {
	switch (mode) {
		case 'coding': return localize('fewstepsaway.mode.coding', "Coding");
		case 'architect': return localize('fewstepsaway.mode.architect', "Architect");
		case 'debug': return localize('fewstepsaway.mode.debug', "Debug");
		case 'learning': return localize('fewstepsaway.mode.learning', "Learning");
	}
}

// Cycle mode action (Ctrl+.)
registerAction2(class CycleModeAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.cycleMode',
			title: localize2('fewstepsaway.chat.cycleMode', "Cycle Chat Mode"),
			f1: true,
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.Period,
				weight: 200, // KeybindingWeight.WorkbenchContrib
				when: ContextKeyExpr.equals('view', FewStepsAwayChatViewId)
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const configService = accessor.get(IConfigurationService);
		const current = configService.getValue<ChatMode>('ai.chat.mode') ?? 'coding';
		const currentIdx = MODES.indexOf(current);
		const nextIdx = (currentIdx + 1) % MODES.length;
		const next = MODES[nextIdx];
		await configService.updateValue('ai.chat.mode', next);
	}
});

// Individual mode-set actions registered under a submenu in the view title
for (const mode of MODES) {
	registerAction2(class extends Action2 {
		constructor() {
			super({
				id: `fewstepsaway.chat.setMode.${mode}`,
				title: localize2(`fewstepsaway.chat.setMode.${mode}`, "Mode: {0}", getModeLabel(mode)),
				menu: {
					id: MenuId.ViewTitle,
					when: ContextKeyExpr.equals('view', FewStepsAwayChatViewId),
					group: 'mode',
					order: MODES.indexOf(mode) + 10
				},
				toggled: ContextKeyExpr.equals('config.ai.chat.mode', mode)
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const configService = accessor.get(IConfigurationService);
			await configService.updateValue('ai.chat.mode', mode);
		}
	});
}
