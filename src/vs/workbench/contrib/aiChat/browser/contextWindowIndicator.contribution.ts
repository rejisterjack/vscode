/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { FewStepsAwayChatViewId } from '../aiChatIds.js';
import { isIChatViewViewContext } from '../../chat/browser/chat.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
import { localize } from '../../../../nls.js';

const MAX_CONTEXT_TOKENS = 128_000;

class ContextWindowIndicatorContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.fewstepsaway.contextWindow';

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
	) {
		super();
		const entry = this._register(this.statusbarService.addEntry(
			{
				name: 'fewstepsaway.contextWindow',
				text: '$(symbol-namespace) 0%',
				ariaLabel: localize('fewstepsaway.contextWindow', "Context window usage"),
				tooltip: localize('fewstepsaway.contextWindow.tip', "Estimated context window usage for FewStepsAway chat"),
			},
			'fewstepsaway.contextWindow',
			StatusbarAlignment.RIGHT,
			100,
		));
		const interval = setInterval(() => {
			const widget = this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat)
				.find(w => isIChatViewViewContext(w.viewContext) && w.viewContext.viewId === FewStepsAwayChatViewId);
			const input = widget?.getInput?.() ?? '';
			const tokens = Math.ceil(input.length / 4);
			const pct = Math.min(100, Math.round((tokens / MAX_CONTEXT_TOKENS) * 100));
			entry.update({
				text: `$(symbol-namespace) ${pct}%`,
				ariaLabel: localize('fewstepsaway.contextWindow.pct', "{0}% context used", pct),
			});
		}, 2000);
		this._register({ dispose: () => clearInterval(interval) });
	}
}

registerWorkbenchContribution2(ContextWindowIndicatorContribution.ID, ContextWindowIndicatorContribution, WorkbenchPhase.Eventually);
