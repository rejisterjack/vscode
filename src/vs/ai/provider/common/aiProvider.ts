/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import {
	AIRequestContext,
	AIResponse,
	AIResponseChunk,
	ProviderCapabilities,
	ProviderConfig
} from '../../common/types/ai.types.js';

/**
 * Base interface for all AI providers in FewStepAway
 */
export interface IAIProvider {
	/** Provider identifier */
	readonly id: string;
	/** Provider display name */
	readonly name: string;
	/** Provider capabilities */
	readonly capabilities: ProviderCapabilities;

	/**
	 * Initialize the provider with configuration
	 */
	initialize(config: ProviderConfig): Promise<void>;

	/**
	 * Send a request to the AI provider
	 */
	sendRequest(context: AIRequestContext): Promise<AIResponse>;

	/**
	 * Stream a request to the AI provider
	 */
	streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk>;

	/**
	 * Get available models from the provider
	 */
	getAvailableModels(): Promise<string[]>;

	/**
	 * Validate the current configuration
	 */
	validateConfig(): Promise<boolean>;

	/**
	 * Get token count estimate for text
	 */
	estimateTokens(text: string): number;

	/**
	 * Shutdown the provider and cleanup resources
	 */
	shutdown(): Promise<void>;
}

/**
 * Abstract base class for AI providers
 */
export abstract class BaseAIProvider implements IAIProvider {
	abstract readonly id: string;
	abstract readonly name: string;
	abstract readonly capabilities: ProviderCapabilities;

	protected config?: ProviderConfig;
	protected initialized = false;

	async initialize(config: ProviderConfig): Promise<void> {
		this.config = config;
		await this.doInitialize();
		this.initialized = true;
	}

	protected abstract doInitialize(): Promise<void>;

	abstract sendRequest(context: AIRequestContext): Promise<AIResponse>;
	abstract streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk>;
	abstract getAvailableModels(): Promise<string[]>;
	abstract validateConfig(): Promise<boolean>;
	abstract shutdown(): Promise<void>;

	estimateTokens(text: string): number {
		// Rough estimation: 1 token ≈ 4 characters
		return Math.ceil(text.length / 4);
	}

	protected getModel(context: AIRequestContext): string {
		return context.model || this.config?.defaultModel || this.getDefaultModel();
	}

	protected abstract getDefaultModel(): string;

	protected buildSystemPrompt(mode: string): string {
		const prompts: Record<string, string> = {
			coding: `You are an expert coding assistant. Help with code completion, explanation, and suggestions.
Always provide clean, well-documented code. Use markdown code blocks with language identifiers.`,

			architect: `You are a software architect. Help design systems, review architecture decisions,
and suggest best practices. Focus on scalability, maintainability, and design patterns.`,

			debug: `You are a debugging expert. Analyze code, identify bugs, and suggest fixes.
Explain the root cause and provide corrected code.`,

			learning: `You are a patient teacher. Explain concepts clearly, provide examples,
and help the user understand code and programming concepts.`
		};

		return prompts[mode] || prompts['coding'];
	}

	protected validateInitialized(): void {
		if (!this.initialized) {
			throw new Error(`Provider ${this.id} is not initialized`);
		}
	}
}
