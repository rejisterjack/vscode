import { describe, expect, test } from 'bun:test';
import { applyHunk, parsePatch, parseMultiFilePatch, parseCursorBeginPatch } from './applyPatchUtils.ts';

describe('applyPatchTool', () => {
	test('parsePatch extracts hunks from unified diff', () => {
		const patch = `@@ -1,2 +1,3 @@
 line1
-old
+new
 line2`;
		const hunks = parsePatch(patch);
		expect(hunks.length).toBe(1);
		expect(hunks[0]!.oldLines).toEqual(['line1', 'old', 'line2']);
		expect(hunks[0]!.newLines).toEqual(['line1', 'new', 'line2']);
	});

	test('applyHunk replaces matching context', () => {
		const lines = ['line1', 'old', 'line2'];
		const hunks = parsePatch(`@@ -1,3 +1,3 @@
 line1
-old
+new
 line2`);
		const result = applyHunk(lines, hunks[0]!);
		expect(result).toEqual(['line1', 'new', 'line2']);
	});

	test('applyHunk throws when context missing', () => {
		expect(() => applyHunk(['a', 'b'], {
			oldLines: ['missing'],
			newLines: ['x'],
			contextStart: 1,
		})).toThrow(/context not found/);
	});

	test('parseMultiFilePatch extracts multiple files', () => {
		const patch = `--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
-old-a
+new-a
 line2
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,1 +1,1 @@
-old-b
+new-b`;
		const files = parseMultiFilePatch(patch);
		expect(files.length).toBe(2);
		expect(files[0]!.filePath).toBe('src/a.ts');
		expect(files[1]!.filePath).toBe('src/b.ts');
	});

	test('parseCursorBeginPatch extracts Cursor-style multi-file patch', () => {
		const patch = `*** Begin Patch
*** Update File: src/foo.ts
@@
 line1
-old
+new
*** Update File: src/bar.ts
@@
-old2
+new2
*** End Patch`;
		const files = parseCursorBeginPatch(patch);
		expect(files.length).toBe(2);
		expect(files[0]!.filePath).toBe('src/foo.ts');
		expect(files[1]!.filePath).toBe('src/bar.ts');
	});

	test('parseMultiFilePatch auto-detects Cursor Begin Patch format', () => {
		const patch = `*** Begin Patch
*** Update File: a.ts
@@
-x
+y
*** End Patch`;
		const files = parseMultiFilePatch(patch);
		expect(files.length).toBe(1);
		expect(files[0]!.filePath).toBe('a.ts');
	});
});
