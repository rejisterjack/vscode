/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { isCodeBlockActionContext } from '../../../chat/browser/actions/chatCodeblockActions.js';
import { ICodeBlockApplyService } from './codeBlockApplyService.js';
import { FewStepsAwayChatViewId } from './aiChatIds.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { CHAT_CATEGORY } from '../../../chat/browser/actions/chatActions.js';

const APPLY_IN_EDITOR_ID = 'workbench.action.chat.applyInEditor';

class FewStepsAwayApplyInEditorAction extends Action2 {
	constructor() {
		super({
			id: APPLY_IN_EDITOR_ID,
			title: localize2('fewstepsaway.applyInEditor.label', "Apply in Editor"),
			category: CHAT_CATEGORY,
			icon: Codicon.gitPullRequestGoToChanges,
			f1: false,
			precondition: ChatContextKeys.enabled,
			menu: [{
				id: MenuId.ChatCodeBlock,
				group: 'navigation',
				order: 9,
				when: ContextKeyExpr.equals('view', FewStepsAwayChatViewId),
			}],
		});
	}

	override async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {
		const context = args[0];
		if (!isCodeBlockActionContext(context)) {
			return;
		}
		const applyService = accessor.get(ICodeBlockApplyService);
		const notificationService = accessor.get(INotificationService);
		const result = await applyService.applyCode(context.code, context.codemapperUri);
		if (result.ok) {
			notificationService.info(result.message);
		} else {
			notificationService.error(result.message);
		}
	}
}

class FewStepsAwayCodeBlockActionsContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.fewstepsaway.codeBlockActions';

	constructor() {
		super();
		registerAction2(FewStepsAwayApplyInEditorAction);
	}
}

registerWorkbenchContribution2(
	FewStepsAwayCodeBlockActionsContribution.ID,
	FewStepsAwayCodeBlockActionsContribution,
	WorkbenchPhase.AfterRestored,
);
