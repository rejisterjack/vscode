/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ComposerFileEdit, ComposerHunkStatus } from '../../../../../ai/composer/composerTypes.js';
import { getEffectiveModified } from '../../../../../ai/composer/composerHunkUtils.js';
import { DiffEditorWidget } from '../../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IModelService } from '../../../../../editor/common/services/model.js';

export type HunkActionHandler = (editId: string, hunkId: string, status: ComposerHunkStatus) => void;

const DIFF_HEIGHT = 220;

/**
 * Per-hunk diff preview with Monaco diff editor and accept/reject controls.
 */
export class ComposerDiffView extends Disposable {
	private readonly root: HTMLElement;
	private diffEditor: DiffEditorWidget | undefined;

	constructor(
		parent: HTMLElement,
		private readonly instantiationService: IInstantiationService,
		private readonly modelService: IModelService,
		private readonly onHunkAction?: HunkActionHandler,
	) {
		super();
		this.root = append(parent, $('div.fewstepsaway-composer-diff-view'));
	}

	renderEdit(edit: ComposerFileEdit): void {
		this.disposeDiffEditor();
		clearNode(this.root);
		const header = append(this.root, $('div.diff-header'));
		header.textContent = `${edit.uri.fsPath} — ${edit.hunks.length} hunk(s)`;

		const diffHost = append(this.root, $('div.composer-monaco-diff-host'));
		diffHost.style.height = `${DIFF_HEIGHT}px`;
		diffHost.style.minHeight = `${DIFF_HEIGHT}px`;

		this.diffEditor = this._register(this.instantiationService.createInstance(DiffEditorWidget, diffHost, {
			readOnly: true,
			renderSideBySide: false,
			minimap: { enabled: false },
			scrollBeyondLastLine: false,
			overviewRulerLanes: 0,
			renderOverviewRuler: false,
			renderGutterMenu: false,
			hideUnchangedRegions: { enabled: true, contextLineCount: 2 },
			compactMode: true,
		}, {}));

		const effectiveModified = getEffectiveModified(edit.original, edit.hunks);
		const originalModel = this.modelService.createModel(
			edit.original,
			null,
			URI.from({ scheme: 'composer-diff', path: `${edit.id}/original` }),
		);
		const modifiedModel = this.modelService.createModel(
			effectiveModified,
			null,
			URI.from({ scheme: 'composer-diff', path: `${edit.id}/modified` }),
		);
		this._register(originalModel);
		this._register(modifiedModel);
		this.diffEditor.setModel({ original: originalModel, modified: modifiedModel });
		this.diffEditor.layout({ width: diffHost.clientWidth || 480, height: DIFF_HEIGHT });

		for (const hunk of edit.hunks) {
			const block = append(this.root, $('div.diff-hunk-block'));
			block.classList.add(`hunk-${hunk.status}`);
			const meta = append(block, $('div.diff-hunk-meta'));
			meta.textContent = `Lines ${hunk.startLine}-${hunk.endLine} (${hunk.status})`;
			if (edit.status === 'pending' && this.onHunkAction) {
				const actions = append(block, $('div.diff-hunk-actions'));
				const accept = append(actions, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
				accept.textContent = 'Accept hunk';
				accept.onclick = () => this.onHunkAction!(edit.id, hunk.id, 'accepted');
				const reject = append(actions, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
				reject.textContent = 'Reject hunk';
				reject.onclick = () => this.onHunkAction!(edit.id, hunk.id, 'rejected');
			}
		}
	}

	private disposeDiffEditor(): void {
		if (this.diffEditor) {
			this.diffEditor.dispose();
			this.diffEditor = undefined;
		}
	}

	override dispose(): void {
		this.disposeDiffEditor();
		super.dispose();
	}
}
