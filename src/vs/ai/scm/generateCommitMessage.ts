/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SystemPart, ModelRef, Message, GenerationOptions } from '../provider/common/llmProtocol.js';
import { IToolEnabledProvider } from '../provider/common/protocolBackedProvider.js';
import { CommitConventions } from './commitConventions.js';

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
 * @param conventions Optional project-specific conventions detected from the
 * repo (commitlint config, git template, recent git-log style). When present,
 * these OVERRIDE the base Conventional Commits defaults encoded in
 * {@link COMMIT_MESSAGE_INSTRUCTION}.
 * @returns The generated commit message text.
 */
export async function generateCommitMessage(
	diffText: string,
	provider: IToolEnabledProvider,
	modelId: string,
	conventions?: CommitConventions
): Promise<string> {
	const modelRef: ModelRef = { id: modelId };
	const system: SystemPart[] = [{ type: 'text', text: COMMIT_MESSAGE_INSTRUCTION }];

	const conventionsInstruction = conventionsToInstructions(conventions);
	if (conventionsInstruction) {
		system.push({ type: 'text', text: conventionsInstruction });
	}

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

/**
 * Turn detected project conventions into a single instruction clause that is
 * appended to the base system prompt. Every field is optional; only the
 * fields actually detected from the repo are emitted, so the model isn't
 * asked to follow a rule we couldn't verify.
 *
 * Returns an empty string when no conventions are present, in which case the
 * caller falls back to the base Conventional Commits defaults.
 */
export function conventionsToInstructions(conventions: CommitConventions | undefined): string {
	if (!conventions) { return ''; }

	const clauses: string[] = [];

	if (conventions.allowedTypes?.length) {
		clauses.push(`Use ONLY these commit types: ${conventions.allowedTypes.join(', ')}. Do not use any other type.`);
	}

	if (conventions.allowedScopes?.length) {
		const listed = conventions.allowedScopes.slice(0, 40).join(', ');
		clauses.push(`Prefer one of these scopes when relevant: ${listed}. If none fits, omit the scope rather than inventing one.`);
	}

	if (typeof conventions.headerMaxLength === 'number') {
		clauses.push(`The subject line MUST be at most ${conventions.headerMaxLength} characters.`);
	}

	if (conventions.subjectCase === 'lower') {
		clauses.push('Write the subject in lower case.');
	} else if (conventions.subjectCase === 'upper') {
		clauses.push('Start the subject with an upper-case letter (sentence case).');
	} else if (conventions.subjectCase === 'sentence') {
		clauses.push('Write the subject in sentence case (first letter capitalized).');
	}

	if (conventions.noTrailingPeriod) {
		clauses.push('Do not end the subject with a period.');
	}

	if (typeof conventions.bodyLineLength === 'number') {
		clauses.push(`Wrap body lines at ${conventions.bodyLineLength} characters.`);
	}

	if (conventions.template?.trim()) {
		const trimmedTemplate = conventions.template.trim().slice(0, 1500);
		clauses.push(`Follow this commit-message template's structure (replace the placeholders with real content):\n\`\`\`\n${trimmedTemplate}\n\`\`\``);
	}

	if (conventions.recentCommits?.length) {
		const examples = conventions.recentCommits.slice(0, 15);
		const block = examples.map(s => `- ${s}`).join('\n');
		clauses.push(`Match the style, type vocabulary, and scope conventions of these recent commits from this repository:\n${block}`);
	}

	return clauses.join('\n');
}
