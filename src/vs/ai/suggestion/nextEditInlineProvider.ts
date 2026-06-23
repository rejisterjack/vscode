/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../base/common/cancellation.js';
import {
	InlineCompletionsProvider,
	InlineCompletionContext,
	InlineCompletions,
	InlineCompletionsDisposeReason
} from '../../editor/common/languages.js';
import { ITextModel } from '../../editor/common/model.js';
import { Position } from '../../editor/common/core/position.js';
import { INextEditService } from './nextEditService.js';

/**
 * VS Code inline completion provider for Next Edit Suggestions (NES).
 */
export class NextEditInlineCompletionProvider implements InlineCompletionsProvider {
	constructor(
		private readonly nextEditService: INextEditService
	) { }

	async provideInlineCompletions(
		model: ITextModel,
		position: Position,
		_context: InlineCompletionContext,
		token: CancellationToken
	): Promise<InlineCompletions | undefined> {
		if (!this.nextEditService.isEnabled()) {
			return undefined;
		}

		const suggestion = await this.nextEditService.getSuggestion(model, position, token);
		if (!suggestion || token.isCancellationRequested) {
			return undefined;
		}

		const range = suggestion.range ?? {
			startLineNumber: position.lineNumber,
			startColumn: position.column,
			endLineNumber: position.lineNumber,
			endColumn: position.column
		};

		return {
			items: [{ insertText: suggestion.isDeletion ? '' : suggestion.insertText, range }]
		};
	}

	disposeInlineCompletions(_completions: InlineCompletions, _reason: InlineCompletionsDisposeReason): void {
		// No-op.
	}
}
