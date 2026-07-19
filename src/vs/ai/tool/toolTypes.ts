/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../base/common/cancellation.js';

/**
 * A tool's parameter schema is a JSON Schema object.
 */
export type ToolParameterSchema = Record<string, unknown>;

/**
 * Context passed to a tool's `execute` function. Carries the session id,
 * message id, an abort signal, and a callback to ask the user for permission.
 *
 * Port of `references/kilocode/packages/opencode/src/tool/tool.ts:34-44`.
 */
export interface ToolContext {
	readonly sessionId: string;
	readonly messageId: string;
	readonly callId: string;
	readonly abortSignal: CancellationToken;
	/**
	 * Ask the user for permission. Returns true if granted, false if denied.
	 */
	ask(prompt: string): Promise<boolean>;
}

export interface ToolValidationResult {
	readonly ok: boolean;
	readonly errorsBefore: number;
	readonly errorsAfter: number;
	readonly diagnostics: Array<{ line: number; message: string; severity: string }>;
	readonly newDiagnostics?: Array<{ line: number; message: string; severity: string }>;
}

/** Original/modified content for chat-editing bridge and UI apply surfaces. */
export interface ToolEditContent {
	readonly filePath: string;
	readonly original: string;
	readonly modified: string;
	readonly staged?: boolean;
}

/**
 * Result of executing a tool.
 *
 * Port of `references/kilocode/packages/opencode/src/tool/tool.ts:46-51`.
 */
export interface ToolResult {
	/** Human-readable title shown in the UI (e.g. "Read src/main.ts"). */
	readonly title: string;
	/** The output returned to the LLM as the tool result. */
	readonly output: unknown;
	/** Optional metadata for the UI. */
	readonly metadata?: Record<string, unknown>;
	/** Post-apply LSP validation (edit/write tools). */
	readonly validation?: ToolValidationResult;
}

/**
 * The interface every tool implements. Tools are invoked by the agent loop
 * when the LLM emits a tool-call event.
 *
 * Port of `references/kilocode/packages/opencode/src/tool/tool.ts:53-63`.
 */
export interface ITool {
	/** Stable tool identifier (e.g. "read", "write", "bash"). */
	readonly id: string;
	/** Human-readable description shown to the LLM. */
	readonly description: string;
	/** JSON Schema for the tool's parameters. */
	readonly parameters: ToolParameterSchema;
	/**
	 * Execute the tool with the given arguments and context.
	 */
	execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * A tool definition in the wire format sent to the LLM.
 */
export interface ToolWireDefinition {
	readonly name: string;
	readonly description: string;
	readonly parameters: ToolParameterSchema;
}

/**
 * Convert an `ITool` to the wire format for the LLM.
 */
export function toWireDefinition(tool: ITool): ToolWireDefinition {
	return {
		name: tool.id,
		description: tool.description,
		parameters: tool.parameters
	};
}
