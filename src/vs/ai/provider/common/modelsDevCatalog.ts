/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IRequestService, asJson, isSuccess } from '../../../platform/request/common/request.js';
import { CancellationToken } from '../../../base/common/cancellation.js';

/**
 * The models.dev catalog is the single source of truth for model capabilities,
 * pricing, and context limits. Mirrors Kilocode's
 * `packages/core/src/models-dev.ts`.
 */
export const IModelsDevCatalog = createDecorator<IModelsDevCatalog>('ai.modelsDevCatalog');

/**
 * Pricing for a model (per-million-token rates).
 */
export interface ModelCost {
	readonly input?: number;
	readonly output?: number;
	readonly cacheRead?: number;
	readonly cacheWrite?: number;
}

/**
 * A model's input/output modalities.
 */
export interface ModelModalities {
	readonly input: readonly string[];
	readonly output: readonly string[];
}

/**
 * A model entry in the catalog.
 */
export interface CatalogModel {
	readonly id: string;
	readonly name: string;
	readonly family?: string;
	readonly releaseDate: string;
	readonly attachment: boolean;
	readonly reasoning: boolean;
	readonly temperature: boolean;
	readonly toolCall: boolean;
	readonly cost?: ModelCost;
	readonly limit: {
		readonly context: number;
		readonly input?: number;
		readonly output: number;
	};
	readonly modalities?: ModelModalities;
	readonly status?: 'alpha' | 'beta' | 'stable' | 'deprecated';
}

/**
 * A provider entry in the catalog: maps a provider id to its models.
 */
export interface CatalogProvider {
	readonly id: string;
	readonly name: string;
	readonly models: Record<string, CatalogModel>;
}

/**
 * The models.dev catalog service. Fetches and caches the full catalog,
 * providing lookups by provider id and model id.
 */
export interface IModelsDevCatalog {
	readonly _serviceBrand: undefined;
	/**
	 * Get all providers in the catalog. Fetches on first call.
	 */
	getProviders(): Promise<readonly CatalogProvider[]>;
	/**
	 * Get a single provider by id.
	 */
	getProvider(providerId: string): Promise<CatalogProvider | undefined>;
	/**
	 * Get all models for a provider.
	 */
	getModels(providerId: string): Promise<readonly CatalogModel[]>;
	/**
	 * Refresh the catalog from the remote source.
	 */
	refresh(): Promise<void>;
	/**
	 * Fired when the catalog is refreshed.
	 */
	readonly onDidRefresh: Event<void>;
}

const MODELS_DEV_URL = 'https://models.dev/api.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Raw catalog shape from models.dev (before normalization).
 */
interface RawCatalogProvider {
	readonly name: string;
	readonly npm?: string;
	readonly api?: string;
	readonly models: Record<string, RawCatalogModel>;
}

interface RawCatalogModel {
	readonly name: string;
	readonly family?: string;
	readonly release_date: string;
	readonly attachment: boolean;
	readonly reasoning: boolean;
	readonly temperature: boolean;
	readonly tool_call: boolean;
	readonly cost?: {
		readonly input?: number;
		readonly output?: number;
		readonly cache_read?: number;
		readonly cache_write?: number;
	};
	readonly limit: {
		readonly context: number;
		readonly input?: number;
		readonly output: number;
	};
	readonly modalities?: {
		readonly input: readonly string[];
		readonly output: readonly string[];
	};
	readonly status?: string;
}

export class ModelsDevCatalog extends Disposable implements IModelsDevCatalog {
	declare readonly _serviceBrand: undefined;

	private cache: readonly CatalogProvider[] | undefined;
	private lastFetch = 0;
	private fetchPromise: Promise<readonly CatalogProvider[]> | undefined;

	private readonly _onDidRefresh = this._register(new Emitter<void>());
	readonly onDidRefresh: Event<void> = this._onDidRefresh.event;

	constructor(
		@IRequestService private readonly requestService: IRequestService,
	) {
		super();
	}

	async getProviders(): Promise<readonly CatalogProvider[]> {
		if (this.cache && Date.now() - this.lastFetch < CACHE_TTL_MS) {
			return this.cache;
		}
		if (!this.fetchPromise) {
			this.fetchPromise = this.fetchCatalog();
		}
		return this.fetchPromise;
	}

	async getProvider(providerId: string): Promise<CatalogProvider | undefined> {
		const providers = await this.getProviders();
		return providers.find(p => p.id === providerId);
	}

	async getModels(providerId: string): Promise<readonly CatalogModel[]> {
		const provider = await this.getProvider(providerId);
		if (!provider) { return []; }
		return Object.values(provider.models);
	}

	async refresh(): Promise<void> {
		this.cache = undefined;
		this.fetchPromise = undefined;
		await this.getProviders();
		this._onDidRefresh.fire();
	}

	private async fetchCatalog(): Promise<readonly CatalogProvider[]> {
		try {
			const requestContext = await this.requestService.request({
				type: 'GET',
				url: MODELS_DEV_URL,
				headers: { 'Accept': 'application/json' }
			}, CancellationToken.None);

			if (!isSuccess(requestContext)) {
				return this.cache ?? [];
			}

			const raw = await asJson<Record<string, RawCatalogProvider>>(requestContext);
			if (!raw || typeof raw !== 'object') {
				return this.cache ?? [];
			}

			this.cache = Object.entries(raw).map(([id, provider]) => normalizeProvider(id, provider));
			this.lastFetch = Date.now();
			this._onDidRefresh.fire();
			return this.cache;
		} catch {
			return this.cache ?? [];
		} finally {
			this.fetchPromise = undefined;
		}
	}
}

function normalizeProvider(id: string, raw: RawCatalogProvider): CatalogProvider {
	const models: Record<string, CatalogModel> = {};
	for (const [modelId, model] of Object.entries(raw.models)) {
		models[modelId] = normalizeModel(modelId, model);
	}
	return {
		id,
		name: raw.name,
		models
	};
}

function normalizeModel(id: string, raw: RawCatalogModel): CatalogModel {
	const cost: ModelCost | undefined = raw.cost ? {
		input: raw.cost.input,
		output: raw.cost.output,
		cacheRead: raw.cost.cache_read,
		cacheWrite: raw.cost.cache_write
	} : undefined;

	const modalities: ModelModalities | undefined = raw.modalities ? {
		input: raw.modalities.input,
		output: raw.modalities.output
	} : undefined;

	const status = raw.status as CatalogModel['status'] | undefined;

	return {
		id,
		name: raw.name,
		family: raw.family,
		releaseDate: raw.release_date,
		attachment: raw.attachment,
		reasoning: raw.reasoning,
		temperature: raw.temperature,
		toolCall: raw.tool_call,
		cost,
		limit: {
			context: raw.limit.context,
			input: raw.limit.input,
			output: raw.limit.output
		},
		modalities,
		status
	};
}
