/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Post-process an autocomplete suggestion: strip code fences, surrounding
 * whitespace, and filter out useless suggestions.
 *
 * Port of `references/kilocode/packages/kilo-vscode/src/services/autocomplete/classic-auto-complete/utils.ts`.
 */
export function postprocessAutocompleteSuggestion(suggestion: string, prefix: string): string {
	if (!suggestion) { return ''; }
	let result = suggestion;

	// Strip leading markdown code fences.
	result = result.replace(/^```[a-zA-Z]*\n?/g, '');

	// Strip trailing whitespace.
	result = result.replace(/\s+$/g, '');

	// Remove prefix overlap (if the model echoed the prefix).
	if (prefix && result.toLowerCase().startsWith(prefix.toLowerCase())) {
		result = result.slice(prefix.length);
	}

	return result;
}

/**
 * Decide whether a suggestion should be skipped (too short, only whitespace,
 * matches the current line, etc.).
 */
export function shouldSkipAutocomplete(suggestion: string, currentLineText: string): boolean {
	if (!suggestion || !suggestion.trim()) { return true; }
	// Skip if the suggestion is identical to what's already on the line.
	if (currentLineText.trim() === suggestion.trim()) { return true; }
	// Skip if it's just a single bracket or quote.
	if (/^[\s\t]*[}\]);,]+[\s\t]*$/.test(suggestion)) { return true; }
	return false;
}

/**
 * Remove overlapping prefix from a suggestion that the user has already typed.
 */
export function removePrefixOverlap(suggestion: string, typedPrefix: string): string {
	if (!typedPrefix) { return suggestion; }
	// Find the longest overlap between the end of typedPrefix and the start of suggestion.
	const maxOverlap = Math.min(typedPrefix.length, suggestion.length);
	for (let i = maxOverlap; i > 0; i--) {
		if (typedPrefix.endsWith(suggestion.slice(0, i))) {
			return suggestion.slice(i);
		}
	}
	return suggestion;
}
