/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../workbench/services/editor/common/editorService.js';
import { ICodeEditor } from '../../editor/browser/editorBrowser.js';
import { Range } from '../../editor/common/core/range.js';

export const IVisibleCodeTracker = createDecorator<IVisibleCodeTracker>('ai.visibleCodeTracker');

export interface IVisibleCodeTracker {
	readonly _serviceBrand: undefined;
	getVisibleSnippets(maxSnippets?: number, maxLinesPerSnippet?: number): VisibleSnippet[];
}

/**
 * A snippet of visible code in an open editor.
 */
export interface VisibleSnippet {
	readonly filePath: string;
	readonly range: Range;
	readonly text: string;
}

/**
 * Tracks the visible code ranges across all open editors. Used by Next Edit
 * Suggestions (NES) and chat textarea autocomplete to provide context.
 *
 * Port of `references/kilocode/packages/kilo-vscode/src/services/autocomplete/VisibleCodeTracker.ts`.
 */
export class VisibleCodeTracker extends Disposable implements IVisibleCodeTracker {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IEditorService private readonly editorService: IEditorService
	) {
		super();
	}

	/**
	 * Get the currently visible code snippets from all open editors.
	 */
	getVisibleSnippets(maxSnippets = 5, maxLinesPerSnippet = 50): VisibleSnippet[] {
		const snippets: VisibleSnippet[] = [];
		const editors = this.editorService.visibleTextEditorControls as ICodeEditor[];
		for (const editor of editors) {
			if (snippets.length >= maxSnippets) { break; }
			const model = editor.getModel();
			if (!model) { continue; }
			const filePath = model.uri.fsPath;
			for (const range of editor.getVisibleRanges()) {
				if (snippets.length >= maxSnippets) { break; }
				const clampedRange = new Range(
					Math.max(1, range.startLineNumber),
					1,
					Math.min(model.getLineCount(), range.startLineNumber + maxLinesPerSnippet),
					model.getLineMaxColumn(Math.min(model.getLineCount(), range.startLineNumber + maxLinesPerSnippet))
				);
				snippets.push({
					filePath,
					range: clampedRange,
					text: model.getValueInRange(clampedRange)
				});
			}
		}
		return snippets;
	}
}
