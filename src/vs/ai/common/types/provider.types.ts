/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { IAIProvider } from '../../provider/common/aiProvider.js';
import { Event } from '../../../base/common/event.js';

/**
 * Provider registry interface
 */
export interface IProviderRegistry {
	/**
	 * Register a provider
	 */
	register(provider: IAIProvider): void;

	/**
	 * Unregister a provider
	 */
	unregister(providerId: string): void;

	/**
	 * Get a provider by ID
	 */
	getProvider(providerId: string): IAIProvider | undefined;

	/**
	 * Get all registered providers
	 */
	getAllProviders(): IAIProvider[];

	/**
	 * Get enabled providers
	 */
	getEnabledProviders(): IAIProvider[];

	/**
	 * Set the active provider
	 */
	setActiveProvider(providerId: string): void;

	/**
	 * Get the active provider
	 */
	getActiveProvider(): IAIProvider | undefined;

	/**
	 * Event fired when active provider changes
	 */
	onDidChangeActiveProvider: Event<{ oldProvider: string; newProvider: string }>;

	/**
	 * Event fired when a provider is registered
	 */
	onDidRegisterProvider: Event<IAIProvider>;

	/**
	 * Event fired when a provider is unregistered
	 */
	onDidUnregisterProvider: Event<string>;
}

/**
 * AI Service interface - main entry point for AI operations
 */
export interface IAIService {
	/**
	 * Send a request to the active provider
	 */
	sendRequest(request: AIRequest): Promise<AIResponse>;

	/**
	 * Stream a request from the active provider
	 */
	streamRequest(request: AIRequest): AsyncIterable<AIResponseChunk>;

	/**
	 * Get the provider registry
	 */
	getProviderRegistry(): IProviderRegistry;

	/**
	 * Switch to a different provider
	 */
	switchProvider(providerId: string): Promise<void>;

	/**
	 * Get current provider info
	 */
	getCurrentProvider(): { id: string; name: string; model: string } | undefined;

	/**
	 * Estimate token count for text
	 */
	estimateTokens(text: string): number;

	/**
	 * Check if a provider is available
	 */
	isProviderAvailable(providerId: string): boolean;

	/**
	 * Event fired when a request starts
	 */
	onWillSendRequest: Event<AIRequest>;

	/**
	 * Event fired when a response is received
	 */
	onDidReceiveResponse: Event<{ request: AIRequest; response: AIResponse }>;

	/**
	 * Event fired when an error occurs
	 */
	onDidEncounterError: Event<{ request: AIRequest; error: Error }>;
}

import { AIRequestContext, AIResponse, AIResponseChunk } from './ai.types.js';

/**
 * AI Request wrapper
 */
export interface AIRequest extends AIRequestContext {
	/** Request timestamp */
	timestamp: number;
	/** Request priority */
	priority?: 'low' | 'normal' | 'high';
	/** Timeout in milliseconds */
	timeout?: number;
}

/**
 * Rate limiter interface
 */
export interface IRateLimiter {
	/**
	 * Check if a request can be made
	 */
	canMakeRequest(providerId: string, tokenEstimate: number): boolean;

	/**
	 * Record a request
	 */
	recordRequest(providerId: string, tokensUsed: number): void;

	/**
	 * Get time until next request can be made
	 */
	getTimeUntilNextRequest(providerId: string): number;

	/**
	 * Get usage statistics
	 */
	getUsageStats(providerId: string): UsageStats;
}

/**
 * Usage statistics
 */
export interface UsageStats {
	/** Requests made in current window */
	requestsThisMinute: number;
	/** Tokens used today */
	tokensToday: number;
	/** Total requests */
	totalRequests: number;
	/** Total tokens used */
	totalTokens: number;
	/** Average latency */
	averageLatency: number;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
	/** Provider ID */
	providerId: string;
	/** Whether provider is healthy */
	isHealthy: boolean;
	/** Last check timestamp */
	lastChecked: number;
	/** Average response time */
	averageResponseTime: number;
	/** Error rate (0-1) */
	errorRate: number;
	/** Status message */
	message?: string;
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
	/** Ordered list of fallback provider IDs */
	providerOrder: string[];
	/** Whether to auto-fallback on error */
	autoFallback: boolean;
	/** Max retry attempts per provider */
	maxRetries: number;
	/** Retry delay in milliseconds */
	retryDelay: number;
}

/**
 * Model information
 */
export interface ModelInfo {
	/** Model identifier */
	id: string;
	/** Model display name */
	name: string;
	/** Provider ID */
	provider: string;
	/** Context window size */
	contextWindow: number;
	/** Whether model supports streaming */
	supportsStreaming: boolean;
	/** Whether model supports function calling */
	supportsFunctionCalling: boolean;
	/** Model capabilities */
	capabilities: string[];
	/** Pricing info (optional) */
	pricing?: {
		inputPer1K: number;
		outputPer1K: number;
	};
}

/**
 * Provider factory interface
 */
export interface IProviderFactory {
	/**
	 * Create a provider instance
	 */
	createProvider(type: string): IAIProvider;

	/**
	 * Get available provider types
	 */
	getAvailableTypes(): string[];
}
