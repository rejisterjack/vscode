/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parse as parseGlob } from '../../base/common/glob.js';

/**
 * The verdict for a tool invocation.
 */
export type PermissionVerdict = 'allow' | 'ask' | 'deny';

/**
 * A permission rule: a glob pattern matched against the tool id (and
 * optionally the file path argument) with a verdict.
 *
 * Port of the glob-based permission system in
 * `references/kilocode/packages/opencode/src/kilocode/agent/index.ts:17-211`.
 */
export interface PermissionRule {
	/** Glob pattern matching the tool id (e.g. "bash", "read", "*"). */
	readonly tool: string;
	/** The verdict when this rule matches. */
	readonly verdict: PermissionVerdict;
	/** Optional glob pattern matching the file-path argument (for read/write/edit). */
	readonly pathPattern?: string;
	/** Optional glob pattern matching the bash command (for the bash tool). */
	readonly commandPattern?: string;
}

/**
 * A permission ruleset: an ordered list of rules plus a default verdict.
 * Rules are evaluated in order; the first match wins.
 */
export interface PermissionRuleset {
	readonly rules: readonly PermissionRule[];
	readonly default: PermissionVerdict;
}

/**
 * Evaluate a permission ruleset for a given tool invocation.
 *
 * @param ruleset The ruleset to evaluate.
 * @param toolId The tool id (e.g. "read", "bash").
 * @param args The tool arguments (used to extract file paths and commands).
 * @returns The verdict, or `undefined` to fall through to the default.
 */
export function evaluatePermission(
	ruleset: PermissionRuleset,
	toolId: string,
	args: Record<string, unknown>
): PermissionVerdict {
	const filePath = typeof args.filePath === 'string' ? args.filePath : '';
	const command = typeof args.command === 'string' ? args.command : '';

	for (const rule of ruleset.rules) {
		if (!matchesTool(rule, toolId)) { continue; }
		if (rule.pathPattern && filePath) {
			const pathMatcher = parseGlob(rule.pathPattern, { ignoreCase: process.platform === 'win32' });
			if (!pathMatcher(filePath)) { continue; }
		}
		if (rule.commandPattern && command) {
			const cmdMatcher = parseGlob(rule.commandPattern);
			if (!cmdMatcher(command)) { continue; }
		}
		return rule.verdict;
	}
	return ruleset.default;
}

function matchesTool(rule: PermissionRule, toolId: string): boolean {
	if (rule.tool === '*') { return true; }
	const matcher = parseGlob(rule.tool);
	return matcher(toolId);
}

// --- Built-in rulesets ----------------------------------------------------

/**
 * The "code" mode ruleset: everything allowed except `.env` files (ask) and
 * dangerous bash commands (ask). Port of the default ruleset in
 * `references/kilocode/packages/opencode/src/kilocode/agent/index.ts:17-57`.
 */
export const codeRuleset: PermissionRuleset = {
	rules: [
		{ tool: 'read', verdict: 'allow' },
		{ tool: 'write', verdict: 'deny', pathPattern: '**/.env*' },
		{ tool: 'edit', verdict: 'deny', pathPattern: '**/.env*' },
		{ tool: 'apply_patch', verdict: 'deny', pathPattern: '**/.env*' },
		{ tool: 'bash', verdict: 'allow' },
		{ tool: 'glob', verdict: 'allow' },
		{ tool: 'grep', verdict: 'allow' },
		{ tool: 'webfetch', verdict: 'allow' },
		{ tool: 'websearch', verdict: 'allow' },
		{ tool: 'todo', verdict: 'allow' },
		{ tool: 'question', verdict: 'allow' },
	],
	default: 'allow'
};

/**
 * A read-only bash command allowlist for `ask` and `plan` modes. Port of
 * `readOnlyBash` in
 * `references/kilocode/packages/opencode/src/kilocode/agent/index.ts:59-129`.
 */
const readOnlyBashAllowlist = [
	'cat', 'head', 'tail', 'less', 'more', 'wc', 'nl',
	'ls', 'find', 'tree', 'stat', 'file', 'du', 'df',
	'grep', 'rg', 'ag', 'ack', 'fgrep', 'egrep',
	'git status', 'git log', 'git diff', 'git show', 'git branch', 'git remote',
	'echo', 'printf', 'pwd', 'whoami', 'hostname', 'date', 'cal',
	'env', 'printenv', 'which', 'whereis', 'type',
	'node --version', 'npm list', 'npm view', 'npm outdated'
];

/**
 * Check if a bash command is read-only (in the allowlist).
 */
export function isReadOnlyBash(command: string): boolean {
	const trimmed = command.trim();
	// Reject redirects, pipes, and command substitution (write operations).
	if (/[><|]|`|\$\(/.test(trimmed)) { return false; }
	const firstWord = trimmed.split(/\s+/)[0];
	return readOnlyBashAllowlist.some(allowed => {
		const allowedFirst = allowed.split(/\s+/)[0];
		return firstWord === allowedFirst;
	});
}

/**
 * The "ask" mode ruleset: read-only Q&A. Port of `askGuard` in
 * `references/kilocode/packages/opencode/src/kilocode/agent/index.ts:131-155`.
 */
export const askRuleset: PermissionRuleset = {
	rules: [
		{ tool: '*', verdict: 'deny' },
		{ tool: 'read', verdict: 'allow' },
		{ tool: 'glob', verdict: 'allow' },
		{ tool: 'grep', verdict: 'allow' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'cat *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'head *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'tail *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'ls *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'find *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'grep *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'rg *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'git status *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'git log *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'git diff *' },
		{ tool: 'webfetch', verdict: 'allow' },
		{ tool: 'websearch', verdict: 'allow' },
		{ tool: 'write', verdict: 'deny' },
		{ tool: 'edit', verdict: 'deny' },
		{ tool: 'apply_patch', verdict: 'deny' },
	],
	default: 'deny'
};

/**
 * The "plan" mode ruleset: read-only, but can edit plan files. Port of
 * `planGuard` in
 * `references/kilocode/packages/opencode/src/kilocode/agent/index.ts:183-211`.
 */
export const planRuleset: PermissionRuleset = {
	rules: [
		{ tool: '*', verdict: 'deny' },
		{ tool: 'read', verdict: 'allow' },
		{ tool: 'glob', verdict: 'allow' },
		{ tool: 'grep', verdict: 'allow' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'cat *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'ls *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'find *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'grep *' },
		{ tool: 'bash', verdict: 'allow', commandPattern: 'rg *' },
		{ tool: 'webfetch', verdict: 'allow' },
		{ tool: 'websearch', verdict: 'allow' },
		{ tool: 'question', verdict: 'allow' },
		{ tool: 'todo', verdict: 'allow' },
		{ tool: 'write', verdict: 'allow', pathPattern: '**/.cursor/plans/*' },
		{ tool: 'write', verdict: 'allow', pathPattern: '**/plans/*' },
		{ tool: 'write', verdict: 'allow', pathPattern: '**/.plans/*' },
		{ tool: 'edit', verdict: 'allow', pathPattern: '**/.cursor/plans/*' },
		{ tool: 'edit', verdict: 'allow', pathPattern: '**/plans/*' },
		{ tool: 'edit', verdict: 'allow', pathPattern: '**/.plans/*' },
		{ tool: 'apply_patch', verdict: 'allow', pathPattern: '**/.cursor/plans/*' },
		{ tool: 'apply_patch', verdict: 'allow', pathPattern: '**/plans/*' },
		{ tool: 'apply_patch', verdict: 'allow', pathPattern: '**/.plans/*' },
		{ tool: 'apply_patch', verdict: 'deny', pathPattern: '**/.env*' },
	],
	default: 'deny'
};

/**
 * The "architect" mode ruleset: like plan mode -- read-only, produces design
 * documents.
 */
export const architectRuleset: PermissionRuleset = planRuleset;

/**
 * The "debug" mode ruleset: full tool access (like code mode) -- debugging
 * requires running code and inspecting state.
 */
export const debugRuleset: PermissionRuleset = codeRuleset;

/**
 * The "review" mode ruleset: read-only change review (Bugbot-style).
 */
export const reviewRuleset: PermissionRuleset = askRuleset;
