/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * API types for the FewStepsAway CLI backend.
 *
 * These types mirror the REST API exposed by `fewstepsaway serve`.
 * The HTTP client (httpClient.ts) returns these shapes; the SSE client
 * (sseClient.ts) emits typed events derived from the raw payload.
 */

// --- Sessions ----------------------------------------------------------------

export interface SessionInfo {
	readonly id: string;
	readonly title: string;
	readonly mode?: string;
	readonly time: number;
	readonly version?: string;
	readonly isClear?: boolean;
	readonly share?: { id?: string; url?: string };
}

export interface SessionListResponse {
	readonly sessions: SessionInfo[];
}

export interface SessionCreateRequest {
	readonly directory: string;
	readonly title?: string;
	readonly share?: string;
	readonly clone?: string;
}

export interface SessionCreateResponse {
	readonly data: SessionInfo;
}

// --- Messages ----------------------------------------------------------------

export interface MessageInfo {
	readonly id: string;
	readonly role: 'user' | 'assistant' | 'system' | 'tool';
	readonly time: number;
	readonly parts: PartInfo[];
	readonly cost?: number;
	readonly error?: string;
}

export interface MessageListResponse {
	readonly messages: MessageInfo[];
}

export interface MessageSendRequest {
	readonly id?: string;
	readonly description?: string;
	readonly mode?: string;
	readonly directory?: string; // Trigger watcher refresh
	readonly prompt: string;
	readonly parts?: Array<{ readonly type: 'text'; readonly text: string } | { readonly type: 'file'; readonly path: string }>;
	readonly context?: unknown;
}

export interface MessageSendResponse {
	readonly data: MessageInfo;
}

// --- Parts (message content) -------------------------------------------------

export type PartInfo =
	| TextPart
	| ToolCallPart
	| ToolResultPart
	| DiffPart
	| StepStartPart
	| StepFinishPart
	| ErrorPart;

export interface TextPart {
	readonly type: 'text';
	readonly id: string;
	readonly text: string;
	readonly synthetic?: boolean;
}

export interface ToolCallPart {
	readonly type: 'tool';
	readonly id: string;
	readonly tool: string;
	readonly input: unknown;
	readonly state?: 'pending' | 'running' | 'completed' | 'error';
	readonly title?: string;
}

export interface ToolResultPart {
	readonly type: 'tool-result';
	readonly id: string;
	readonly tool: string;
	readonly output?: unknown;
	readonly error?: string;
	readonly title?: string;
}

export interface DiffPart {
	readonly type: 'diff';
	readonly id: string;
	readonly path: string;
	readonly patch: string;
	readonly before?: string;
	readonly after?: string;
}

export interface StepStartPart {
	readonly type: 'step-start';
	readonly id: string;
}

export interface StepFinishPart {
	readonly type: 'step-finish';
	readonly id: string;
}

export interface ErrorPart {
	readonly type: 'error';
	readonly id: string;
	readonly message: string;
}

// --- Permissions -------------------------------------------------------------

export interface PermissionRequest {
	readonly id: string;
	readonly sessionID: string;
	readonly messageID: string;
	readonly partID: string;
	readonly tool: string;
	readonly input: unknown;
	readonly title?: string;
}

export interface PermissionReplyRequest {
	readonly id: string;
	readonly reply: 'allow' | 'deny';
	readonly sessionID: string;
	readonly messageID: string;
	readonly partID: string;
}

// --- Questions ---------------------------------------------------------------

export interface QuestionRequest {
	readonly id: string;
	readonly sessionID: string;
	readonly messageID: string;
	readonly partID: string;
	readonly title?: string;
	readonly multi?: boolean;
	readonly options: Array<{ readonly label: string; readonly value: string; readonly description?: string }>;
}

export interface QuestionAnswerRequest {
	readonly id: string;
	readonly answers: string[];
	readonly sessionID: string;
	readonly messageID: string;
	readonly partID: string;
}

// --- SSE Events --------------------------------------------------------------

export type SSEEventType =
	| 'session.updated'
	| 'session.deleted'
	| 'session.status'
	| 'session.turn.open'
	| 'session.turn.close'
	| 'session.idle'
	| 'session.error'
	| 'message.created'
	| 'message.updated'
	| 'message.removed'
	| 'message.part.updated'
	| 'message.part.removed'
	| 'permission.asked'
	| 'permission.replied'
	| 'question.asked'
	| 'question.replied'
	| 'question.rejected'
	| 'suggestion.shown'
	| 'suggestion.accepted'
	| 'todo.updated'
	| 'sync'
	| 'log';

export interface SSEEventPayload {
	readonly type: SSEEventType;
	readonly sessionID?: string;
	readonly messageID?: string;
	readonly partID?: string;
	readonly data: unknown;
}

export interface SSEEvent {
	readonly type: string;
	readonly payload: SSEEventPayload;
	readonly directory?: string;
}

// --- Providers ---------------------------------------------------------------

export interface ProviderInfo {
	readonly id: string;
	readonly name: string;
	readonly models: string[];
	readonly options?: Array<{ readonly id: string; readonly label: string; readonly required?: boolean; readonly type?: string }>;
	readonly installed?: boolean;
	readonly error?: string;
}

export interface ProviderListResponse {
	readonly providers: ProviderInfo[];
}
