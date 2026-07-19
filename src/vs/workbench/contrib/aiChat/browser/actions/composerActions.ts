/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IComposerService } from '../../../../ai/composer/composerTypes.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { FewStepsAwayChatViewId } from './aiChatIds.js';

class OpenComposerAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.composer.open',
			title: localize('fewstepsaway.composer.open', "Open Composer"),
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyI,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const composer = accessor.get(IComposerService);
		const views = accessor.get(IViewsService);
		composer.startSession('');
		await views.openView(FewStepsAwayChatViewId, true);
	}
}

registerAction2(OpenComposerAction);
