/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IProviderRegistry } from '../common/types/provider.types.js';
import { IToolEnabledProvider } from '../provider/common/protocolBackedProvider.js';
import { enhancePrompt, getSmallModel } from './enhancePrompt.js';

/**
 * The prompt enhancement service. Exposes a single method that the chat
 * input box UI calls when the user clicks the "enhance" button.
 *
 * The UI owns the button, the loading state, and the undo behavior; this
 * service provides the backend logic only.
 *
 * Port of the VS Code extension side in
 * `references/kilocode/packages/kilo-vscode/src/KiloProvider.ts:1269-1296`.
 */
export const IPromptEnhancementService = createDecorator<IPromptEnhancementService>('ai.promptEnhancementService');

export interface IPromptEnhancementService {
	readonly _serviceBrand: undefined;
	/**
	 * Enhance a draft prompt. Returns the enhanced text.
	 *
	 * @param draftText The user's draft prompt.
	 * @throws Error if no provider is available or the enhancement call fails.
	 */
	enhance(draftText: string): Promise<string>;
	/**
	 * Whether the enhancement service is available (i.e. a provider with a
	 * model is configured).
	 */
	isAvailable(): boolean;
	/**
	 * Fired when a prompt is enhanced. The UI can subscribe to update a
	 * loading spinner if it prefers event-driven updates over awaiting.
	 */
	readonly onDidEnhance: Event<{ draft: string; enhanced: string }>;
	readonly onDidError: Event<{ draft: string; error: string }>;
}

export class PromptEnhancementService extends Disposable implements IPromptEnhancementService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidEnhance = this._register(new Emitter<{ draft: string; enhanced: string }>());
	readonly onDidEnhance = this._onDidEnhance.event;

	private readonly _onDidError = this._register(new Emitter<{ draft: string; error: string }>());
	readonly onDidError = this._onDidError.event;

	constructor(
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry
	) {
		super();
	}

	async enhance(draftText: string): Promise<string> {
		if (!draftText.trim()) {
			throw new Error('Cannot enhance an empty prompt.');
		}

		const defaultProvider = this.providerRegistry.getActiveProvider() as IToolEnabledProvider | undefined;
		const allProviders = this.providerRegistry.getAllProviders() as unknown as readonly IToolEnabledProvider[];

		const smallModel = await getSmallModel(defaultProvider, allProviders);
		if (!smallModel) {
			throw new Error('No AI provider available for prompt enhancement. Configure an API key in Settings > AI Features.');
		}

		try {
			const enhanced = await enhancePrompt(draftText, smallModel.provider, smallModel.model);
			this._onDidEnhance.fire({ draft: draftText, enhanced });
			return enhanced;
		} catch (err) {
			const message = normalizeErrorMessage(err);
			this._onDidError.fire({ draft: draftText, error: message });
			throw new Error(message);
		}
	}

	isAvailable(): boolean {
		return !!this.providerRegistry.getActiveProvider() || this.providerRegistry.getAllProviders().length > 0;
	}
}

/**
 * Normalize quota/billing errors into user-friendly messages. Port of
 * `references/kilocode/packages/kilo-vscode/src/enhance-prompt-error.ts`.
 */
function normalizeErrorMessage(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	const lower = message.toLowerCase();
	if (lower.includes('insufficient_quota') || lower.includes('quota')) {
		return 'Your provider account has run out of quota. Check your provider billing/quota settings.';
	}
	if (lower.includes('invalid_api_key') || lower.includes('invalid api key') || lower.includes('401')) {
		return 'The API key is invalid. Check your provider API key in Settings > AI Features.';
	}
	if (lower.includes('rate limit') || lower.includes('429')) {
		return 'Rate limit exceeded. Wait a moment and try again.';
	}
	return `Failed to enhance prompt: ${message}`;
}
