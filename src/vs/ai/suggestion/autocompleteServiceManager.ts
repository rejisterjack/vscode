/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../base/common/lifecycle.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IInlineSuggestionService } from './inlineSuggestionService.js';
import { INextEditService } from './nextEditService.js';
import { FimInlineCompletionProvider } from './inlineCompletionProvider.js';
import { NextEditInlineCompletionProvider } from './nextEditInlineProvider.js';
import { ILanguageFeaturesService } from '../../editor/common/services/languageFeatures.js';

/**
 * The autocomplete service manager orchestrates the registration of either
 * the FIM or NES inline completion provider based on the configured model
 * kind. Only one provider is active at a time.
 *
 * Port of `references/kilocode/packages/kilo-vscode/src/services/autocomplete/AutocompleteServiceManager.ts`.
 */
export const IAutocompleteServiceManager = createDecorator<IAutocompleteServiceManager>('ai.autocompleteServiceManager');

export interface IAutocompleteServiceManager {
	readonly _serviceBrand: undefined;
	/**
	 * Re-evaluate which inline completion provider should be active and
	 * re-register accordingly.
	 */
	ensureProviderRegistered(): void;
}

export class AutocompleteServiceManager extends Disposable implements IAutocompleteServiceManager {
	declare readonly _serviceBrand: undefined;

	private currentProviderRegistration: IDisposable | undefined;
	private currentProviderKind: 'fim' | 'nes' | undefined;

	constructor(
		@IConfigurationService private readonly configService: IConfigurationService,
		@IInlineSuggestionService private readonly inlineSuggestionService: IInlineSuggestionService,
		@INextEditService private readonly nextEditService: INextEditService,
		@ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService
	) {
		super();
		// Re-evaluate when the configuration changes.
		this._register(this.configService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('ai.completion')) {
				this.ensureProviderRegistered();
			}
		}));
	}

	ensureProviderRegistered(): void {
		const kind = this.configService.getValue<string>('ai.completion.kind') ?? 'fim';
		if (this.currentProviderKind === kind) { return; }

		// Dispose the old registration.
		this.currentProviderRegistration?.dispose();
		this.currentProviderRegistration = undefined;

		if (kind === 'nes' && this.nextEditService.isEnabled()) {
			const provider = new NextEditInlineCompletionProvider(this.nextEditService);
			this.currentProviderRegistration = this.languageFeaturesService.inlineCompletionsProvider.register('*', provider);
			this.currentProviderKind = 'nes';
		} else if (kind === 'fim' && this.inlineSuggestionService.isEnabled()) {
			const provider = new FimInlineCompletionProvider(this.inlineSuggestionService);
			this.currentProviderRegistration = this.languageFeaturesService.inlineCompletionsProvider.register('*', provider);
			this.currentProviderKind = 'fim';
		}
	}
}
