/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { AIMode } from '../../../../../ai/common/types/ai.types.js';
import { IModeRegistry } from '../../../../../ai/mode/modeRegistry.js';
import { FewStepsAwayChatViewId } from '../aiChatIds.js';

const MODES: readonly AIMode[] = ['coding', 'ask', 'architect', 'debug', 'plan', 'learning', 'review'];

function getModeLabel(mode: AIMode): string {
	switch (mode) {
		case 'coding': return localize('fewstepsaway.mode.coding', "Code");
		case 'ask': return localize('fewstepsaway.mode.ask', "Ask");
		case 'architect': return localize('fewstepsaway.mode.architect', "Architect");
		case 'debug': return localize('fewstepsaway.mode.debug', "Debug");
		case 'plan': return localize('fewstepsaway.mode.plan', "Plan");
		case 'learning': return localize('fewstepsaway.mode.learning', "Learning");
		case 'review': return localize('fewstepsaway.mode.review', "Review");
	}
}

registerAction2(class CycleModeAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.cycleMode',
			title: localize2('fewstepsaway.chat.cycleMode', "Cycle Chat Mode"),
			f1: true,
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.Period,
				weight: 200,
				when: ContextKeyExpr.equals('view', FewStepsAwayChatViewId),
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const configService = accessor.get(IConfigurationService);
		const modeRegistry = accessor.get(IModeRegistry);
		const current = configService.getValue<AIMode>('ai.chat.mode') ?? 'coding';
		const currentIdx = MODES.indexOf(current);
		const next = MODES[(currentIdx + 1) % MODES.length];
		await configService.updateValue('ai.chat.mode', next);
		modeRegistry.setActiveMode(next);
	}
});

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
					order: MODES.indexOf(mode) + 10,
				},
				toggled: ContextKeyExpr.equals('config.ai.chat.mode', mode),
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const configService = accessor.get(IConfigurationService);
			const modeRegistry = accessor.get(IModeRegistry);
			await configService.updateValue('ai.chat.mode', mode);
			modeRegistry.setActiveMode(mode);
		}
	});
}
