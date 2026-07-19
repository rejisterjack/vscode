/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { IOptions, ZoneWidget } from '../../../../editor/contrib/zoneWidget/browser/zoneWidget.js';
import { Range } from '../../../../editor/common/core/range.js';
import { localize } from '../../../../nls.js';

export interface InlineEditZoneSubmitEvent {
	readonly prompt: string;
	readonly range: Range;
}

export class InlineEditZoneWidget extends ZoneWidget {
	private readonly _onDidSubmit = this._register(new Emitter<InlineEditZoneSubmitEvent>());
	readonly onDidSubmit = this._onDidSubmit.event;

	private input: HTMLTextAreaElement | undefined;

	constructor(
		editor: ICodeEditor,
		private readonly anchorRange: Range,
	) {
		super(editor, {
			showFrame: true,
			frameWidth: 1,
			isResizeable: true,
			showArrow: true,
			keepEditorSelection: true,
			className: 'fewstepsaway-inline-edit-zone',
		});
	}

	protected override _fillContainer(container: HTMLElement): void {
		const form = append(container, $('.fewstepsaway-inline-edit-form'));
		this.input = append(form, $('textarea.fewstepsaway-inline-edit-input')) as HTMLTextAreaElement;
		this.input.placeholder = localize('fewstepsaway.inlineEdit.placeholder', "Describe the edit...");
		this.input.rows = 2;

		const actions = append(form, $('.fewstepsaway-inline-edit-actions'));
		const submit = append(actions, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
		submit.textContent = localize('fewstepsaway.inlineEdit.submit', "Edit");
		submit.onclick = () => this.submit();

		this.input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				this.submit();
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				this.dispose();
			}
		});
	}

	show(): void {
		const line = this.anchorRange.endLineNumber;
		super.show({ lineNumber: line, column: 1 }, 4);
		this.input?.focus();
	}

	private submit(): void {
		const prompt = this.input?.value.trim();
		if (!prompt) {
			return;
		}
		this._onDidSubmit.fire({ prompt, range: this.anchorRange });
		this.dispose();
	}
}
