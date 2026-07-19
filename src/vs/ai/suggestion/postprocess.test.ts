import { describe, expect, test } from 'bun:test';
import { postprocessAutocompleteSuggestion, shouldSkipAutocomplete } from './postprocess.ts';

describe('suggestion postprocess', () => {
	test('postprocessAutocompleteSuggestion strips overlap', () => {
		const result = postprocessAutocompleteSuggestion('x = 1;', 'const ');
		expect(result).toContain('x = 1');
	});

	test('shouldSkipAutocomplete rejects duplicate line', () => {
		expect(shouldSkipAutocomplete('foo', 'foo')).toBe(true);
		expect(shouldSkipAutocomplete('bar', 'foo')).toBe(false);
	});
});
