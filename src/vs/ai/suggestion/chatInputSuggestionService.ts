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
import { IVisibleCodeTracker } from './visibleCodeTracker.js';
import { buildFimPrompt, FimInputs, CLAUDE_FIM_TEMPLATE } from './fimPromptBuilder.js';
import { postprocessAutocompleteSuggestion, removePrefixOverlap } from './postprocess.js';
import { ErrorBackoff } from './errorBackoff.js';

/**
 * Provides ghost-text completions in the chat input box itself (not the code
 * editor). Uses visible code as context.
 *
 * Port of `references/kilocode/packages/kilo-vscode/src/services/autocomplete/chat-autocomplete/ChatTextAreaAutocomplete.ts`.
 *
 * The UI owns the textarea and the ghost-text rendering; this service provides
 * the backend logic: given the current text and cursor position, return the
 * completion text.
 */
export const IChatInputSuggestionService = createDecorator<IChatInputSuggestionService>('ai.chatInputSuggestionService');

export interface IChatInputSuggestionService {
	readonly _serviceBrand: undefined;
	/**
	 * Get a ghost-text completion for the chat input.
	 *
	 * @param text The current text in the chat input.
	 * @param cursorOffset The cursor offset (0-indexed) in the text.
	 */
	getSuggestion(text: string, cursorOffset: number): Promise<string | undefined>;
	/**
	 * Whether the service is enabled.
	 */
	isEnabled(): boolean;
}

export class ChatInputSuggestionService extends Disposable implements IChatInputSuggestionService {
	declare readonly _serviceBrand: undefined;

	private readonly backoff = this._register(new ErrorBackoff(3, 5000));

	constructor(
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry,
		@IConfigurationService private readonly configService: IConfigurationService,
		@IVisibleCodeTracker private readonly visibleCodeTracker: IVisibleCodeTracker
	) {
		super();
	}

	isEnabled(): boolean {
		return this.configService.getValue<boolean>('ai.chatInputSuggest.enabled') ?? false;
	}

	async getSuggestion(text: string, cursorOffset: number): Promise<string | undefined> {
		if (!this.isEnabled() || this.backoff.isTripped()) {
			return undefined;
		}

		const provider = this.providerRegistry.getActiveProvider() as IToolEnabledProvider | undefined;
		if (!provider) { return undefined; }

		const prefix = text.slice(0, cursorOffset);
		const visibleEditors = this.visibleCodeTracker.getVisibleSnippets(3, 20);

		const inputs: FimInputs = {
			prefix: this.buildChatPrefix(prefix, visibleEditors),
			suffix: '',
			language: 'markdown',
			snippets: []
		};
		const prompt = buildFimPrompt(inputs, CLAUDE_FIM_TEMPLATE);

		const modelId = this.configService.getValue<string>('ai.chat.model') ?? '';
		const system: SystemPart[] = [{ type: 'text', text: 'You complete the user\'s chat message. Return ONLY the continuation, no explanations.' }];
		const messages: Message[] = [{ role: 'user', content: prompt }];
		const generation: GenerationOptions = { maxTokens: 60, temperature: 0.3, stop: ['\n'] };
		const modelRef: ModelRef = { id: modelId };

		try {
			const result = await provider.generateWithTools({ model: modelRef, system, messages, generation });
			this.backoff.recordSuccess();
			let suggestion = postprocessAutocompleteSuggestion(result.text, prefix);
			suggestion = removePrefixOverlap(suggestion, prefix);
			if (!suggestion.trim()) { return undefined; }
			return suggestion;
		} catch (err) {
			const statusCode = extractStatusCode(err);
			this.backoff.recordError(statusCode);
			return undefined;
		}
	}

	/**
	 * Build the chat prefix with visible-code context.
	 * Port of `buildChatPrefix()` in
	 * `references/kilocode/packages/kilo-vscode/src/services/autocomplete/chat-autocomplete/ChatTextAreaAutocomplete.ts`.
	 */
	private buildChatPrefix(userText: string, visibleEditors: ReadonlyArray<{ filePath: string; text: string }>): string {
		let prefix = '';
		if (visibleEditors.length > 0) {
			prefix += 'Visible code context:\n';
			for (const editor of visibleEditors) {
				prefix += `// ${editor.filePath}\n${editor.text}\n\n`;
			}
		}
		prefix += `Chat input to complete:\n${userText}`;
		return prefix;
	}
}

function extractStatusCode(err: unknown): number | undefined {
	const msg = err instanceof Error ? err.message : String(err);
	const match = msg.match(/HTTP (\d+)/);
	return match ? parseInt(match[1], 10) : undefined;
}
