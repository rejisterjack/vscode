/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from 'bun:test';
import { parseMentions, stripMentions } from './mentionParser.js';

describe('mentionParser', () => {
	test('parses typed mentions', () => {
		const text = 'Check @file:src/foo.ts and @codebase for context';
		const mentions = parseMentions(text);
		expect(mentions).toHaveLength(2);
		expect(mentions[0]?.kind).toBe('file');
		expect(mentions[0]?.value).toBe('src/foo.ts');
		expect(mentions[1]?.kind).toBe('codebase');
	});

	test('parses bare path mentions', () => {
		const mentions = parseMentions('See @src/bar.ts');
		expect(mentions[0]?.kind).toBe('file');
		expect(mentions[0]?.value).toBe('src/bar.ts');
	});

	test('parses git mentions', () => {
		const mentions = parseMentions('Review @git:status and @git:diff before merge');
		expect(mentions).toHaveLength(2);
		expect(mentions[0]?.kind).toBe('git');
		expect(mentions[0]?.value).toBe('status');
		expect(mentions[1]?.kind).toBe('git');
		expect(mentions[1]?.value).toBe('diff');
	});

	test('parses commit and branch mentions', () => {
		const mentions = parseMentions('Check @commit:abc1234 on @branch:feature/foo');
		expect(mentions).toHaveLength(2);
		expect(mentions[0]?.kind).toBe('commit');
		expect(mentions[0]?.value).toBe('abc1234');
		expect(mentions[1]?.kind).toBe('branch');
		expect(mentions[1]?.value).toBe('feature/foo');
	});

	test('parses symbol path#name mentions', () => {
		const mentions = parseMentions('Explain @symbol:src/app.ts#MyClass');
		expect(mentions).toHaveLength(1);
		expect(mentions[0]?.kind).toBe('symbol');
		expect(mentions[0]?.value).toBe('src/app.ts#MyClass');
	});

	test('parses diff mention', () => {
		const mentions = parseMentions('Show @diff:HEAD~1');
		expect(mentions[0]?.kind).toBe('diff');
		expect(mentions[0]?.value).toBe('HEAD~1');
	});

	test('strips mentions from text', () => {
		expect(stripMentions('Hello @file:a.ts world')).toBe('Hello world');
	});
});
