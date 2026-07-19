/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../../base/browser/dom.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { IComposerService, ComposerFileEdit } from '../../../../../ai/composer/composerTypes.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ComposerDiffView } from './composerDiffView.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IModelService } from '../../../../../editor/common/services/model.js';

/**
 * Composer dock showing staged multi-file edits with per-file accept/reject.
 */
export class ComposerDock extends Disposable {
	private readonly element: HTMLElement;
	private readonly list: HTMLElement;
	private readonly _onAcceptEdit = this._register(new Emitter<ComposerFileEdit>());
	readonly onAcceptEdit: Event<ComposerFileEdit> = this._onAcceptEdit.event;
	private readonly _onAcceptAll = this._register(new Emitter<void>());
	readonly onAcceptAll: Event<void> = this._onAcceptAll.event;
	private sessionSub: IDisposable | undefined;
	private readonly expanded = new Set<string>();

	constructor(
		parent: HTMLElement,
		private readonly composerService: IComposerService,
		private readonly instantiationService: IInstantiationService,
		private readonly modelService: IModelService,
	) {
		super();
		this.element = append(parent, $('div.fewstepsaway-composer-dock'));
		const header = append(this.element, $('div.fewstepsaway-composer-header'));
		append(header, $('span.fewstepsaway-composer-title')).textContent = 'Composer';
		const actions = append(header, $('div.fewstepsaway-composer-actions'));
		const acceptAll = append(actions, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
		acceptAll.textContent = 'Accept all';
		acceptAll.onclick = () => {
			this._onAcceptAll.fire();
		};
		const rejectAll = append(actions, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
		rejectAll.textContent = 'Reject all';
		rejectAll.onclick = () => {
			this.composerService.rejectAll();
			this.render();
		};
		this.list = append(this.element, $('div.fewstepsaway-composer-list'));
		this.sessionSub = this.composerService.onDidChangeSession(() => this.render());
		this.render();
	}

	private render(): void {
		clearNode(this.list);
		const session = this.composerService.activeSession;
		if (!session || session.edits.length === 0) {
			this.element.style.display = 'none';
			return;
		}
		this.element.style.display = 'block';
		for (const edit of session.edits) {
			this.list.appendChild(this.renderEdit(edit));
		}
	}

	private renderEdit(edit: ComposerFileEdit): HTMLElement {
		const row = $('div.fewstepsaway-composer-edit');
		row.classList.add(`status-${edit.status}`);
		const path = append(row, $('span.fewstepsaway-composer-path'));
		path.textContent = edit.uri.fsPath;
		const summary = append(row, $('pre.fewstepsaway-composer-diff'));
		const origLines = edit.original.split('\n').length;
		const modLines = edit.modified.split('\n').length;
		summary.textContent = `-${origLines} / +${modLines} lines`;

		const toggle = append(row, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
		toggle.textContent = this.expanded.has(edit.id) ? 'Hide diff' : 'Show diff';
		toggle.onclick = () => {
			if (this.expanded.has(edit.id)) {
				this.expanded.delete(edit.id);
			} else {
				this.expanded.add(edit.id);
			}
			this.render();
		};

		if (this.expanded.has(edit.id)) {
			const diffHost = append(row, $('div.fewstepsaway-composer-diff-host'));
			const diffView = new ComposerDiffView(diffHost, this.instantiationService, this.modelService, (editId, hunkId, status) => {
				this.composerService.setHunkStatus(editId, hunkId, status);
				this.render();
			});
			diffView.renderEdit(edit);
		}

		if (edit.status === 'pending') {
			const accept = append(row, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
			accept.textContent = 'Accept';
			accept.onclick = () => {
				this._onAcceptEdit.fire(edit);
			};
			const reject = append(row, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
			reject.textContent = 'Reject';
			reject.onclick = () => {
				this.composerService.rejectEdit(edit.id);
				this.render();
			};
		}
		return row;
	}

	override dispose(): void {
		this.sessionSub?.dispose();
		super.dispose();
	}
}
