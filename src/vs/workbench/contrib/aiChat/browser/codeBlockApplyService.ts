/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IEditIntegrityService } from '../../../../ai/integrity/editIntegrityService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { IInlineEditSessionService } from './inlineEditSession.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { getChatEditingBridge } from './agentChatEditingBridge.js';
import { getFewStepsAwaySessionResource } from './fewStepsAwayChatUtils.js';
import { URI } from '../../../../base/common/uri.js';
import { Range } from '../../../../editor/common/core/range.js';

export const ICodeBlockApplyService = createDecorator<ICodeBlockApplyService>('fewstepsaway.codeBlockApply');

export interface CodeBlockApplyResult {
	readonly ok: boolean;
	readonly message: string;
}

export interface ICodeBlockApplyService {
	readonly _serviceBrand: undefined;
	applyCode(code: string, targetUri?: URI): Promise<CodeBlockApplyResult>;
}

export class CodeBlockApplyService implements ICodeBlockApplyService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IEditIntegrityService private readonly editIntegrity: IEditIntegrityService,
		@IEditorService private readonly editorService: IEditorService,
		@IInlineEditSessionService private readonly inlineEditSession: IInlineEditSessionService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
	) { }

	async applyCode(code: string, targetUri?: URI): Promise<CodeBlockApplyResult> {
		const trimmed = code.replace(/\n$/, '');
		if (!trimmed.trim()) {
			return { ok: false, message: 'Code block is empty.' };
		}

		const pending = this.inlineEditSession.peekPending();
		if (pending) {
			return this.applyInlineReplacement(pending.uri, pending.range, pending.originalText, trimmed);
		}

		const uri = targetUri ?? this.getActiveEditorUri();
		if (!uri) {
			return { ok: false, message: 'No active editor to apply code to.' };
		}

		const original = await this.editIntegrity.readFileContent(uri).catch(() => '');
		const validation = await this.editIntegrity.safeWrite(uri, trimmed, { composerStaged: false });
		if (validation && !validation.ok) {
			return {
				ok: false,
				message: this.editIntegrity.formatValidationMessage(validation, uri),
			};
		}
		this.notifyEditingBridge(uri, original, trimmed);
		return { ok: true, message: `Applied code to ${uri.fsPath}` };
	}

	private async applyInlineReplacement(uri: URI, range: Range, originalText: string, newText: string): Promise<CodeBlockApplyResult> {
		const content = await this.editIntegrity.readFileContent(uri);
		const currentSelection = content.slice(
			this.offsetForRange(content, range.startLineNumber, range.startColumn),
			this.offsetForRange(content, range.endLineNumber, range.endColumn),
		);
		if (currentSelection !== originalText) {
			return { ok: false, message: 'Selection text no longer matches the file (stale buffer).' };
		}
		const modified = this.replaceRange(content, range, newText);
		this.inlineEditSession.setPreview(newText, modified);
		this.notifyEditingBridge(uri, content, modified);
		return { ok: true, message: `Inline edit preview ready for ${uri.fsPath}. Accept from editor overlay or run Accept Inline Edit.` };
	}

	private replaceRange(content: string, range: Range, replacement: string): string {
		const start = this.offsetForRange(content, range.startLineNumber, range.startColumn);
		const end = this.offsetForRange(content, range.endLineNumber, range.endColumn);
		return content.slice(0, start) + replacement + content.slice(end);
	}

	private offsetForRange(content: string, lineNumber: number, column: number): number {
		const lines = content.split('\n');
		let offset = 0;
		for (let i = 0; i < lineNumber - 1; i++) {
			offset += (lines[i]?.length ?? 0) + 1;
		}
		return offset + column - 1;
	}

	private getActiveEditorUri(): URI | undefined {
		const control = this.editorService.activeTextEditorControl;
		if (!control || !isCodeEditor(control)) {
			return undefined;
		}
		return control.getModel()?.uri;
	}

	private notifyEditingBridge(uri: URI, original: string, modified: string): void {
		const sessionResource = getFewStepsAwaySessionResource(this.chatWidgetService);
		if (!sessionResource) {
			return;
		}
		getChatEditingBridge()?.notifyFileEdit(sessionResource, uri, original, modified);
	}
}

registerSingleton(ICodeBlockApplyService, CodeBlockApplyService, InstantiationType.Delayed);
