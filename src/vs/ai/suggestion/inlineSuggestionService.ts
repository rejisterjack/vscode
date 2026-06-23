/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IProviderRegistry } from '../common/types/provider.types.js';
import { IToolEnabledProvider } from '../provider/common/protocolBackedProvider.js';
import { SystemPart, Message, ModelRef, GenerationOptions } from '../provider/common/llmProtocol.js';
import { ITextModel } from '../../editor/common/model.js';
import { Position } from '../../editor/common/core/position.js';
import { CancellationToken } from '../../base/common/cancellation.js';
import { extractPrefixSuffix, buildFimPrompt, FimInputs, CLAUDE_FIM_TEMPLATE } from './fimPromptBuilder.js';
import { postprocessAutocompleteSuggestion, shouldSkipAutocomplete } from './postprocess.js';
import { ErrorBackoff } from './errorBackoff.js';

/**
 * The inline suggestion service powers FIM (fill-in-the-middle) tab completion.
 * The UI registers an `InlineCompletionItemProvider` that delegates to this
 * service.
 *
 * Port of `references/kilocode/packages/kilo-vscode/src/services/autocomplete/classic-auto-complete/AutocompleteInlineCompletionProvider.ts`.
 */
export const IInlineSuggestionService = createDecorator<IInlineSuggestionService>('ai.inlineSuggestionService');

export interface IInlineSuggestionService {
	readonly _serviceBrand: undefined;
	/**
	 * Get an inline completion suggestion for the given model and position.
	 * Returns the suggestion text, or undefined if no suggestion is available.
	 */
	getSuggestion(model: ITextModel, position: Position, token?: CancellationToken): Promise<string | undefined>;
	/**
	 * Whether the service is enabled and available.
	 */
	isEnabled(): boolean;
	/**
	 * Whether the service is temporarily backed off due to errors.
	 */
	isBackoffActive(): boolean;
	/**
	 * Fired when the backoff state changes (tripped or reset).
	 */
	readonly onDidChangeBackoff: Event<void>;
}

export class InlineSuggestionService extends Disposable implements IInlineSuggestionService {
	declare readonly _serviceBrand: undefined;

	private readonly backoff = this._register(new ErrorBackoff(3, 5000));
	private latencyHistory: number[] = [];

	private readonly _onDidChangeBackoff = this._register(new Emitter<void>());
	readonly onDidChangeBackoff = this._onDidChangeBackoff.event;

	constructor(
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry,
		@IConfigurationService private readonly configService: IConfigurationService
	) {
		super();
		this._register(this.backoff.onDidTrip(() => this._onDidChangeBackoff.fire()));
	}

	isEnabled(): boolean {
		return this.configService.getValue<boolean>('ai.completion.enabled') ?? true;
	}

	isBackoffActive(): boolean {
		return this.backoff.isTripped();
	}

	async getSuggestion(model: ITextModel, position: Position, token?: CancellationToken): Promise<string | undefined> {
		if (!this.isEnabled() || this.backoff.isTripped()) {
			return undefined;
		}

		const provider = this.providerRegistry.getActiveProvider() as IToolEnabledProvider | undefined;
		if (!provider) {
			return undefined;
		}

		const { prefix, suffix } = extractPrefixSuffix(model, position);
		const language = model.getLanguageId();
		const inputs: FimInputs = { prefix, suffix, language, snippets: [] };
		const prompt = buildFimPrompt(inputs, CLAUDE_FIM_TEMPLATE);

		const maxTokens = this.configService.getValue<number>('ai.completion.maxTokens') ?? 100;
		const modelId = this.configService.getValue<string>('ai.chat.model') ?? '';

		const startTime = Date.now();
		try {
			const system: SystemPart[] = [{ type: 'text', text: 'You are a code completion engine. Return ONLY the code to insert at the cursor, no explanations, no markdown fences.' }];
			const messages: Message[] = [{ role: 'user', content: prompt }];
			const generation: GenerationOptions = {
				maxTokens,
				temperature: 0.2,
				stop: ['\n\n\n']
			};
			const modelRef: ModelRef = { id: modelId };

			const result = await provider.generateWithTools({ model: modelRef, system, messages, generation });
			const suggestion = postprocessAutocompleteSuggestion(result.text, prefix);

			this.recordLatency(Date.now() - startTime);
			this.backoff.recordSuccess();

			if (shouldSkipAutocomplete(suggestion, model.getLineContent(position.lineNumber))) {
				return undefined;
			}
			return suggestion;
		} catch (err) {
			const statusCode = extractStatusCode(err);
			this.backoff.recordError(statusCode);
			return undefined;
		}
	}

	/**
	 * Get the adaptive debounce delay based on rolling latency history.
	 * Port of the adaptive debounce in
	 * `references/kilocode/packages/kilo-vscode/src/services/autocomplete/classic-auto-complete/AutocompleteInlineCompletionProvider.ts:44-66`.
	 */
	getAdaptiveDelay(): number {
		const MIN = 150;
		const INITIAL = 300;
		const MAX = 1000;
		if (this.latencyHistory.length === 0) { return INITIAL; }
		const avg = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
		return Math.min(MAX, Math.max(MIN, Math.floor(avg * 0.5)));
	}

	private recordLatency(ms: number): void {
		this.latencyHistory.push(ms);
		if (this.latencyHistory.length > 10) {
			this.latencyHistory.shift();
		}
	}
}

function extractStatusCode(err: unknown): number | undefined {
	const msg = err instanceof Error ? err.message : String(err);
	const match = msg.match(/HTTP (\d+)/);
	return match ? parseInt(match[1], 10) : undefined;
}
