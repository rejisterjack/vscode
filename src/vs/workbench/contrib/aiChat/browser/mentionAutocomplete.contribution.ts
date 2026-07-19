/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { getFewStepsAwayWidget, openFewStepsAwayChat } from './fewStepsAwayChatUtils.js';

interface MentionPick extends IQuickPickItem {
	readonly mention: string;
}

const MENTION_PICKS: MentionPick[] = [
	{ label: '@file', description: localize('fewstepsaway.mention.file', "Attach a workspace file"), mention: '@file:' },
	{ label: '@folder', description: localize('fewstepsaway.mention.folder', "List folder contents"), mention: '@folder:' },
	{ label: '@symbol', description: localize('fewstepsaway.mention.symbol', "Find symbol (path#Name)"), mention: '@symbol:' },
	{ label: '@codebase', description: localize('fewstepsaway.mention.codebase', "Semantic codebase search"), mention: '@codebase' },
	{ label: '@git:status', description: localize('fewstepsaway.mention.gitStatus', "Git working tree status"), mention: '@git:status' },
	{ label: '@git:diff', description: localize('fewstepsaway.mention.gitDiff', "Git unstaged diff"), mention: '@git:diff' },
	{ label: '@commit', description: localize('fewstepsaway.mention.commit', "Show commit details"), mention: '@commit:' },
	{ label: '@branch', description: localize('fewstepsaway.mention.branch', "List matching branches"), mention: '@branch:' },
	{ label: '@selection', description: localize('fewstepsaway.mention.selection', "Current editor selection"), mention: '@selection' },
	{ label: '@web', description: localize('fewstepsaway.mention.web', "Web search query"), mention: '@web:' },
	{ label: '@terminal', description: localize('fewstepsaway.mention.terminal', "Terminal output placeholder"), mention: '@terminal' },
];

async function insertMention(accessor: ServicesAccessor, token: string): Promise<void> {
	const widget = await openFewStepsAwayChat(accessor, true) ?? getFewStepsAwayWidget(accessor);
	const current = widget?.getInput?.() ?? '';
	const prefix = current && !current.endsWith(' ') ? `${current} ` : current;
	widget?.setInput?.(`${prefix}${token}`);
}

registerAction2(class InsertMentionAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.insertMention',
			title: localize2('fewstepsaway.insertMention', "Insert @ Mention"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const editorService = accessor.get(IEditorService);

		const activePath = editorService.activeEditor?.resource?.fsPath;
		const picks = MENTION_PICKS.map(pick => {
			if (pick.mention === '@file:' && activePath) {
				return { ...pick, mention: `@file:${activePath}` };
			}
			if (pick.mention === '@symbol:' && activePath) {
				return { ...pick, mention: `@symbol:${activePath}#` };
			}
			return pick;
		});

		const selected = await quickInputService.pick(picks, {
			placeHolder: localize('fewstepsaway.insertMention.placeholder', "Choose an @ mention to insert into chat"),
			matchOnDescription: true,
		});
		if (!selected) {
			return;
		}
		await insertMention(accessor, (selected as MentionPick).mention);
	}
});
