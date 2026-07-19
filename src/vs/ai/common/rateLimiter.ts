/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IRateLimiter, UsageStats } from './types/provider.types.js';

export const IRateLimiterService = createDecorator<IRateLimiterService>('ai.rateLimiter');

export interface IRateLimiterService extends IRateLimiter {
	readonly _serviceBrand: undefined;
}

interface ProviderWindow {
	readonly timestamps: number[];
	tokenCount: number;
	windowStart: number;
}

const DEFAULT_REQUESTS_PER_MINUTE = 60;
const DEFAULT_TOKENS_PER_MINUTE = 200_000;
const WINDOW_MS = 60_000;

/**
 * Sliding-window rate limiter for AI provider requests.
 */
export class RateLimiter extends Disposable implements IRateLimiterService {
	declare readonly _serviceBrand: undefined;

	private readonly windows = new Map<string, ProviderWindow>();

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
	}

	canMakeRequest(providerId: string, tokenEstimate: number): boolean {
		const window = this.getWindow(providerId);
		this.prune(window);
		const rpm = this.configurationService.getValue<number>('ai.rateLimit.requestsPerMinute') ?? DEFAULT_REQUESTS_PER_MINUTE;
		const tpm = this.configurationService.getValue<number>('ai.rateLimit.tokensPerMinute') ?? DEFAULT_TOKENS_PER_MINUTE;
		if (window.timestamps.length >= rpm) {
			return false;
		}
		if (window.tokenCount + tokenEstimate > tpm) {
			return false;
		}
		return true;
	}

	recordRequest(providerId: string, tokensUsed: number): void {
		const window = this.getWindow(providerId);
		this.prune(window);
		window.timestamps.push(Date.now());
		window.tokenCount += tokensUsed;
	}

	getTimeUntilNextRequest(providerId: string): number {
		const window = this.getWindow(providerId);
		this.prune(window);
		if (window.timestamps.length === 0) {
			return 0;
		}
		const oldest = window.timestamps[0]!;
		return Math.max(0, WINDOW_MS - (Date.now() - oldest));
	}

	getUsageStats(providerId: string): UsageStats {
		const window = this.getWindow(providerId);
		this.prune(window);
		const rpm = this.configurationService.getValue<number>('ai.rateLimit.requestsPerMinute') ?? DEFAULT_REQUESTS_PER_MINUTE;
		const tpm = this.configurationService.getValue<number>('ai.rateLimit.tokensPerMinute') ?? DEFAULT_TOKENS_PER_MINUTE;
		return {
			requestsThisMinute: window.timestamps.length,
			tokensToday: window.tokenCount,
			totalRequests: window.timestamps.length,
			totalTokens: window.tokenCount,
			averageLatency: 0,
		};
	}

	private getWindow(providerId: string): ProviderWindow {
		let window = this.windows.get(providerId);
		if (!window) {
			window = { timestamps: [], tokenCount: 0, windowStart: Date.now() };
			this.windows.set(providerId, window);
		}
		return window;
	}

	private prune(window: ProviderWindow): void {
		const cutoff = Date.now() - WINDOW_MS;
		while (window.timestamps.length > 0 && window.timestamps[0]! < cutoff) {
			window.timestamps.shift();
		}
		if (window.timestamps.length === 0) {
			window.tokenCount = 0;
		}
	}
}
