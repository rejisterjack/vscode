/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ParsedMention } from '../../../../ai/common/mentionParser.js';
import { IChatRequestVariableData } from '../../chat/common/attachments/chatVariables.js';
import {
	IChatRequestVariableEntry,
	isChatRequestFileEntry,
	isStringVariableEntry,
} from '../../chat/common/attachments/chatVariableEntries.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * Map native VS Code chat variable attachments (#file, #selection, etc.)
 * into FewStepsAway ParsedMention entries for resolveMentions().
 */
export function chatVariablesToMentions(variables: IChatRequestVariableData): ParsedMention[] {
	const mentions: ParsedMention[] = [];
	for (const variable of variables.variables) {
		const mention = variableEntryToMention(variable);
		if (mention) {
			mentions.push(mention);
		}
	}
	return mentions;
}

function variableEntryToMention(entry: IChatRequestVariableEntry): ParsedMention | undefined {
	if (isChatRequestFileEntry(entry)) {
		const uri = extractUri(entry);
		if (uri) {
			return { kind: 'file', value: uri.fsPath, raw: `#file:${uri.fsPath}` };
		}
	}
	if (entry.kind === 'directory') {
		const uri = extractUri(entry);
		if (uri) {
			return { kind: 'folder', value: uri.fsPath, raw: `#folder:${uri.fsPath}` };
		}
	}
	if (isStringVariableEntry(entry)) {
		return { kind: 'selection', value: entry.value, raw: '#selection' };
	}
	if (entry.kind === 'generic' && typeof entry.value === 'string') {
		return { kind: 'file', value: entry.value, raw: entry.name };
	}
	return undefined;
}

function extractUri(entry: IChatRequestVariableEntry): URI | undefined {
	const value = entry.value as { uri?: URI; resourceUri?: URI } | URI | undefined;
	if (URI.isUri(value)) {
		return value;
	}
	if (value && URI.isUri(value.uri)) {
		return value.uri;
	}
	if (value && URI.isUri(value.resourceUri)) {
		return value.resourceUri;
	}
	return undefined;
}
