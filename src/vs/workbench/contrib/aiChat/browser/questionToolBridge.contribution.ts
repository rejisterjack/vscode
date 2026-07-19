/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IToolRegistry } from '../../../../ai/tool/toolRegistry.js';
import { QuestionTool } from '../../../../ai/tool/tools/questionTool.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

class QuestionToolBridgeContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.fewstepsaway.questionToolBridge';

	constructor(
		@IToolRegistry private readonly toolRegistry: IToolRegistry,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
	) {
		super();
		const tool = this.toolRegistry.getTool('question') as QuestionTool | undefined;
		if (!tool) {
			return;
		}
		this._register(tool.onDidAskQuestion(async (question) => {
			const picks: IQuickPickItem[] = question.options.map(option => ({
				label: option.label,
				description: option.description,
				id: option.id,
			}));
			let selectedIds: string[];
			if (question.allowMultiple) {
				const selected = await this.quickInputService.pick(picks, {
					canPickMany: true,
					title: question.prompt,
					placeHolder: 'Select one or more options',
				});
				selectedIds = (selected ?? []).map(item => (item as IQuickPickItem & { id: string }).id);
			} else {
				const selected = await this.quickInputService.pick(picks, {
					title: question.prompt,
					placeHolder: 'Select an option',
				});
				selectedIds = selected ? [(selected as IQuickPickItem & { id: string }).id] : [];
			}
			tool.answerQuestion({ [question.id]: selectedIds });
		}));
	}
}

registerWorkbenchContribution2(QuestionToolBridgeContribution.ID, QuestionToolBridgeContribution, WorkbenchPhase.AfterRestored);
