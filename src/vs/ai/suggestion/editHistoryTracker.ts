/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../workbench/services/editor/common/editorService.js';
import { ITextModel } from '../../editor/common/model.js';
import { Range } from '../../editor/common/core/range.js';
import { IModelContentChange } from '../../editor/common/model/mirrorTextModel.js';

export const IEditHistoryTracker = createDecorator<IEditHistoryTracker>('ai.editHistoryTracker');

export interface IEditHistoryTracker {
	readonly _serviceBrand: undefined;
	recordChange(filePath: string, model: ITextModel, changes: readonly IModelContentChange[]): void;
	getRecentEdits(filePath?: string): readonly EditRecord[];
}

/**
 * Tracks recent edits across all editors for use as context in Next Edit
 * Suggestions (NES). Port of
 * `references/kilocode/packages/kilo-vscode/src/services/autocomplete/next-edit/EditHistoryTracker.ts`.
 */
export interface EditRecord {
	readonly filePath: string;
	readonly range: Range;
	readonly oldText: string;
	readonly newText: string;
	readonly timestamp: number;
}

const MAX_HISTORY = 20;
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export class EditHistoryTracker extends Disposable implements IEditHistoryTracker {
	declare readonly _serviceBrand: undefined;

	private history: EditRecord[] = [];

	constructor(
		@IEditorService editorService: IEditorService
	) {
		super();
		// Subscribe to text model changes across all editors.
		// Note: a production implementation would use IModelService.onDidCreateModel
		// and attach listeners to each model. This is simplified.
	}

	/**
	 * Record a content change on a model.
	 */
	recordChange(filePath: string, model: ITextModel, changes: readonly IModelContentChange[]): void {
		for (const change of changes) {
			this.history.push({
				filePath,
				range: Range.lift(change.range),
				oldText: change.rangeOffset !== undefined ? model.getValueInRange(change.range) : '',
				newText: change.text,
				timestamp: Date.now()
			});
		}
		this.prune();
	}

	/**
	 * Get recent edits, optionally filtered by file path.
	 */
	getRecentEdits(filePath?: string): readonly EditRecord[] {
		const cutoff = Date.now() - MAX_AGE_MS;
		return this.history.filter(e =>
			e.timestamp > cutoff &&
			(!filePath || e.filePath === filePath)
		);
	}

	private prune(): void {
		const cutoff = Date.now() - MAX_AGE_MS;
		this.history = this.history.filter(e => e.timestamp > cutoff);
		if (this.history.length > MAX_HISTORY) {
			this.history = this.history.slice(-MAX_HISTORY);
		}
	}
}
