/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface PatchHunk {
	readonly oldLines: string[];
	readonly newLines: string[];
	readonly contextStart: number;
}

export interface FilePatch {
	readonly filePath: string;
	readonly hunks: readonly PatchHunk[];
}

export function parsePatch(patch: string): PatchHunk[] {
	const hunks: PatchHunk[] = [];
	const lines = patch.split('\n');
	let i = 0;
	while (i < lines.length) {
		if (!lines[i]!.startsWith('@@')) {
			i++;
			continue;
		}
		const header = lines[i]!;
		const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(header);
		const contextStart = match ? parseInt(match[1]!, 10) : 1;
		i++;
		const oldLines: string[] = [];
		const newLines: string[] = [];
		while (i < lines.length && !lines[i]!.startsWith('@@') && !lines[i]!.startsWith('--- ') && !lines[i]!.startsWith('+++ ')) {
			const line = lines[i]!;
			if (line.startsWith('-')) {
				oldLines.push(line.slice(1));
			} else if (line.startsWith('+')) {
				newLines.push(line.slice(1));
			} else if (line.startsWith(' ')) {
				oldLines.push(line.slice(1));
				newLines.push(line.slice(1));
			} else if (line === '\\ No newline at end of file') {
				// skip
			} else if (line.length > 0) {
				oldLines.push(line);
				newLines.push(line);
			}
			i++;
		}
		hunks.push({ oldLines, newLines, contextStart });
	}
	return hunks;
}

/**
 * Parse a unified diff that may contain multiple files.
 * Falls back to single-file mode when only @@ hunks are present.
 */
export function parseMultiFilePatch(patch: string, fallbackFilePath?: string): FilePatch[] {
	const trimmed = patch.trim();
	if (trimmed.startsWith('*** Begin Patch') || trimmed.startsWith('*** Update File:')) {
		return parseCursorBeginPatch(patch);
	}

	const lines = patch.split('\n');
	const hasFileHeaders = lines.some(line => line.startsWith('--- ') || line.startsWith('+++ '));
	if (!hasFileHeaders) {
		if (!fallbackFilePath) {
			throw new Error('filePath is required for single-file patches without ---/+++ headers');
		}
		return [{ filePath: fallbackFilePath, hunks: parsePatch(patch) }];
	}

	const results: FilePatch[] = [];
	let currentFilePath: string | undefined;
	let buffer: string[] = [];

	const flush = () => {
		if (!currentFilePath) {
			return;
		}
		const hunks = parsePatch(buffer.join('\n'));
		if (hunks.length > 0) {
			results.push({ filePath: currentFilePath, hunks });
		}
		buffer = [];
	};

	for (const line of lines) {
		if (line.startsWith('+++ ')) {
			flush();
			currentFilePath = normalizePatchPath(line);
			continue;
		}
		if (line.startsWith('--- ')) {
			continue;
		}
		if (currentFilePath) {
			buffer.push(line);
		}
	}
	flush();

	if (results.length === 0 && fallbackFilePath) {
		return [{ filePath: fallbackFilePath, hunks: parsePatch(patch) }];
	}
	return results;
}

/**
 * Parse Cursor-style multi-file patches:
 * *** Begin Patch
 * *** Update File: path/to/file.ts
 * @@
 *  context
 * -old
 * +new
 * *** End Patch
 */
export function parseCursorBeginPatch(patch: string): FilePatch[] {
	const lines = patch.split('\n');
	const results: FilePatch[] = [];
	let currentFilePath: string | undefined;
	let buffer: string[] = [];

	const flush = () => {
		if (!currentFilePath) {
			return;
		}
		const hunks = parsePatch(buffer.join('\n'));
		if (hunks.length > 0) {
			results.push({ filePath: currentFilePath, hunks });
		}
		buffer = [];
	};

	for (const line of lines) {
		if (line.startsWith('*** Update File:') || line.startsWith('*** Add File:')) {
			flush();
			currentFilePath = line.replace(/^\*\*\* (?:Update|Add) File:\s*/, '').trim();
			continue;
		}
		if (line.startsWith('*** End Patch') || line.startsWith('*** Begin Patch')) {
			continue;
		}
		if (line.startsWith('*** Delete File:')) {
			flush();
			currentFilePath = line.replace(/^\*\*\* Delete File:\s*/, '').trim();
			buffer.push('@@ -1,1 +1,0 @@');
			buffer.push('-deleted');
			flush();
			currentFilePath = undefined;
			continue;
		}
		if (currentFilePath) {
			buffer.push(line);
		}
	}
	flush();
	return results;
}

function normalizePatchPath(header: string): string {
	const raw = header.replace(/^\+\+\+\s+/, '').trim();
	return raw.replace(/^[ab]\//, '');
}

export function applyHunk(fileLines: string[], hunk: PatchHunk): string[] {
	const search = hunk.oldLines.join('\n');
	const fileText = fileLines.join('\n');
	const idx = fileText.indexOf(search);
	if (idx === -1) {
		throw new Error(`Patch hunk context not found near line ${hunk.contextStart}`);
	}
	const replacement = hunk.newLines.join('\n');
	const newText = fileText.slice(0, idx) + replacement + fileText.slice(idx + search.length);
	return newText.split('\n');
}

export function applyFilePatch(original: string, hunks: readonly PatchHunk[]): string {
	let lines = original.split('\n');
	for (const hunk of hunks) {
		lines = applyHunk(lines, hunk);
	}
	return lines.join('\n');
}
