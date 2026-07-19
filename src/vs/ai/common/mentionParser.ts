/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type MentionKind =
	| 'file'
	| 'folder'
	| 'symbol'
	| 'codebase'
	| 'web'
	| 'terminal'
	| 'selection'
	| 'git'
	| 'commit'
	| 'branch'
	| 'diff';

export interface ParsedMention {
	readonly kind: MentionKind;
	readonly raw: string;
	readonly value: string;
	readonly start: number;
	readonly end: number;
}

const TYPED_MENTION_KINDS = 'file|folder|symbol|codebase|web|terminal|selection|git|commit|branch|diff';
const MENTION_PATTERN = new RegExp(
	`@(${TYPED_MENTION_KINDS})(?::([^\\s@]+))?|@([^\\s@]+)`,
	'g'
);

/**
 * Parse @-mentions from chat input text.
 * Supports @file:path, @folder:path, @codebase, @web:query, @symbol:path#Name,
 * @git:status, @git:diff, @commit:sha, @branch:name, and bare @path.
 */
export function parseMentions(text: string): ParsedMention[] {
	const mentions: ParsedMention[] = [];
	let match: RegExpExecArray | null;
	MENTION_PATTERN.lastIndex = 0;
	while ((match = MENTION_PATTERN.exec(text)) !== null) {
		const full = match[0];
		const typedKind = match[1] as MentionKind | undefined;
		const typedValue = match[2];
		const barePath = match[3];

		if (typedKind) {
			mentions.push({
				kind: typedKind,
				raw: full,
				value: typedValue ?? '',
				start: match.index,
				end: match.index + full.length,
			});
		} else if (barePath) {
			const kind: MentionKind = barePath.endsWith('/') ? 'folder' : 'file';
			mentions.push({
				kind,
				raw: full,
				value: barePath,
				start: match.index,
				end: match.index + full.length,
			});
		}
	}
	return mentions;
}

/**
 * Strip mention tokens from text for display or logging.
 */
export function stripMentions(text: string): string {
	return text.replace(MENTION_PATTERN, '').replace(/\s+/g, ' ').trim();
}
