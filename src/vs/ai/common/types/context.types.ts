/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { CodeContext, ContextOptions, ContextChange, FileContext, EditContext } from './ai.types.js';
import { Event } from '../../../base/common/event.js';
import { IDisposable } from '../../../base/common/lifecycle.js';

/**
 * Context management types for FewStepAway
 */

/**
 * Context manager interface
 */
export interface IContextManager extends IDisposable {
	/**
	 * Gather code context based on options
	 */
	gatherContext(options?: ContextOptions): Promise<CodeContext>;

	/**
	 * Get current file context
	 */
	getCurrentFileContext(): Promise<FileContext | undefined>;

	/**
	 * Get open files context
	 */
	getOpenFilesContext(): Promise<FileContext[]>;

	/**
	 * Get recent edits
	 */
	getRecentEdits(): Promise<EditContext[]>;

	/**
	 * Get project structure
	 */
	getProjectStructure(): Promise<ProjectStructure | undefined>;

	/**
	 * Event fired when context changes
	 */
	onContextChanged: Event<ContextChange>;

	/**
	 * Update context with a specific change
	 */
	updateContext(change: ContextChange): void;

	/**
	 * Get current selection context
	 */
	getSelectionContext(): Promise<SelectionContext | undefined>;

	/**
	 * Estimate tokens in context
	 */
	estimateContextTokens(context: CodeContext): number;

	/**
	 * Prioritize context to fit token budget
	 */
	prioritizeContext(context: CodeContext, maxTokens: number): CodeContext;
}

/**
 * Project structure information
 */
export interface ProjectStructure {
	/** Root directory path */
	rootPath: string;
	/** Project name */
	name: string;
	/** List of source files */
	sourceFiles: string[];
	/** Project dependencies */
	dependencies: DependencyInfo[];
	/** Detected framework */
	framework?: FrameworkInfo;
	/** Git repository info */
	git?: GitInfo;
}

/**
 * Dependency information
 */
export interface DependencyInfo {
	/** Dependency name */
	name: string;
	/** Version */
	version?: string;
	/** Dependency type */
	type: 'production' | 'development' | 'peer';
}

/**
 * Framework information
 */
export interface FrameworkInfo {
	/** Framework name */
	name: string;
	/** Framework version */
	version?: string;
	/** Framework type */
	type: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'other';
}

/**
 * Git information
 */
export interface GitInfo {
	/** Remote URL */
	remoteUrl?: string;
	/** Current branch */
	branch: string;
	/** Recent commits */
	recentCommits: CommitInfo[];
}

/**
 * Commit information
 */
export interface CommitInfo {
	/** Commit hash */
	hash: string;
	/** Commit message */
	message: string;
	/** Author */
	author: string;
	/** Timestamp */
	timestamp: number;
}

/**
 * Selection context
 */
export interface SelectionContext {
	/** Selected text */
	text: string;
	/** File path */
	filePath: string;
	/** Start position */
	startLine: number;
	/** End position */
	endLine: number;
	/** Surrounding context lines */
	surroundingContext: string;
}

/**
 * Context builder interface
 */
export interface IContextBuilder {
	/**
	 * Build context for a specific purpose
	 */
	buildContext(purpose: ContextPurpose, options?: BuildOptions): Promise<CodeContext>;

	/**
	 * Add custom context source
	 */
	addContextSource(source: IContextSource): IDisposable;

	/**
	 * Remove context source
	 */
	removeContextSource(sourceId: string): void;
}

/**
 * Context purpose
 */
export type ContextPurpose =
	| 'inline-completion'
	| 'chat-message'
	| 'refactoring'
	| 'debug-analysis'
	| 'search-query'
	| 'code-explanation';

/**
 * Build options
 */
export interface BuildOptions {
	/** Maximum tokens */
	maxTokens?: number;
	/** Specific files to include */
	includeFiles?: string[];
	/** Files to exclude */
	excludeFiles?: string[];
	/** Include git diff */
	includeGitDiff?: boolean;
	/** Custom priority rules */
	priorityRules?: PriorityRule[];
}

/**
 * Priority rule for context items
 */
export interface PriorityRule {
	/** Pattern to match */
	pattern: RegExp;
	/** Priority level */
	priority: number;
}

/**
 * Context source interface
 */
export interface IContextSource {
	/** Source identifier */
	id: string;
	/** Source name */
	name: string;
	/**
	 * Provide context contribution
	 */
	provideContext(): Promise<ContextContribution>;
}

/**
 * Context contribution
 */
export interface ContextContribution {
	/** Files to include */
	files?: FileContext[];
	/** Text snippets */
	snippets?: string[];
	/** Metadata */
	metadata?: Record<string, unknown>;
	/** Priority (higher = more important) */
	priority: number;
}

/**
 * File tracker interface
 */
export interface IFileTracker extends IDisposable {
	/**
	 * Track a file
	 */
	trackFile(filePath: string): void;

	/**
	 * Stop tracking a file
	 */
	untrackFile(filePath: string): void;

	/**
	 * Get tracked files
	 */
	getTrackedFiles(): string[];

	/**
	 * Get recent changes for a file
	 */
	getRecentChanges(filePath: string): FileChange[];

	/**
	 * Event fired when a file changes
	 */
	onFileChanged: Event<FileChangeEvent>;
}

/**
 * File change
 */
export interface FileChange {
	/** Change type */
	type: 'added' | 'modified' | 'deleted';
	/** Timestamp */
	timestamp: number;
	/** Change description */
	description?: string;
}

/**
 * File change event
 */
export interface FileChangeEvent {
	/** File path */
	filePath: string;
	/** Change type */
	type: 'added' | 'modified' | 'deleted';
	/** Change details */
	details?: unknown;
}

/**
 * Git integration interface
 */
export interface IGitIntegration {
	/**
	 * Get current branch
	 */
	getCurrentBranch(): Promise<string | undefined>;

	/**
	 * Get recent commits
	 */
	getRecentCommits(count?: number): Promise<CommitInfo[]>;

	/**
	 * Get current diff
	 */
	getCurrentDiff(): Promise<string | undefined>;

	/**
	 * Get modified files
	 */
	getModifiedFiles(): Promise<string[]>;

	/**
	 * Check if file is ignored
	 */
	isIgnored(filePath: string): Promise<boolean>;
}

/**
 * Token budget calculator
 */
export interface ITokenBudgetCalculator {
	/**
	 * Calculate available tokens for context
	 */
	calculateBudget(requestTokens: number): number;

	/**
	 * Estimate tokens for text
	 */
	estimateTokens(text: string): number;

	/**
	 * Get current usage
	 */
	getCurrentUsage(): TokenUsage;
}

/**
 * Token usage
 */
export interface TokenUsage {
	/** Input tokens used */
	inputTokens: number;
	/** Output tokens used */
	outputTokens: number;
	/** Context tokens used */
	contextTokens: number;
	/** Remaining budget */
	remainingBudget: number;
}
