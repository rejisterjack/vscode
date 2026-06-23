/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IAIService, IProviderRegistry } from '../../../../ai/common/types/provider.types.js';
import { IModelsDevCatalog } from '../../../../ai/provider/common/modelsDevCatalog.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ILanguageModelsService } from '../../chat/common/languageModels.js';
import { FewStepsAwayLanguageModelProvider } from './fewStepsAwayLanguageModelProvider.js';

export class FewStepsAwayLanguageModelProviderContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewStepsAwayLanguageModelProvider';

	private readonly vendorDisposables = this._register(new DisposableStore());
	private readonly lmProviders = new Map<string, FewStepsAwayLanguageModelProvider>();
	private registeredVendors = new Set<string>();
	private refreshPromise: Promise<void> | undefined;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IModelsDevCatalog private readonly modelsCatalog: IModelsDevCatalog,
	) {
		super();

		// Ensure native providers, tools, and modes are registered.
		this.instantiationService.invokeFunction(accessor => accessor.get(IAIService));

		this.syncProviders();
		this._register(this.providerRegistry.onDidRegisterProvider(() => this.syncProviders()));
		this._register(this.modelsCatalog.onDidRefresh(() => {
			for (const provider of this.lmProviders.values()) {
				provider.notifyModelsChanged();
			}
			void this.refreshAllModels();
		}));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('ai.provider.default') || e.affectsConfiguration('ai.provider')) {
				for (const provider of this.lmProviders.values()) {
					provider.notifyModelsChanged();
				}
				void this.refreshAllModels();
			}
		}));

		// Warm the models.dev catalog so providers can list models on first resolve.
		void this.modelsCatalog.getProviders().then(() => this.refreshAllModels());
	}

	private syncProviders(): void {
		const providers = this.providerRegistry.getAllProviders();
		const nextVendors = new Set(providers.map(p => p.id));

		for (const vendor of this.registeredVendors) {
			if (!nextVendors.has(vendor)) {
				this.registeredVendors.delete(vendor);
				this.lmProviders.delete(vendor);
			}
		}

		const added = providers
			.filter(p => !this.registeredVendors.has(p.id))
			.map(p => ({
				vendor: p.id,
				displayName: p.name,
				configuration: undefined,
				managementCommand: undefined,
				when: undefined,
			}));

		if (added.length > 0) {
			this.languageModelsService.deltaLanguageModelChatProviderDescriptors(added, []);
		}

		let registeredNew = false;
		for (const provider of providers) {
			if (this.registeredVendors.has(provider.id)) {
				continue;
			}
			this.registeredVendors.add(provider.id);
			const lmProvider = this.instantiationService.createInstance(
				FewStepsAwayLanguageModelProvider,
				provider.id,
				provider.name,
			);
			this.lmProviders.set(provider.id, lmProvider);
			this.vendorDisposables.add(this.languageModelsService.registerLanguageModelProvider(provider.id, lmProvider));
			registeredNew = true;
		}

		if (registeredNew || added.length > 0) {
			void this.refreshAllModels();
		}
	}

	/**
	 * VS Code only resolves model metadata when `selectLanguageModels` is called.
	 * Without this, the picker shows a fake "Auto" entry even though providers are registered.
	 */
	private refreshAllModels(): Promise<void> {
		if (!this.refreshPromise) {
			this.refreshPromise = this.languageModelsService.selectLanguageModels({}).then(() => { }).finally(() => {
				this.refreshPromise = undefined;
			});
		}
		return this.refreshPromise;
	}
}

registerWorkbenchContribution2(
	FewStepsAwayLanguageModelProviderContribution.ID,
	FewStepsAwayLanguageModelProviderContribution,
	WorkbenchPhase.BlockStartup,
);
