/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IProviderRegistry } from '../../../../ai/common/types/provider.types.js';
import { CatalogModel, IModelsDevCatalog } from '../../../../ai/provider/common/modelsDevCatalog.js';
import { PROVIDER_PICKER_ORDER } from '../../../../ai/provider/providerOrder.js';
import { IToolEnabledProvider } from '../../../../ai/provider/common/protocolBackedProvider.js';
import { IAIProvider } from '../../../../ai/provider/common/aiProvider.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import {
	ILanguageModelChatMetadata,
	ILanguageModelChatMetadataAndIdentifier,
	ILanguageModelChatProvider,
} from '../../chat/common/languageModels.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';

export function asToolEnabledProvider(provider: IAIProvider | undefined): IToolEnabledProvider | undefined {
	if (!provider || typeof (provider as IToolEnabledProvider).streamWithTools !== 'function') {
		return undefined;
	}
	return provider as IToolEnabledProvider;
}

export function parseFewStepsAwayModelId(modelId: string): { providerId: string; modelId: string } | undefined {
	const slash = modelId.indexOf('/');
	if (slash <= 0) {
		return undefined;
	}
	return {
		providerId: modelId.substring(0, slash),
		modelId: modelId.substring(slash + 1),
	};
}

export function buildModelIdentifier(providerId: string, modelId: string): string {
	return `${providerId}/${modelId}`;
}

/** Display order for model picker vendor groups (lower = higher in list). */
const VENDOR_PICKER_ORDER = PROVIDER_PICKER_ORDER;

/**
 * Exposes native FewStepsAway LLM providers in VS Code's model picker.
 */
export class FewStepsAwayLanguageModelProvider extends Disposable implements ILanguageModelChatProvider {

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	constructor(
		private readonly vendorId: string,
		private readonly vendorDisplayName: string,
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry,
		@IModelsDevCatalog private readonly modelsCatalog: IModelsDevCatalog,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();

		this._register(this.modelsCatalog.onDidRefresh(() => this.notifyModelsChanged()));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('ai.provider.default') || e.affectsConfiguration(`ai.provider.${this.vendorId}`)) {
				this.notifyModelsChanged();
			}
		}));
	}

	notifyModelsChanged(): void {
		this._onDidChange.fire();
	}

	async provideLanguageModelChatInfo(_options: { silent: boolean }, _token: CancellationToken): Promise<ILanguageModelChatMetadataAndIdentifier[]> {
		const provider = this.providerRegistry.getProvider(this.vendorId);
		if (!provider) {
			return [];
		}

		let models: readonly CatalogModel[] = [];
		const toolProvider = asToolEnabledProvider(provider);
		if (toolProvider) {
			try {
				models = await toolProvider.getModels();
			} catch {
				// Fall back to catalog below.
			}
		}
		if (models.length === 0) {
			try {
				models = await this.modelsCatalog.getModels(this.vendorId);
			} catch {
				// Fall through to static models below.
			}
		}
		if (models.length === 0 && toolProvider) {
			try {
				models = await toolProvider.getModels();
			} catch {
				return [];
			}
		}
		if (models.length === 0) {
			return [];
		}

		const defaultProviderId = this.configurationService.getValue<string>('ai.provider.default') ?? 'openai';
		const defaultModelId = this.configurationService.getValue<string>(`ai.provider.${this.vendorId}.model`) ?? models[0]?.id;

		return models.map(model => {
			const identifier = buildModelIdentifier(this.vendorId, model.id);
			const metadata: ILanguageModelChatMetadata = {
				extension: nullExtensionDescription.identifier,
				name: model.name,
				id: model.id,
				vendor: this.vendorId,
				version: model.releaseDate,
				family: model.family ?? model.id,
				maxInputTokens: model.limit.context,
				maxOutputTokens: model.limit.output,
				isDefaultForLocation: defaultProviderId === this.vendorId && defaultModelId === model.id
					? { [ChatAgentLocation.Chat]: true }
					: {},
				isUserSelectable: true,
				modelPickerCategory: { label: this.vendorDisplayName, order: VENDOR_PICKER_ORDER[this.vendorId] ?? 500 },
				capabilities: {
					toolCalling: model.toolCall,
					agentMode: model.toolCall,
					vision: model.modalities?.input?.includes('image'),
				},
			};
			return { metadata, identifier };
		});
	}

	async sendChatRequest(_modelId: string, _messages: unknown[], _from: unknown, _options: { [name: string]: unknown }, _token: CancellationToken): Promise<never> {
		throw new Error('FewStepsAway chat requests are handled by the FewStepsAway chat agent.');
	}

	async provideTokenCount(_modelId: string, message: string | { content?: unknown }, _token: CancellationToken): Promise<number> {
		const text = typeof message === 'string' ? message : JSON.stringify(message);
		return Math.ceil(text.length / 4);
	}
}
