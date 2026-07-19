/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range } from '../../editor/common/core/range.js';
import { TextEdit } from '../../editor/common/languages.js';
import { ComposerHunk, ComposerHunkStatus } from './composerTypes.js';

let hunkIdCounter = 0;
function createHunkId(): string {
	hunkIdCounter += 1;
	return `hunk-${hunkIdCounter}`;
}

/**
 * Compute line-based hunks between original and modified file content.
 */
export function computeComposerHunks(original: string, modified: string): ComposerHunk[] {
	const originalLines = original.split('\n');
	const modifiedLines = modified.split('\n');
	const hunks: ComposerHunk[] = [];
	let index = 0;
	while (index < Math.max(originalLines.length, modifiedLines.length)) {
		const oLine = originalLines[index];
		const mLine = modifiedLines[index];
		if (oLine === mLine) {
			index++;
			continue;
		}
		const startLine = index + 1;
		const oldChunk: string[] = [];
		const newChunk: string[] = [];
		while (index < Math.max(originalLines.length, modifiedLines.length)) {
			const o = originalLines[index];
			const m = modifiedLines[index];
			if (o === m && oldChunk.length > 0 && newChunk.length > 0) {
				break;
			}
			if (o === m && oldChunk.length === 0 && newChunk.length === 0) {
				index++;
				break;
			}
			if (o !== undefined) {
				oldChunk.push(o);
			}
			if (m !== undefined) {
				newChunk.push(m);
			}
			index++;
			if (index >= Math.max(originalLines.length, modifiedLines.length)) {
				break;
			}
			const nextO = originalLines[index];
			const nextM = modifiedLines[index];
			if (nextO === nextM && oldChunk.length > 0) {
				break;
			}
		}
		if (oldChunk.length > 0 || newChunk.length > 0) {
			hunks.push({
				id: createHunkId(),
				startLine,
				endLine: startLine + Math.max(oldChunk.length, newChunk.length) - 1,
				original: oldChunk.join('\n'),
				modified: newChunk.join('\n'),
				status: 'pending',
			});
		}
	}
	return hunks;
}

export function getEffectiveModified(original: string, hunks: readonly ComposerHunk[]): string {
	if (hunks.length === 0) {
		return original;
	}
	const lines = original.split('\n');
	const sorted = [...hunks].sort((a, b) => b.startLine - a.startLine);
	let result = lines;
	for (const hunk of sorted) {
		if (hunk.status === 'rejected') {
			continue;
		}
		const start = hunk.startLine - 1;
		const deleteCount = hunk.original ? hunk.original.split('\n').length : 0;
		const insertLines = hunk.status === 'accepted' || hunk.status === 'pending'
			? hunk.modified.split('\n')
			: hunk.original.split('\n');
		result = [
			...result.slice(0, start),
			...insertLines,
			...result.slice(start + deleteCount),
		];
	}
	return result.join('\n');
}

export function setHunkStatus(hunks: readonly ComposerHunk[], hunkId: string, status: ComposerHunkStatus): ComposerHunk[] {
	return hunks.map(hunk => hunk.id === hunkId ? { ...hunk, status } : hunk);
}

/**
 * Build incremental TextEdit[] from accepted hunks for chat editing bridge apply.
 */
export function buildHunkTextEdits(hunks: readonly ComposerHunk[]): TextEdit[] {
	const edits: TextEdit[] = [];
	for (const hunk of hunks) {
		if (hunk.status !== 'accepted') {
			continue;
		}
		const originalLines = hunk.original ? hunk.original.split('\n') : [];
		const lineCount = Math.max(originalLines.length, 1);
		const endLine = hunk.startLine + lineCount - 1;
		const endColumn = (originalLines[lineCount - 1]?.length ?? 0) + 1;
		edits.push({
			range: new Range(hunk.startLine, 1, endLine, endColumn),
			text: hunk.modified,
		});
	}
	return edits;
}
