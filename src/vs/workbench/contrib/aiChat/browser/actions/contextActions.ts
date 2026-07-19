/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../../workbench/services/editor/common/editorService.js';
import { sendFewStepsAwayMessage } from '../fewStepsAwayChatUtils.js';

async function openChatAndSend(
	accessor: ServicesAccessor,
	prompt: string,
	context?: string
): Promise<void> {
	const fullPrompt = context ? `${prompt}\n\n\`\`\`\n${context}\n\`\`\`` : prompt;
	await sendFewStepsAwayMessage(accessor, fullPrompt);
}

function getSelectedText(accessor: ServicesAccessor): string | undefined {
	const editorService = accessor.get(IEditorService);
	const control = editorService.activeTextEditorControl;
	if (!control) { return undefined; }
	const selection = control.getSelection();
	if (!selection) { return undefined; }
	const model = control.getModel();
	if (model && typeof (model as { getValueInRange?: (s: unknown) => string }).getValueInRange === 'function') {
		return (model as { getValueInRange: (s: unknown) => string }).getValueInRange(selection);
	}
	return undefined;
}

function getActiveFilePath(accessor: ServicesAccessor): string | undefined {
	const editorService = accessor.get(IEditorService);
	const input = editorService.activeEditor;
	return input?.resource?.fsPath;
}

registerAction2(class ExplainCodeAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.explainCode',
			title: localize2('fewstepsaway.explainCode', "Explain Code"),
			menu: { id: MenuId.EditorContext, group: 'fewstepsaway', order: 1 }
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const selection = getSelectedText(accessor);
		const path = getActiveFilePath(accessor);
		if (!selection) { return; }
		const prompt = localize('fewstepsaway.explain.prompt', "Explain this code{0}: ", path ? ` from ${path}` : '');
		await openChatAndSend(accessor, prompt, selection);
	}
});

registerAction2(class FixCodeAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.fixCode',
			title: localize2('fewstepsaway.fixCode', "Fix Code"),
			menu: { id: MenuId.EditorContext, group: 'fewstepsaway', order: 2 }
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const selection = getSelectedText(accessor);
		if (!selection) { return; }
		await openChatAndSend(accessor, localize('fewstepsaway.fix.prompt', "Find and fix any bugs in this code:"), selection);
	}
});

registerAction2(class ImproveCodeAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.improveCode',
			title: localize2('fewstepsaway.improveCode', "Improve Code"),
			menu: { id: MenuId.EditorContext, group: 'fewstepsaway', order: 3 }
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const selection = getSelectedText(accessor);
		if (!selection) { return; }
		await openChatAndSend(accessor, localize('fewstepsaway.improve.prompt', "Improve this code (readability, performance, best practices):"), selection);
	}
});

registerAction2(class AddToContextAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.addToContext',
			title: localize2('fewstepsaway.addToContext', "Add to Chat Context"),
			menu: { id: MenuId.EditorContext, group: 'fewstepsaway', order: 4 }
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const selection = getSelectedText(accessor);
		const path = getActiveFilePath(accessor);
		if (!selection) { return; }
		const prompt = path
			? localize('fewstepsaway.addContext.prompt', "Here is code from {0}:", path)
			: localize('fewstepsaway.addContext.prompt.noPath', "Here is code for context:");
		await openChatAndSend(accessor, prompt, selection);
	}
});

registerAction2(class GenerateTestsAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.generateTests',
			title: localize2('fewstepsaway.generateTests', "Generate Tests"),
			menu: { id: MenuId.EditorContext, group: 'fewstepsaway', order: 5 }
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const selection = getSelectedText(accessor);
		if (!selection) { return; }
		await openChatAndSend(accessor, localize('fewstepsaway.generateTests.prompt', "Generate unit tests for this code:"), selection);
	}
});
