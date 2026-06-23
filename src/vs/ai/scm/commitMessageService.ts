/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IProviderRegistry } from '../common/types/provider.types.js';
import { IToolEnabledProvider } from '../provider/common/protocolBackedProvider.js';
import { getSmallModel } from '../enhance/enhancePrompt.js';
import { generateCommitMessage } from './generateCommitMessage.js';

/**
 * The commit-message generation service. Resolves a small/fast model
 * from the configured AI providers and asks it to write a conventional
 * commit message from a textual diff.
 */
export const ICommitMessageService = createDecorator<ICommitMessageService>('ai.commitMessageService');

export interface ICommitMessageService {
	readonly _serviceBrand: undefined;
	/**
	 * Generate a commit message from a textual diff.
	 *
	 * @param diffText The staged/unstaged diff in unified diff format.
	 * @param preferredProviderId Optional provider id to prefer (e.g. from a model picker).
	 * @throws Error if no provider is available or the call fails.
	 */
	generateFromDiff(diffText: string, preferredProviderId?: string): Promise<string>;
	/**
	 * Whether the service is available (i.e. a provider with a model is configured).
	 */
	isAvailable(): boolean;
	/**
	 * Fired when a commit message is generated.
	 */
	readonly onDidGenerate: Event<{ diff: string; message: string }>;
	/**
	 * Fired when generation fails. The UI can subscribe to surface errors.
	 */
	readonly onDidError: Event<{ diff: string; error: string }>;
}

export class CommitMessageService extends Disposable implements ICommitMessageService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidGenerate = this._register(new Emitter<{ diff: string; message: string }>());
	readonly onDidGenerate = this._onDidGenerate.event;

	private readonly _onDidError = this._register(new Emitter<{ diff: string; error: string }>());
	readonly onDidError = this._onDidError.event;

	constructor(
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry
	) {
		super();
	}

	async generateFromDiff(diffText: string, preferredProviderId?: string): Promise<string> {
		const trimmed = diffText.trim();
		if (!trimmed) {
			throw new Error('No staged changes to generate a commit message from. Stage your changes first.');
		}

		const preferredProvider = preferredProviderId
			? this.providerRegistry.getProvider(preferredProviderId) as IToolEnabledProvider | undefined
			: undefined;
		const activeProvider = (preferredProvider ?? this.providerRegistry.getActiveProvider()) as IToolEnabledProvider | undefined;
		const allProviders = this.providerRegistry.getAllProviders() as unknown as readonly IToolEnabledProvider[];

		// Commit-message generation is infrequent, so prefer the active
		// provider's primary model (the one with the user's full quota) over
		// a "small" flash model. Flash models on plans like the GLM Coding
		// Plan are often rate-limited separately and tightly; the primary
		// coding model has the full quota the user is paying for.
		const candidates = await this.resolveModelCandidates(activeProvider, allProviders);
		if (candidates.length === 0) {
			throw new Error('No AI provider available to generate commit messages. Configure an API key in Settings > AI Features.');
		}

		let lastError: unknown;
		for (const candidate of candidates) {
			try {
				const message = await generateCommitMessage(trimmed, candidate.provider, candidate.model);
				this._onDidGenerate.fire({ diff: trimmed, message });
				return message;
			} catch (err) {
				lastError = err;
				// Retry the next candidate (e.g. fall back from the primary
				// model to a small model if the primary is unavailable).
			}
		}

		const message = normalizeErrorMessage(lastError);
		this._onDidError.fire({ diff: trimmed, error: message });
		throw new Error(message);
	}

	/**
	 * Resolve an ordered list of (provider, model) candidates to try. The
	 * active provider's configured/default model comes first (full quota);
	 * small-model fallbacks follow in case the primary is unavailable.
	 */
	private async resolveModelCandidates(
		activeProvider: IToolEnabledProvider | undefined,
		allProviders: readonly IToolEnabledProvider[]
	): Promise<{ provider: IToolEnabledProvider; model: string }[]> {
		const candidates: { provider: IToolEnabledProvider; model: string }[] = [];

		// 1. The active provider's primary (configured or default) model.
		if (activeProvider && await isProviderConfigured(activeProvider)) {
			const primaryModel = await resolvePrimaryModel(activeProvider);
			if (primaryModel) {
				candidates.push({ provider: activeProvider, model: primaryModel });
			}
		}

		// 2. Fall back to the shared small-model picker.
		const smallModel = await getSmallModel(activeProvider, allProviders);
		if (smallModel?.model && !candidates.some(c => c.provider.id === smallModel.provider.id && c.model === smallModel.model)) {
			candidates.push(smallModel);
		}

		return candidates;
	}

	isAvailable(): boolean {
		return !!this.providerRegistry.getActiveProvider() || this.providerRegistry.getAllProviders().length > 0;
	}
}

/**
 * Whether a provider is ready to serve requests: either it does not require
 * an API key (local providers) or one has been supplied in settings.
 */
async function isProviderConfigured(provider: IToolEnabledProvider): Promise<boolean> {
	try {
		return await provider.validateConfig();
	} catch {
		return false;
	}
}

/**
 * Resolve the model id a provider would use by default: the user-configured
 * model if set, otherwise the provider's advertised default (typically the
 * first entry in its static catalog, e.g. GLM-5.2 for Z.ai).
 */
async function resolvePrimaryModel(provider: IToolEnabledProvider): Promise<string | undefined> {
	// ProviderConfig is exposed through the legacy `initialize`/`sendRequest`
	// path, not directly on the tool-enabled interface. The provider's
	// catalog is the authoritative source of "what models do I have"; the
	// first entry is conventionally the flagship/default model.
	try {
		const models = await provider.getModels();
		if (models.length > 0) {
			return models[0].id;
		}
	} catch {
		// Fall through.
	}
	return undefined;
}

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
	return `Failed to generate commit message: ${message}`;
}
