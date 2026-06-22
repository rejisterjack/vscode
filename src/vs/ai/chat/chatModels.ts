/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { MessageRole, IMessage } from '../common/types/conversation.types.js';
import { PartInfo, TextPart, ToolCallPart, ToolResultPart, PermissionRequest, QuestionRequest } from '../backend/apiTypes.js';

/**
 * UI-facing chat message model.
 *
 * Wraps the persistence-layer IMessage with a richer part model assembled
 * from SSE part-updated events. The UI renders ChatMessage instances; the
 * ChatService translates between these and the CLI backend's API.
 */
export interface ChatMessage {
	/** Backend message ID */
	readonly id: string;
	/** Message role */
	readonly role: MessageRole;
	/** Assembled parts */
	readonly parts: ChatMessagePart[];
	/** Timestamp */
	readonly time: number;
	/** Whether this message is still streaming */
	readonly isStreaming: boolean;
	/** Error message if the message failed */
	readonly error?: string;
	/** Token cost */
	readonly cost?: number;
}

/**
 * Union of part types the UI knows how to render.
 */
export type ChatMessagePart =
	| { kind: 'text'; id: string; text: string }
	| { kind: 'tool-call'; id: string; tool: string; input: unknown; state?: string; title?: string }
	| { kind: 'tool-result'; id: string; tool: string; output?: unknown; error?: string; title?: string }
	| { kind: 'diff'; id: string; path: string; patch: string }
	| { kind: 'step-start'; id: string }
	| { kind: 'step-finish'; id: string }
	| { kind: 'error'; id: string; message: string };

/**
 * Convert a backend PartInfo to a UI ChatMessagePart.
 */
export function toUiPart(part: PartInfo): ChatMessagePart {
	switch (part.type) {
		case 'text':
			return { kind: 'text', id: part.id, text: (part as TextPart).text };
		case 'tool':
			return { kind: 'tool-call', id: part.id, tool: (part as ToolCallPart).tool, input: (part as ToolCallPart).input, state: (part as ToolCallPart).state, title: (part as ToolCallPart).title };
		case 'tool-result':
			return { kind: 'tool-result', id: part.id, tool: (part as ToolResultPart).tool, output: (part as ToolResultPart).output, error: (part as ToolResultPart).error, title: (part as ToolResultPart).title };
		case 'diff':
			return { kind: 'diff', id: part.id, path: (part as { path: string }).path, patch: (part as { patch: string }).patch };
		case 'step-start':
			return { kind: 'step-start', id: part.id };
		case 'step-finish':
			return { kind: 'step-finish', id: part.id };
		case 'error':
			return { kind: 'error', id: part.id, message: (part as { message: string }).message };
		default:
			return { kind: 'text', id: (part as { id: string }).id ?? 'unknown', text: JSON.stringify(part) };
	}
}

/**
 * Assemble a plain text representation of a message (for simple rendering).
 */
export function messageToPlainText(message: ChatMessage): string {
	return message.parts
		.filter(p => p.kind === 'text')
		.map(p => (p as { text: string }).text)
		.join('');
}

/**
 * Convert a backend MessageInfo to a UI ChatMessage.
 */
export function toChatMessage(info: { id: string; role: MessageRole; time: number; parts?: PartInfo[]; cost?: number; error?: string }): ChatMessage {
	return {
		id: info.id,
		role: info.role,
		parts: (info.parts ?? []).map(toUiPart),
		time: info.time,
		isStreaming: false,
		error: info.error,
		cost: info.cost
	};
}

/**
 * Pending permission/question requests surfaced to the UI.
 */
export interface PendingPermission {
	readonly request: PermissionRequest;
	readonly conversationId: string;
}

export interface PendingQuestion {
	readonly request: QuestionRequest;
	readonly conversationId: string;
}

export type { IMessage };
