/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the root of the source tree.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from 'bun:test';
import { formatWebSearchResponse } from './websearchUtils.js';

describe('websearchUtils', () => {
	test('formatWebSearchResponse returns non-empty content for @web context', () => {
		const result = formatWebSearchResponse('example query', {
			AbstractText: 'Example abstract',
			AbstractURL: 'https://example.com',
			Heading: 'Example',
		});
		expect(result.length).toBeGreaterThan(0);
		expect(result).toContain('Example abstract');
	});
});
