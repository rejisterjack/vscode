/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test, beforeEach } from 'bun:test';
import { RateLimiter } from './rateLimiter.js';
import type { IConfigurationService } from '../../../platform/configuration/common/configuration.js';

function mockConfig(values: Record<string, unknown>): IConfigurationService {
	return {
		_serviceBrand: undefined,
		getValue<T>(key: string): T {
			return values[key] as T;
		},
	} as IConfigurationService;
}

describe('RateLimiter', () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		const config = mockConfig({
			'ai.rateLimit.requestsPerMinute': 2,
			'ai.rateLimit.tokensPerMinute': 1000,
		});
		limiter = new RateLimiter(config);
	});

	test('allows requests under limit', () => {
		expect(limiter.canMakeRequest('openai', 100)).toBe(true);
		limiter.recordRequest('openai', 100);
		expect(limiter.canMakeRequest('openai', 100)).toBe(true);
	});

	test('blocks when request limit exceeded', () => {
		limiter.recordRequest('openai', 10);
		limiter.recordRequest('openai', 10);
		expect(limiter.canMakeRequest('openai', 10)).toBe(false);
	});
});
