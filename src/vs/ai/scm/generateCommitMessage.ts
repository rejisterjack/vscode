/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SystemPart, ModelRef, Message, GenerationOptions } from '../provider/common/llmProtocol.js';
import { IToolEnabledProvider } from '../provider/common/protocolBackedProvider.js';

/**
 * The system prompt used to generate a conventional commit message from a diff.
 * The model is instructed to output ONLY the message, no preamble.
 */
export const COMMIT_MESSAGE_INSTRUCTION = [
	'You write git commit messages from code diffs.',
	'Follow the Conventional Commits specification: `<type>[optional scope]: <description>` on the first line, optionally followed by a blank line and a concise body.',
	'Use the imperative mood for the description (e.g. "add", "fix", "refactor").',
	'Keep the subject line under 72 characters. Do not end it with a period.',
	'Use one of these types: feat, fix, refactor, perf, docs, test, chore, style, build, ci, revert.',
	'If the change is large or spans multiple concerns, add a short bullet-point body summarizing the key changes.',
	'Output ONLY the raw commit message. No explanations, no markdown fences, no surrounding quotes, no "Here is your commit message:" preamble.',
	'If the diff is empty or unreadable, output exactly: "chore: update staged changes".',
].join(' ');

/**
 * Hard cap on the number of characters of diff text we send to the model.
 * Keeps prompt+response well within small-model context limits and keeps
 * the call fast/cheap. Roughly ~2-3k tokens at ~4 chars/token.
 */
export const MAX_DIFF_CHARS = 6000;

/**
 * Generate a commit message from a textual diff.
 *
 * @param diffText The staged/unstaged diff in unified diff format.
 * @param provider A tool-enabled AI provider.
 * @param modelId The model id to use (typically a small/fast model).
 * @returns The generated commit message text.
 */
export async function generateCommitMessage(
	diffText: string,
	provider: IToolEnabledProvider,
	modelId: string
): Promise<string> {
	const modelRef: ModelRef = { id: modelId };
	const system: SystemPart[] = [{ type: 'text', text: COMMIT_MESSAGE_INSTRUCTION }];

	const truncated = truncateDiff(diffText, MAX_DIFF_CHARS);
	const messages: Message[] = [
		{
			role: 'user',
			content: `Generate a git commit message for the following diff:\n\n${truncated}`
		}
	];

	const generation: GenerationOptions = {
		// Reasoning models (e.g. GLM-5.2) consume output tokens for internal
		// chain-of-thought before emitting the answer, so leave headroom.
		maxTokens: 1500,
		temperature: 0.4
	};

	const result = await provider.generateWithTools({
		model: modelRef,
		system,
		messages,
		generation,
		toolChoice: { type: 'none' },
	});

	return cleanResult(result.text);
}

/**
 * Truncate a diff to a maximum number of characters, preserving the most
 * informative content. Diff headers and additions are prioritized over
 * context lines, but we keep it simple: keep the head of the diff and
 * append a truncation marker if it overflows.
 */
export function truncateDiff(diffText: string, maxChars: number): string {
	const trimmed = diffText.trim();
	if (trimmed.length <= maxChars) {
		return trimmed;
	}
	// Keep the leading section (file headers + earliest hunks) which usually
	// carries the most signal about the scope of the change.
	const head = trimmed.slice(0, maxChars);
	const truncationMarker = `\n\n[... diff truncated: ${trimmed.length - maxChars} more characters omitted ...]`;
	return head + truncationMarker;
}

/**
 * Strip markdown code fences and surrounding quotes from the generated text,
 * and collapse any leading "Here is..." preamble the model may have added
 * despite instructions.
 */
function cleanResult(text: string): string {
	let cleaned = text.trim();
	// Strip markdown fences.
	cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/g, '').replace(/\n?```$/g, '');
	// Strip surrounding quotes.
	if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
		(cleaned.startsWith('\'') && cleaned.endsWith('\''))) {
		cleaned = cleaned.slice(1, -1);
	}
	// Drop common leading preambles the model sometimes adds despite instructions.
	cleaned = cleaned.replace(/^(here(?:'s| is)(?: your| a)?(?: the)? commit message[:.]?\s*)/i, '');
	return cleaned.trim();
}
