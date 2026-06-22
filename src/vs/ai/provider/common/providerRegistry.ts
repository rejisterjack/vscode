/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { IAIProvider } from './aiProvider.js';
import { IProviderRegistry } from '../../common/types/provider.types.js';
import { Emitter, Event } from '../../../base/common/event.js';

export class ProviderRegistry implements IProviderRegistry {
	declare readonly _serviceBrand: undefined;

	private readonly providers = new Map<string, IAIProvider>();
	private activeProviderId?: string;

	private readonly _onDidChangeActiveProvider = new Emitter<{ oldProvider: string; newProvider: string }>();
	readonly onDidChangeActiveProvider: Event<{ oldProvider: string; newProvider: string }> = this._onDidChangeActiveProvider.event;

	private readonly _onDidRegisterProvider = new Emitter<IAIProvider>();
	readonly onDidRegisterProvider: Event<IAIProvider> = this._onDidRegisterProvider.event;

	private readonly _onDidUnregisterProvider = new Emitter<string>();
	readonly onDidUnregisterProvider: Event<string> = this._onDidUnregisterProvider.event;

	register(provider: IAIProvider): void {
		if (this.providers.has(provider.id)) {
			throw new Error(`Provider with id ${provider.id} is already registered`);
		}
		this.providers.set(provider.id, provider);
		this._onDidRegisterProvider.fire(provider);

		if (!this.activeProviderId) {
			this.setActiveProvider(provider.id);
		}
	}

	unregister(providerId: string): void {
		if (this.providers.has(providerId)) {
			this.providers.delete(providerId);
			this._onDidUnregisterProvider.fire(providerId);
			if (this.activeProviderId === providerId) {
				const keys = Array.from(this.providers.keys());
				this.setActiveProvider(keys[0] || '');
			}
		}
	}

	getProvider(providerId: string): IAIProvider | undefined {
		return this.providers.get(providerId);
	}

	getAllProviders(): IAIProvider[] {
		return Array.from(this.providers.values());
	}

	getEnabledProviders(): IAIProvider[] {
		return this.getAllProviders();
	}

	setActiveProvider(providerId: string): void {
		const oldProvider = this.activeProviderId || '';
		if (oldProvider !== providerId) {
			this.activeProviderId = providerId;
			this._onDidChangeActiveProvider.fire({ oldProvider, newProvider: providerId });
		}
	}

	getActiveProvider(): IAIProvider | undefined {
		return this.activeProviderId ? this.getProvider(this.activeProviderId) : undefined;
	}
}
