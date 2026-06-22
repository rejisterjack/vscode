/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../../workbench/services/editor/common/editorService.js';
import { IChatService } from '../../../../../ai/common/types/conversation.types.js';
import { IBackendService } from '../../../../../ai/backend/backendService.js';
import { ChatService } from '../../../../../ai/chat/chatService.js';
import { FewStepsAwayChatViewId } from '../aiChatIds.js';
import { IViewsService } from '../../../../../workbench/services/views/common/viewsService.js';

/**
 * Context menu actions that send editor/terminal content to the chat.
 *
 * Registered under a "FewStepsAway" submenu in the editor context menu.
 */

// --- Helper: open the chat view and send a message -------------------------

async function openChatAndSend(
	accessor: ServicesAccessor,
	prompt: string,
	context?: string
): Promise<void> {
	const viewsService = accessor.get(IViewsService);
	const chatService = accessor.get(IChatService) as ChatService;
	const backendService = accessor.get(IBackendService);

	// Open the chat view in the secondary sidebar
	await viewsService.openView(FewStepsAwayChatViewId, false);

	// Ensure backend is connected and a session exists
	await backendService.ensureConnected();
	if (!chatService.getCurrentSessionId()) {
		await chatService.createConversation();
	}

	// Build the full prompt with optional code context
	const fullPrompt = context ? `${prompt}\n\n\`\`\`\n${context}\n\`\`\`` : prompt;
	const sessionId = chatService.getCurrentSessionId();
	if (sessionId) {
		await chatService.sendMessage(sessionId, fullPrompt);
	}
}

function getSelectedText(accessor: ServicesAccessor): string | undefined {
	const editorService = accessor.get(IEditorService);
	const control = editorService.activeTextEditorControl;
	if (!control) { return undefined; }
	const selection = control.getSelection();
	if (!selection) { return undefined; }
	const model = control.getModel();
	if (model && typeof (model as any).getValueInRange === 'function') {
		return (model as any).getValueInRange(selection);
	}
	return undefined;
}

function getActiveFilePath(accessor: ServicesAccessor): string | undefined {
	const editorService = accessor.get(IEditorService);
	const input = editorService.activeEditor;
	return input?.resource?.fsPath;
}

// --- Actions ---------------------------------------------------------------

registerAction2(class ExplainCodeAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.explainCode',
			title: localize2('fewstepsaway.explainCode', "Explain Code"),
			menu: {
				id: MenuId.EditorContext,
				group: 'fewstepsaway',
				order: 1
			}
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
			menu: {
				id: MenuId.EditorContext,
				group: 'fewstepsaway',
				order: 2
			}
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const selection = getSelectedText(accessor);
		if (!selection) { return; }
		const prompt = localize('fewstepsaway.fix.prompt', "Find and fix any bugs in this code:");
		await openChatAndSend(accessor, prompt, selection);
	}
});

registerAction2(class ImproveCodeAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.improveCode',
			title: localize2('fewstepsaway.improveCode', "Improve Code"),
			menu: {
				id: MenuId.EditorContext,
				group: 'fewstepsaway',
				order: 3
			}
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const selection = getSelectedText(accessor);
		if (!selection) { return; }
		const prompt = localize('fewstepsaway.improve.prompt', "Improve this code (readability, performance, best practices):");
		await openChatAndSend(accessor, prompt, selection);
	}
});

registerAction2(class AddToContextAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.chat.addToContext',
			title: localize2('fewstepsaway.addToContext', "Add to Chat Context"),
			menu: {
				id: MenuId.EditorContext,
				group: 'fewstepsaway',
				order: 4
			}
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const selection = getSelectedText(accessor);
		const path = getActiveFilePath(accessor);
		if (!selection) { return; }
		// For now, just open the chat and send the code as context.
		// Phase 7 will add persistent context attachments.
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
			menu: {
				id: MenuId.EditorContext,
				group: 'fewstepsaway',
				order: 5
			}
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const selection = getSelectedText(accessor);
		if (!selection) { return; }
		const prompt = localize('fewstepsaway.generateTests.prompt', "Generate unit tests for this code:");
		await openChatAndSend(accessor, prompt, selection);
	}
});
