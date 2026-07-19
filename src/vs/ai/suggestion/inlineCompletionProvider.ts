/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../base/common/cancellation.js';
import { IInlineSuggestionService } from './inlineSuggestionService.js';
import {
	InlineCompletionsProvider,
	InlineCompletionContext,
	InlineCompletions,
	InlineCompletionsDisposeReason
} from '../../editor/common/languages.js';
import { ITextModel } from '../../editor/common/model.js';
import { Position } from '../../editor/common/core/position.js';

/**
 * VS Code inline completion provider that delegates to the
 * `IInlineSuggestionService`. Registered for all languages.
 */
export class FimInlineCompletionProvider implements InlineCompletionsProvider {
	constructor(
		private readonly suggestionService: IInlineSuggestionService
	) { }

	async provideInlineCompletions(
		model: ITextModel,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken
	): Promise<InlineCompletions | undefined> {
		if (context.triggerKind === 1 && !this.suggestionService.isEnabled()) {
			return undefined;
		}

		const delay = this.suggestionService.getAdaptiveDelay();
		if (delay > 0) {
			await new Promise<void>(resolve => setTimeout(resolve, delay));
			if (token.isCancellationRequested) {
				return undefined;
			}
		}

		const suggestion = await this.suggestionService.getSuggestion(model, position, token);
		if (!suggestion || token.isCancellationRequested) {
			return undefined;
		}

		return {
			items: [
				{
					insertText: suggestion,
					range: {
						startLineNumber: position.lineNumber,
						startColumn: position.column,
						endLineNumber: position.lineNumber,
						endColumn: position.column
					}
				}
			]
		};
	}

	disposeInlineCompletions(_completions: InlineCompletions, _reason: InlineCompletionsDisposeReason): void {
		// No-op.
	}
}
