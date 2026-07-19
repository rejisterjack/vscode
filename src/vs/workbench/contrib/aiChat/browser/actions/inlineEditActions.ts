/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../../workbench/services/editor/common/editorService.js';
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js';
import { isCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { sendFewStepsAwayMessage } from '../fewStepsAwayChatUtils.js';
import { IInlineEditSessionService } from '../inlineEditSession.js';
import { InlineEditZoneWidget } from '../inlineEditZoneWidget.js';
import { IEditIntegrityService } from '../../../../../ai/integrity/editIntegrityService.js';
import { getChatEditingBridge } from '../agentChatEditingBridge.js';
import { getFewStepsAwaySessionResource } from '../fewStepsAwayChatUtils.js';
import { IChatWidgetService } from '../../../chat/browser/chat.js';

registerAction2(class InlineEditAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.inlineEdit',
			title: localize2('fewstepsaway.inlineEdit', "Inline Edit (Cmd+K)"),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.KeyK,
				when: undefined,
				weight: 200,
			},
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const inlineEditSession = accessor.get(IInlineEditSessionService);
		const control = editorService.activeTextEditorControl;
		if (!control || !isCodeEditor(control)) {
			return;
		}
		const selection = control.getSelection();
		const model = control.getModel();
		if (!selection || !model) {
			return;
		}
		const selected = model.getValueInRange(selection);
		if (!selected.trim()) {
			return;
		}
		const range = Range.lift(selection);
		inlineEditSession.setPending({
			uri: model.uri,
			range,
			originalText: selected,
		});

		const zone = new InlineEditZoneWidget(control, range);
		zone.onDidSubmit(async ({ prompt, range: anchorRange }) => {
			const userPrompt = localize(
				'fewstepsaway.inlineEdit.prompt',
				"Edit the selected code. Return only the replacement for the selection:\n\n{0}\n\nInstruction: {1}",
				selected,
				prompt,
			);
			await sendFewStepsAwayMessage(accessor, userPrompt);
		});
		zone.show();
	}
});

registerAction2(class InlineEditAcceptAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.inlineEdit.accept',
			title: localize2('fewstepsaway.inlineEdit.accept', "Accept Inline Edit"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const inlineEditSession = accessor.get(IInlineEditSessionService);
		const editIntegrity = accessor.get(IEditIntegrityService);
		const pending = inlineEditSession.peekPending();
		const preview = inlineEditSession.getPreview();
		if (!pending || !preview) {
			return;
		}
		const validation = await editIntegrity.safeWrite(pending.uri, preview.fullModified, { composerStaged: false });
		if (validation && !validation.ok) {
			return;
		}
		const sessionResource = getFewStepsAwaySessionResource(accessor.get(IChatWidgetService));
		if (sessionResource) {
			getChatEditingBridge()?.notifyFileEdit(sessionResource, pending.uri, await editIntegrity.readFileContent(pending.uri), preview.fullModified);
		}
		inlineEditSession.markApplied();
	}
});
