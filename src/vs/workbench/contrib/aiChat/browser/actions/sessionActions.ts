/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor, IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js';
import { FewStepsAwayChatViewId } from '../aiChatIds.js';
import { SessionHistory } from '../sessionHistory.js';
import { startNewFewStepsAwaySession } from '../fewStepsAwayChatUtils.js';

registerAction2(class NewSessionAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.newSession',
			title: localize2('fewstepsaway.chat.newSession', "New Chat"),
			icon: { id: 'codicon-add' },
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.equals('view', FewStepsAwayChatViewId),
				group: 'navigation',
				order: 1
			},
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyN,
				weight: 200,
				when: ContextKeyExpr.equals('view', FewStepsAwayChatViewId)
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await startNewFewStepsAwaySession(accessor);
	}
});

registerAction2(class OpenHistoryAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.openHistory',
			title: localize2('fewstepsaway.chat.openHistory', "Chat History"),
			icon: { id: 'codicon-history' },
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.equals('view', FewStepsAwayChatViewId),
				group: 'navigation',
				order: 2
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		const sessionHistory = instantiationService.createInstance(SessionHistory);
		await sessionHistory.show();
	}
});
