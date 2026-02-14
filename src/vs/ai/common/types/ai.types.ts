/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Position, Range } from '../../../editor/common/core/position.js';

/**
 * Core AI types for FewStepAway - AI Native Code Editor
 */

/**
 * AI operating modes
 */
export type AIMode = 'coding' | 'architect' | 'debug' | 'learning';

/**
 * AI request context containing all necessary information for an AI request
 */
export interface AIRequestContext {
	/** Unique identifier for the request */
	requestId?: string;
	/** User query or prompt */
	query: string;
	/** Optional code context */
	contextData?: CodeContext;
	/** AI operating mode */
	mode: AIMode;
	/** Specific model to use */
	model?: string;
	/** Temperature for response generation */
	temperature?: number;
	/** Maximum tokens to generate */
	maxTokens?: number;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * AI response structure
 */
export interface AIResponse {
	/** Generated content */
	content: string;
	/** Total tokens used */
	tokensUsed: number;
	/** Input tokens consumed */
	inputTokens?: number;
	/** Output tokens consumed */
	outputTokens?: number;
	/** Provider that generated the response */
	provider: string;
	/** Model used */
	model: string;
	/** Response latency in milliseconds */
	latency: number;
	/** Finish reason */
	finishReason: string;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Streaming response chunk
 */
export interface AIResponseChunk {
	/** Content chunk */
	content: string;
	/** Whether this is the final chunk */
	isComplete: boolean;
	/** Optional metadata for this chunk */
	metadata?: {
		tokensUsed?: number;
		finishReason?: string;
	};
}

/**
 * Code context for AI requests
 */
export interface CodeContext {
	/** Currently active file */
	currentFile?: FileContext;
	/** Other open files */
	openFiles?: FileContext[];
	/** Recent edits */
	recentEdits?: EditContext[];
	/** Project structure info */
	projectStructure?: ProjectContext;
	/** Current text selection */
	selection?: SelectionContext;
	/** Git context */
	gitContext?: GitContext;
}

/**
 * File context information
 */
export interface FileContext {
	/** File path */
	path: string;
	/** File content */
	content: string;
	/** Programming language */
	language: string;
	/** Cursor position if applicable */
	cursorPosition?: Position;
}

/**
 * Edit context for tracking recent changes
 */
export interface EditContext {
	/** File path */
	filePath: string;
	/** Change description */
	change: string;
	/** Timestamp */
	timestamp: number;
	/** Lines affected */
	range?: Range;
}

/**
 * Project structure context
 */
export interface ProjectContext {
	/** Root path */
	rootPath: string;
	/** List of source files */
	files: string[];
	/** Dependencies */
	dependencies?: string[];
	/** Framework detection */
	framework?: string;
}

/**
 * Selection context
 */
export interface SelectionContext {
	/** Selected text */
	text: string;
	/** Selection range */
	range: Range;
	/** Surrounding context */
	surroundingLines?: string;
}

/**
 * Git context
 */
export interface GitContext {
	/** Current branch */
	branch?: string;
	/** Recent commits */
	recentCommits?: string[];
	/** Current diff */
	currentDiff?: string;
	/** Modified files */
	modifiedFiles?: string[];
}

/**
 * Context gathering options
 */
export interface ContextOptions {
	/** Maximum tokens to include in context */
	maxTokens?: number;
	/** Include open files */
	includeOpenFiles?: boolean;
	/** Include recent edits */
	includeRecentEdits?: boolean;
	/** Include project structure */
	includeProjectStructure?: boolean;
	/** Include git context */
	includeGitContext?: boolean;
	/** Target files to prioritize */
	targetFiles?: string[];
}

/**
 * Context change event
 */
export interface ContextChange {
	/** Type of change */
	type: 'activeEditorChanged' | 'filesChanged' | 'selectionChanged' | 'gitChanged';
	/** Change details */
	changes?: unknown;
}

/**
 * AI mode configuration
 */
export interface ModeConfig {
	/** System prompt for the mode */
	systemPrompt: string;
	/** Temperature setting */
	temperature: number;
	/** Maximum tokens */
	maxTokens: number;
	/** Context window size */
	contextWindow: number;
	/** Available tools */
	tools: ToolDefinition[];
	/** Response format preference */
	responseFormat: 'text' | 'code' | 'structured';
}

/**
 * Tool definition for AI modes
 */
export interface ToolDefinition {
	/** Tool identifier */
	id: string;
	/** Tool name */
	name: string;
	/** Tool description */
	description: string;
	/** Tool parameters schema */
	parameters?: Record<string, unknown>;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
	/** Supports streaming responses */
	supportsStreaming: boolean;
	/** Supports system messages */
	supportsSystemMessages: boolean;
	/** Supports function calling */
	supportsFunctionCalling: boolean;
	/** Maximum context length in tokens */
	maxContextLength: number;
	/** Supported AI modes */
	supportedModes: AIMode[];
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
	/** Provider identifier */
	providerId: string;
	/** API key */
	apiKey?: string;
	/** Custom endpoint URL */
	endpoint?: string;
	/** Default model */
	defaultModel: string;
	/** Custom models list */
	customModels?: string[];
	/** Rate limiting config */
	rateLimits?: {
		requestsPerMinute: number;
		tokensPerDay: number;
	};
	/** Whether provider is enabled */
	enabled: boolean;
}

/**
 * AI event map for cross-service communication
 */
export interface AIEventMap {
	// Provider events
	'ai:provider:changed': { oldProvider: string; newProvider: string };
	'ai:provider:error': { provider: string; error: Error };
	'ai:provider:rate-limited': { provider: string; retryAfter: number };

	// Request/Response events
	'ai:request:started': { requestId: string; context: AIRequestContext };
	'ai:request:completed': { requestId: string; response: AIResponse };
	'ai:request:failed': { requestId: string; error: Error };
	'ai:request:cancelled': { requestId: string };

	// Context events
	'ai:context:changed': { change: ContextChange };
	'ai:context:updated': { context: CodeContext };

	// Completion events
	'ai:completion:requested': { position: Position };
	'ai:completion:provided': { items: unknown[] };
	'ai:completion:accepted': { item: unknown };
	'ai:completion:rejected': { item: unknown };
}

/**
 * Privacy settings
 */
export interface PrivacySettings {
	/** Local-only mode - no external AI calls */
	localOnly: boolean;
	/** Block sensitive files from being sent */
	blockSensitiveFiles: boolean;
	/** Enable PII detection and filtering */
	filterPII: boolean;
	/** Opt-in for anonymous telemetry */
	anonymousTelemetry: boolean;
}

/**
 * AI error types
 */
export enum AIErrorCode {
	RATE_LIMIT = 'RATE_LIMIT',
	INVALID_API_KEY = 'INVALID_API_KEY',
	NETWORK_ERROR = 'NETWORK_ERROR',
	TIMEOUT = 'TIMEOUT',
	INVALID_REQUEST = 'INVALID_REQUEST',
	PROVIDER_ERROR = 'PROVIDER_ERROR',
	CONTEXT_TOO_LARGE = 'CONTEXT_TOO_LARGE',
	UNKNOWN = 'UNKNOWN'
}

/**
 * Base AI error
 */
export class AIError extends Error {
	constructor(
		message: string,
		public readonly code: AIErrorCode,
		public readonly provider?: string,
		public readonly retryable: boolean = false
	) {
		super(message);
		this.name = 'AIError';
	}
}
