/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IProviderRegistry } from '../common/types/provider.types.js';
import { IToolEnabledProvider } from '../provider/common/protocolBackedProvider.js';
import { SystemPart, Message, ModelRef, GenerationOptions } from '../provider/common/llmProtocol.js';
import { ITextModel } from '../../editor/common/model.js';
import { Position } from '../../editor/common/core/position.js';
import { CancellationToken } from '../../base/common/cancellation.js';
import { IVisibleCodeTracker } from './visibleCodeTracker.js';
import { IEditHistoryTracker } from './editHistoryTracker.js';
import { ErrorBackoff } from './errorBackoff.js';

/**
 * The Next Edit Suggestions (NES) service. Uses a diff-based edit suggestion
 * model (Mercury) to predict the user's next edit based on recent edits and
 * visible code.
 *
 * Port of `references/kilocode/packages/kilo-vscode/src/services/autocomplete/next-edit/NextEditInlineCompletionProvider.ts`.
 */
export const INextEditService = createDecorator<INextEditService>('ai.nextEditService');

/**
 * A next-edit suggestion: the predicted text to insert/replace at the cursor.
 */
export interface NextEditSuggestion {
	readonly insertText: string;
	readonly range?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
	readonly isDeletion: boolean;
}

export interface INextEditService {
	readonly _serviceBrand: undefined;
	/**
	 * Get a next-edit suggestion for the given model and position.
	 */
	getSuggestion(model: ITextModel, position: Position, token?: CancellationToken): Promise<NextEditSuggestion | undefined>;
	/**
	 * Whether NES is enabled.
	 */
	isEnabled(): boolean;
}

export class NextEditService extends Disposable implements INextEditService {
	declare readonly _serviceBrand: undefined;

	private readonly backoff = this._register(new ErrorBackoff(3, 5000));

	constructor(
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry,
		@IConfigurationService private readonly configService: IConfigurationService,
		@IVisibleCodeTracker private readonly visibleCodeTracker: IVisibleCodeTracker,
		@IEditHistoryTracker private readonly editHistoryTracker: IEditHistoryTracker
	) {
		super();
	}

	isEnabled(): boolean {
		// NES is enabled when the autocomplete model kind is "edit".
		return (this.configService.getValue<boolean>('ai.completion.enabled') ?? true) &&
			(this.configService.getValue<string>('ai.completion.kind') ?? 'fim') === 'nes';
	}

	async getSuggestion(model: ITextModel, position: Position, token?: CancellationToken): Promise<NextEditSuggestion | undefined> {
		if (!this.isEnabled() || this.backoff.isTripped()) {
			return undefined;
		}

		const provider = this.providerRegistry.getActiveProvider() as IToolEnabledProvider | undefined;
		if (!provider) {
			return undefined;
		}

		const context = this.buildRequestContext(model, position);
		const prompt = this.buildPrompt(context);

		const modelId = this.configService.getValue<string>('ai.completion.model')
			|| this.configService.getValue<string>('ai.chat.model')
			|| '';
		const system: SystemPart[] = [{ type: 'text', text: NES_SYSTEM_PROMPT }];
		const messages: Message[] = [{ role: 'user', content: prompt }];
		const generation: GenerationOptions = { maxTokens: 512, temperature: 0.1 };
		const modelRef: ModelRef = { id: modelId };

		try {
			const result = await provider.generateWithTools({ model: modelRef, system, messages, generation });
			this.backoff.recordSuccess();
			return this.parseSuggestion(result.text, model, position);
		} catch (err) {
			const statusCode = extractStatusCode(err);
			this.backoff.recordError(statusCode);
			return undefined;
		}
	}

	/**
	 * Build the request context: current file, cursor, editable region,
	 * recently viewed snippets, and edit history.
	 *
	 * Port of `buildRequestContext()` in
	 * `references/kilocode/packages/kilo-vscode/src/services/autocomplete/next-edit/NextEditInlineCompletionProvider.ts:117-139`.
	 */
	private buildRequestContext(model: ITextModel, position: Position): NESContext {
		const filePath = model.uri.fsPath;
		const fileContent = model.getValue();
		const { startLine, endLine } = this.computeEditableRegion(model, position);
		const recentlyViewedSnippets = this.visibleCodeTracker.getVisibleSnippets(3, 30);
		const editDiffHistory = this.editHistoryTracker.getRecentEdits(filePath).slice(-5);
		return {
			currentFilePath: filePath,
			currentFileContent: fileContent,
			cursorLine: position.lineNumber,
			cursorCharacter: position.column,
			editableRegionStartLine: startLine,
			editableRegionEndLine: endLine,
			recentlyViewedSnippets,
			editDiffHistory: editDiffHistory.map(e => ({ filePath: e.filePath, oldText: e.oldText, newText: e.newText }))
		};
	}

	private computeEditableRegion(model: ITextModel, position: Position): { startLine: number; endLine: number } {
		// The editable region is a window around the cursor where the model
		// should focus its prediction.
		const windowSize = 50;
		const startLine = Math.max(1, position.lineNumber - windowSize);
		const endLine = Math.min(model.getLineCount(), position.lineNumber + windowSize);
		return { startLine, endLine };
	}

	private buildPrompt(ctx: NESContext): string {
		const editHistory = ctx.editDiffHistory.length
			? `\nRecent edits:\n${ctx.editDiffHistory.map(e => `  ${e.filePath}: ${e.oldText} -> ${e.newText}`).join('\n')}`
			: '';
		const visibleSnippets = ctx.recentlyViewedSnippets.length
			? `\nVisible code in other files:\n${ctx.recentlyViewedSnippets.map(s => `// ${s.filePath}\n${s.text}`).join('\n\n')}`
			: '';
		return `File: ${ctx.currentFilePath}
Cursor: line ${ctx.cursorLine}, column ${ctx.cursorCharacter}
Editable region: lines ${ctx.editableRegionStartLine}-${ctx.editableRegionEndLine}${editHistory}${visibleSnippets}

File content:
\`\`\`
${ctx.currentFileContent}
\`\`\`

Predict the next edit the user is likely to make at the cursor. Return ONLY the code to insert, or describe a replacement as "REPLACE <old> WITH <new>".`;
	}

	private parseSuggestion(text: string, model: ITextModel, position: Position): NextEditSuggestion | undefined {
		const cleaned = text.trim().replace(/^```[a-zA-Z]*\n?/g, '').replace(/\n?```$/g, '').trim();
		if (!cleaned) { return undefined; }

		const replaceMatch = /^REPLACE\s+([\s\S]+?)\s+WITH\s+([\s\S]+)$/i.exec(cleaned);
		if (replaceMatch) {
			const oldText = replaceMatch[1]!.trim();
			const newText = replaceMatch[2]!.trim();
			const fileContent = model.getValue();
			const index = fileContent.indexOf(oldText);
			if (index === -1) {
				return undefined;
			}
			const start = model.getPositionAt(index);
			const end = model.getPositionAt(index + oldText.length);
			return {
				insertText: newText,
				range: {
					startLineNumber: start.lineNumber,
					startColumn: start.column,
					endLineNumber: end.lineNumber,
					endColumn: end.column,
				},
				isDeletion: newText.length === 0,
			};
		}

		return {
			insertText: cleaned,
			isDeletion: false,
		};
	}
}

interface NESContext {
	readonly currentFilePath: string;
	readonly currentFileContent: string;
	readonly cursorLine: number;
	readonly cursorCharacter: number;
	readonly editableRegionStartLine: number;
	readonly editableRegionEndLine: number;
	readonly recentlyViewedSnippets: ReadonlyArray<{ filePath: string; text: string }>;
	readonly editDiffHistory: ReadonlyArray<{ filePath: string; oldText: string; newText: string }>;
}

const NES_SYSTEM_PROMPT = `You are the Mercury Next Edit prediction model. Given the current file, cursor position, recent edits, and visible code, predict the single most likely next edit the user wants to make. Return ONLY the code to insert at the cursor, or a replacement in the form "REPLACE <exact old text> WITH <new text>". No explanations, no markdown fences.`;

function extractStatusCode(err: unknown): number | undefined {
	const msg = err instanceof Error ? err.message : String(err);
	const match = msg.match(/HTTP (\d+)/);
	return match ? parseInt(match[1], 10) : undefined;
}
