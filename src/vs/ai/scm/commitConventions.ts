/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../base/common/uri.js';
import { CancellationToken } from '../../base/common/cancellation.js';
import { parse as parseJsonc } from '../../base/common/jsonc.js';
import { IFileService } from '../../platform/files/common/files.js';

/**
 * The commit conventions detected for a repository. Every field is optional;
 * the commit-message generator only enforces the fields that are present, and
 * falls back to the base Conventional Commits spec otherwise.
 *
 * Fields are populated by {@link detectCommitConventions} in priority order:
 * commitlint config > package.json keys > git template > recent git log >
 * monorepo scope scan.
 */
export interface CommitConventions {
	/** Allowed Conventional Commit types (e.g. feat, fix, build). */
	readonly allowedTypes?: string[];
	/** Allowed/known scopes, derived from commitlint, recent history, and monorepo dirs. */
	readonly allowedScopes?: string[];
	/** Max subject-line length in characters. commitlint default is 100. */
	readonly headerMaxLength?: number;
	/** Max body line length in characters. commitlint default is 100. */
	readonly bodyLineLength?: number;
	/** Required subject case. commitlint default is 'lower'. */
	readonly subjectCase?: 'lower' | 'upper' | 'sentence';
	/** Whether the subject must not end with a period. Defaults to true. */
	readonly noTrailingPeriod?: boolean;
	/** Raw git commit template body (`.gitmessage` / `commit.template`). */
	readonly template?: string;
	/** Recent commit subjects, used as in-context style examples. */
	readonly recentCommits: string[];
}

/**
 * The Conventional Commit types that `@commitlint/config-conventional` enables
 * by default. Used when a config file `extends` that preset but does not
 * override `type-enum`.
 */
const CONVENTIONAL_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];

/** Mapping of common commitlint `extends` presets to their type lists. */
const PRESET_TYPES: Record<string, string[]> = {
	'@commitlint/config-conventional': CONVENTIONAL_TYPES,
	'@commitlint/config-angular': ['build', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'test'],
	'@commitlint/config-lerna-scoped': CONVENTIONAL_TYPES,
	'@commitlint/config-patternplate': ['feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'revert', 'break'],
};

/**
 * Detect the commit conventions in force for the repository at `rootUri`.
 *
 * Reads only files via {@link IFileService} - no child-process spawning and no
 * git extension API - mirroring the pattern used in
 * `src/vs/workbench/contrib/chat/browser/chatRepoInfo.ts` for reading `.git/`
 * files. Every step is guarded so a malformed file or a missing `.git/logs/HEAD`
 * (e.g. worktrees where `.git` is a file) just falls back to the next source.
 *
 * @param rootUri The repository root URI (from `ISCMProvider.rootUri`).
 * @param fileService File service used to read config and log files.
 */
export async function detectCommitConventions(
	rootUri: URI | undefined,
	fileService: IFileService,
	token?: CancellationToken,
): Promise<CommitConventions> {
	if (!rootUri) {
		return { recentCommits: [] };
	}

	let allowedTypes: string[] | undefined;
	let allowedScopes: string[] | undefined;
	let headerMaxLength: number | undefined;
	let bodyLineLength: number | undefined;
	let subjectCase: 'lower' | 'upper' | 'sentence' | undefined;
	let noTrailingPeriod: boolean | undefined;

	// 1. commitlint config (JSON / JSONC / YAML, plus best-effort JS extraction).
	const commitlint = await readCommitlintConfig(rootUri, fileService, token);
	if (commitlint) {
		if (commitlint.extendsPresets?.length) {
			for (const preset of commitlint.extendsPresets) {
				const presetTypes = PRESET_TYPES[preset];
				if (presetTypes && !allowedTypes) {
					allowedTypes = presetTypes;
				}
			}
		}
		if (commitlint.typeEnum?.length) { allowedTypes = commitlint.typeEnum; }
		if (commitlint.scopeEnum?.length) { allowedScopes = [...commitlint.scopeEnum]; }
		if (typeof commitlint.headerMaxLength === 'number') { headerMaxLength = commitlint.headerMaxLength; }
		if (typeof commitlint.bodyMaxLineLength === 'number') { bodyLineLength = commitlint.bodyMaxLineLength; }
		if (commitlint.subjectCase) { subjectCase = commitlint.subjectCase; }
		if (typeof commitlint.subjectFullStopNever === 'boolean') { noTrailingPeriod = commitlint.subjectFullStopNever; }
	}

	// 2. package.json commitlint / commitizen keys (override file-based ones).
	const pkg = await readPackageJsonCommitConfig(rootUri, fileService, token);
	if (pkg) {
		if (pkg.typeEnum?.length) { allowedTypes = pkg.typeEnum; }
		if (pkg.scopeEnum?.length) { allowedScopes = [...pkg.scopeEnum]; }
		if (typeof pkg.headerMaxLength === 'number') { headerMaxLength = pkg.headerMaxLength; }
		if (typeof pkg.bodyMaxLineLength === 'number') { bodyLineLength = pkg.bodyMaxLineLength; }
	}

	// 3. git commit template (`.gitmessage`).
	const template = await readGitMessageTemplate(rootUri, fileService, token);

	// 4. Recent git-log subjects (always collected as a style signal).
	const recentCommits = await readRecentCommitSubjects(rootUri, fileService, token);

	// Harvest scopes from recent history if none were declared.
	if (!allowedScopes && recentCommits.length) {
		const scopes = collectScopes(recentCommits);
		if (scopes.length) { allowedScopes = scopes; }
	}

	// 5. Monorepo scope candidates (append-only).
	const monorepoScopes = await readMonorepoScopes(rootUri, fileService, token);
	if (monorepoScopes.length) {
		const merged = new Set<string>([...(allowedScopes ?? []), ...monorepoScopes]);
		allowedScopes = [...merged];
	}

	return {
		allowedTypes,
		allowedScopes,
		headerMaxLength,
		bodyLineLength,
		subjectCase,
		noTrailingPeriod,
		template,
		recentCommits,
	};
}

// --- commitlint -------------------------------------------------------------

interface ParsedCommitlintConfig {
	extendsPresets?: string[];
	typeEnum?: string[];
	scopeEnum?: string[];
	headerMaxLength?: number;
	bodyMaxLineLength?: number;
	subjectCase?: 'lower' | 'upper' | 'sentence';
	subjectFullStopNever?: boolean;
}

async function readCommitlintConfig(
	rootUri: URI,
	fileService: IFileService,
	token?: CancellationToken,
): Promise<ParsedCommitlintConfig | undefined> {
	// JSON / JSONC forms.
	for (const name of ['.commitlintrc.json', '.commitlintrc.jsonc', '.commitlintrc.yml', '.commitlintrc.yaml']) {
		if (token?.isCancellationRequested) { return undefined; }
		const uri = rootUri.with({ path: `${rootUri.path}/${name}` });
		const text = await readTextIfExists(fileService, uri);
		if (!text) { continue; }
		const parsed = name.endsWith('.yml') || name.endsWith('.yaml')
			? undefined // YAML parsing is not available in base; treat as unsupported.
			: safeParseJsonc(text);
		if (parsed) {
			return parseCommitlintObject(parsed);
		}
	}

	// JS forms: best-effort regex extraction (we cannot execute the module).
	for (const name of ['commitlint.config.js', 'commitlint.config.cjs', 'commitlint.config.mjs', 'commitlint.config.ts']) {
		if (token?.isCancellationRequested) { return undefined; }
		const uri = rootUri.with({ path: `${rootUri.path}/${name}` });
		const text = await readTextIfExists(fileService, uri);
		if (text) {
			return extractCommitlintFromJs(text);
		}
	}
	return undefined;
}

function parseCommitlintObject(raw: unknown): ParsedCommitlintConfig {
	if (!raw || typeof raw !== 'object') { return {}; }
	const obj = raw as Record<string, unknown>;
	const result: ParsedCommitlintConfig = {};

	const ext = obj['extends'];
	if (Array.isArray(ext)) {
		result.extendsPresets = ext.filter((s): s is string => typeof s === 'string');
	} else if (typeof ext === 'string') {
		result.extendsPresets = [ext];
	}

	const rules = obj['rules'];
	if (rules && typeof rules === 'object') {
		const r = rules as Record<string, unknown>;
		const typeEnum = parseRuleEnum(r['type-enum']);
		if (typeEnum) { result.typeEnum = typeEnum; }
		const scopeEnum = parseRuleEnum(r['scope-enum']);
		if (scopeEnum) { result.scopeEnum = scopeEnum; }
		const headerMax = parseRuleLength(r['header-max-length']);
		if (typeof headerMax === 'number') { result.headerMaxLength = headerMax; }
		const bodyMax = parseRuleLength(r['body-max-line-length']);
		if (typeof bodyMax === 'number') { result.bodyMaxLineLength = bodyMax; }
		const sCase = parseRuleCase(r['subject-case']);
		if (sCase) { result.subjectCase = sCase; }
		const fullStop = parseRuleFullStop(r['subject-full-stop']);
		if (typeof fullStop === 'boolean') { result.subjectFullStopNever = fullStop; }
	}

	return result;
}

/** commitlint rule value shape: `[severity, condition, value]`. */
function parseRuleEnum(rule: unknown): string[] | undefined {
	const arr = asRuleValueArray(rule);
	const value = arr?.[2];
	if (Array.isArray(value)) {
		const filtered = value.filter((s): s is string => typeof s === 'string');
		if (filtered.length) { return filtered; }
	}
	return undefined;
}

function parseRuleLength(rule: unknown): number | undefined {
	const arr = asRuleValueArray(rule);
	const value = arr?.[2];
	if (typeof value === 'number') { return value; }
	if (typeof value === 'string') {
		const n = parseInt(value, 10);
		if (!Number.isNaN(n)) { return n; }
	}
	return undefined;
}

function parseRuleCase(rule: unknown): 'lower' | 'upper' | 'sentence' | undefined {
	const arr = asRuleValueArray(rule);
	const value = arr?.[2];
	if (Array.isArray(value) && value.length) {
		const first = String(value[0]).toLowerCase();
		if (first === 'lower-case') { return 'lower'; }
		if (first === 'upper-case') { return 'upper'; }
		if (first === 'sentence-case') { return 'sentence'; }
	}
	return undefined;
}

function parseRuleFullStop(rule: unknown): boolean | undefined {
	const arr = asRuleValueArray(rule);
	if (!arr) { return undefined; }
	// `[severity, 'never', '.']` means "no trailing period" → true.
	if (arr[1] === 'never') { return true; }
	if (arr[1] === 'always') { return false; }
	return undefined;
}

function asRuleValueArray(rule: unknown): readonly [unknown, unknown, unknown] | undefined {
	if (Array.isArray(rule) && rule.length >= 2) {
		return [rule[0], rule[1], rule[2]] as const;
	}
	return undefined;
}

/**
 * Best-effort extraction of commitlint settings from a JS config source.
 * We don't execute the module; we look for the common literal patterns.
 */
function extractCommitlintFromJs(source: string): ParsedCommitlintConfig {
	const result: ParsedCommitlintConfig = {};

	const extendsMatch = source.match(/extends\s*:\s*\[([^\]]*)\]/);
	if (extendsMatch) {
		result.extendsPresets = extendsMatch[1]
			.split(',')
			.map(s => s.trim().replace(/['"`]/g, ''))
			.filter(Boolean);
	}

	const typeEnumMatch = source.match(/['"`]?type-enum['"`]?\s*:\s*\[([^\]]*)\]/);
	if (typeEnumMatch) {
		const condition = typeEnumMatch[1];
		const valuesMatch = condition.match(/\[[^\]]*\]/);
		if (valuesMatch) {
			result.typeEnum = valuesMatch[0]
				.replace(/[[\]]/g, '')
				.split(',')
				.map(s => s.trim().replace(/['"`]/g, ''))
				.filter(Boolean);
		}
	}

	const scopeEnumMatch = source.match(/['"`]?scope-enum['"`]?\s*:\s*\[([^\]]*)\]/);
	if (scopeEnumMatch) {
		const condition = scopeEnumMatch[1];
		const valuesMatch = condition.match(/\[[^\]]*\]/);
		if (valuesMatch) {
			result.scopeEnum = valuesMatch[0]
				.replace(/[[\]]/g, '')
				.split(',')
				.map(s => s.trim().replace(/['"`]/g, ''))
				.filter(Boolean);
		}
	}

	const headerMaxMatch = source.match(/['"`]?header-max-length['"`]?\s*:\s*\[\s*[^,]+,\s*[^,]+,\s*(\d+)\s*\]/);
	if (headerMaxMatch) {
		result.headerMaxLength = parseInt(headerMaxMatch[1], 10);
	}

	const bodyMaxMatch = source.match(/['"`]?body-max-line-length['"`]?\s*:\s*\[\s*[^,]+,\s*[^,]+,\s*(\d+)\s*\]/);
	if (bodyMaxMatch) {
		result.bodyMaxLineLength = parseInt(bodyMaxMatch[1], 10);
	}

	return result;
}

// --- package.json -----------------------------------------------------------

async function readPackageJsonCommitConfig(
	rootUri: URI,
	fileService: IFileService,
	token?: CancellationToken,
): Promise<ParsedCommitlintConfig | undefined> {
	if (token?.isCancellationRequested) { return undefined; }
	const uri = rootUri.with({ path: `${rootUri.path}/package.json` });
	const text = await readTextIfExists(fileService, uri);
	if (!text) { return undefined; }
	const pkg = safeParseJsonc(text);
	if (!pkg || typeof pkg !== 'object') { return undefined; }

	// `commitlint` key at top level (supported by commitlint when in package.json).
	const commitlint = (pkg as Record<string, unknown>)['commitlint'];
	if (commitlint && typeof commitlint === 'object') {
		const parsed = parseCommitlintObject(commitlint);
		if (Object.keys(parsed).length) { return parsed; }
	}
	return undefined;
}

// --- git commit template ----------------------------------------------------

async function readGitMessageTemplate(
	rootUri: URI,
	fileService: IFileService,
	token?: CancellationToken,
): Promise<string | undefined> {
	const candidates = [
		rootUri.with({ path: `${rootUri.path}/.gitmessage` }),
		rootUri.with({ path: `${rootUri.path}/.git/.gitmessage` }),
	];
	for (const uri of candidates) {
		if (token?.isCancellationRequested) { return undefined; }
		const text = await readTextIfExists(fileService, uri);
		if (text) { return text; }
	}
	return undefined;
}

// --- recent git log ---------------------------------------------------------

async function readRecentCommitSubjects(
	rootUri: URI,
	fileService: IFileService,
	token?: CancellationToken,
): Promise<string[]> {
	const uri = rootUri.with({ path: `${rootUri.path}/.git/logs/HEAD` });
	const text = await readTextIfExists(fileService, uri);
	if (!text) { return []; }

	// `.git/logs/HEAD` format (tab-separated):
	//   <old-sha> <new-sha> <actor> <ts> <tz>\t<message>
	// Commit messages look like "commit: <subject>" or "commit (merge): <subject>".
	const subjects: string[] = [];
	const lines = text.split(/\r?\n/);
	for (const line of lines) {
		if (token?.isCancellationRequested) { break; }
		const tabIdx = line.indexOf('\t');
		if (tabIdx < 0) { continue; }
		const message = line.slice(tabIdx + 1);
		const match = message.match(/^commit(?:\s+\([^)]+\))?:\s+(.+)$/);
		if (match) {
			subjects.push(match[1].trim());
		}
	}
	// Most-recent last → keep the most recent ones.
	return subjects.slice(-15).reverse();
}

function collectScopes(subjects: string[]): string[] {
	const scopes = new Set<string>();
	for (const subject of subjects) {
		const match = subject.match(/^[a-z]+\(([^)]+)\)/);
		if (match) {
			// A scope may itself contain slashes (monorepo path); keep as-is.
			scopes.add(match[1]);
		}
	}
	return [...scopes];
}

// --- monorepo scope scan ----------------------------------------------------

async function readMonorepoScopes(
	rootUri: URI,
	fileService: IFileService,
	token?: CancellationToken,
): Promise<string[]> {
	const scopes = new Set<string>();
	for (const dir of ['packages', 'apps', 'libs', 'modules']) {
		if (token?.isCancellationRequested) { break; }
		const dirUri = rootUri.with({ path: `${rootUri.path}/${dir}` });
		try {
			const stat = await fileService.resolve(dirUri);
			if (stat.children) {
				for (const child of stat.children) {
					if (child.isDirectory) {
						scopes.add(child.name);
					}
				}
			}
		} catch {
			// Directory doesn't exist or isn't readable - skip.
		}
	}
	return [...scopes];
}

// --- shared helpers ---------------------------------------------------------

async function readTextIfExists(fileService: IFileService, uri: URI): Promise<string | undefined> {
	try {
		const exists = await fileService.exists(uri);
		if (!exists) { return undefined; }
		const content = await fileService.readFile(uri);
		return content.value.toString();
	} catch {
		return undefined;
	}
}

function safeParseJsonc(text: string): unknown | undefined {
	try {
		return parseJsonc(text);
	} catch {
		return undefined;
	}
}
