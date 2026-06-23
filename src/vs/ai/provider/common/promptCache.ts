/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LLMRequest, SystemPart } from './llmProtocol.js';

/**
 * Apply the cache policy to a request's system parts, returning a new system
 * array with cache breakpoints marked. Mirrors Kilocode's auto-placement
 * policy: breakpoints at the last system part, the last tool definition, and
 * the latest user message.
 *
 * This is a no-op when the policy is `'none'` -- the provider protocol can
 * ignore cache markers entirely.
 */
export function applyCachePolicy(request: LLMRequest): readonly SystemPart[] {
	const policy = request.cache ?? 'auto';
	if (policy === 'none') {
		return request.system;
	}

	// Mark the last system part as cacheable.
	const system = [...request.system];
	if (system.length > 0) {
		const last = system[system.length - 1];
		if (last.type === 'text') {
			system[system.length - 1] = { type: 'text', text: last.text, cache: true };
		}
	}
	return system;
}

/**
 * Returns true if any system part has a cache breakpoint.
 */
export function hasCacheBreakpoint(system: readonly SystemPart[]): boolean {
	return system.some(p => p.type === 'text' && p.cache === true);
}
