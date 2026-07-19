import { describe, expect, test } from 'bun:test';
import { countOccurrences } from './editStringUtils.ts';

describe('editTool helpers', () => {
	test('countOccurrences counts non-overlapping matches', () => {
		expect(countOccurrences('foo bar foo', 'foo')).toBe(2);
		expect(countOccurrences('foo bar', 'baz')).toBe(0);
		expect(countOccurrences('', 'foo')).toBe(0);
	});
});
