/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AgentEvent } from '../../../../ai/agent/agentLoop.js';
import { ToolResult } from '../../../../ai/tool/toolTypes.js';
import { URI } from '../../../../base/common/uri.js';
import { IChatExternalToolInvocationUpdate } from '../../chat/common/chatService/chatService.js';

const MAX_OUTPUT = 4000;

export function mapToolCallToProgress(
	event: Extract<AgentEvent, { type: 'tool-call' }>,
	input: unknown,
): IChatExternalToolInvocationUpdate {
	const inputStr = formatToolInput(input);
	const isMcp = event.name.startsWith('mcp_') || event.name.includes('/');
	const label = isMcp ? `MCP **${event.name}**` : `**${event.name}**`;
	return {
		kind: 'externalToolInvocationUpdate',
		toolCallId: event.id,
		toolName: event.name,
		isComplete: false,
		invocationMessage: `Running ${label}…`,
		toolSpecificData: {
			kind: 'simpleToolInvocation',
			input: inputStr,
			output: isMcp ? `MCP server tool\n${inputStr}` : '',
		},
	};
}

export function mapToolResultToProgress(
	event: Extract<AgentEvent, { type: 'tool-result' }>,
	input: unknown,
): IChatExternalToolInvocationUpdate {
	const result = event.result;
	const output = buildToolOutput(result);
	const validation = result.validation;
	const failed = validation && !validation.ok;

	return {
		kind: 'externalToolInvocationUpdate',
		toolCallId: event.id,
		toolName: event.name,
		isComplete: true,
		errorMessage: failed ? output : undefined,
		pastTenseMessage: failed ? `**${event.name}** failed validation` : `**${event.name}** completed`,
		toolSpecificData: {
			kind: 'simpleToolInvocation',
			input: formatToolInput(input),
			output,
		},
	};
}

function formatToolInput(input: unknown): string {
	if (input === undefined || input === null) {
		return '';
	}
	if (typeof input === 'string') {
		return truncate(input);
	}
	try {
		return truncate(JSON.stringify(input, null, 2));
	} catch {
		return String(input);
	}
}

function buildToolOutput(result: ToolResult): string {
	let output = typeof result.output === 'string'
		? result.output
		: JSON.stringify(result.output);

	const validation = result.validation;
	if (validation && !validation.ok) {
		const filePath = extractFilePath(result);
		const diagSource = validation.newDiagnostics?.length
			? validation.newDiagnostics
			: validation.diagnostics;
		const diagLines = diagSource
			.filter(d => d.severity === 'error')
			.map(d => formatDiagnosticLine(filePath, d.line, d.message));
		if (diagLines.length > 0) {
			output += `\n\nValidation errors:\n${diagLines.join('\n')}`;
		}
	}

	return truncate(output);
}

function truncate(text: string): string {
	if (text.length <= MAX_OUTPUT) {
		return text;
	}
	return `${text.slice(0, MAX_OUTPUT)}…`;
}

function extractFilePath(result: ToolResult): string | undefined {
	const editContent = result.metadata?.editContent as { filePath?: string } | undefined;
	return editContent?.filePath;
}

function formatDiagnosticLine(filePath: string | undefined, line: number, message: string): string {
	if (filePath) {
		const uri = URI.file(filePath);
		const link = `${uri.toString()}#L${line}`;
		return `  [L${line}: ${message}](${link})`;
	}
	return `  L${line}: ${message}`;
}
