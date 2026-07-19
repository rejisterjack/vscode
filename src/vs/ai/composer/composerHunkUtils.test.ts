import { describe, expect, test } from 'bun:test';
import { computeComposerHunks, getEffectiveModified, setHunkStatus, buildHunkTextEdits } from './composerHunkUtils.ts';

describe('composerHunkUtils', () => {
	test('computeComposerHunks groups changed lines', () => {
		const hunks = computeComposerHunks('line1\nold\nline3', 'line1\nnew\nline3');
		expect(hunks.length).toBe(1);
		expect(hunks[0]!.original).toBe('old');
		expect(hunks[0]!.modified).toBe('new');
	});

	test('getEffectiveModified applies accepted hunks only', () => {
		const original = 'a\nb\nc';
		const modified = 'a\nB\nc';
		const hunks = computeComposerHunks(original, modified);
		const accepted = setHunkStatus(hunks, hunks[0]!.id, 'accepted');
		expect(getEffectiveModified(original, accepted)).toBe('a\nB\nc');
		const rejected = setHunkStatus(hunks, hunks[0]!.id, 'rejected');
		expect(getEffectiveModified(original, rejected)).toBe(original);
	});

	test('buildHunkTextEdits produces range edits for hunks', () => {
		const original = 'a\nb\nc';
		const modified = 'a\nB\nc';
		const computed = computeComposerHunks(original, modified);
		const hunks = setHunkStatus(computed, computed[0]!.id, 'accepted');
		const edits = buildHunkTextEdits(hunks);
		expect(edits.length).toBe(1);
		expect(edits[0]!.text).toBe('B');
	});

	test('buildHunkTextEdits skips pending hunks', () => {
		const original = 'a\nb\nc';
		const modified = 'a\nB\nc';
		const pending = computeComposerHunks(original, modified);
		expect(buildHunkTextEdits(pending).length).toBe(0);
	});
});
