/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Tokenization utilities for AI context management
 * 
 * Provides approximate token counting for various text types.
 * Note: This is an estimation - actual token counts depend on the
 * specific tokenizer used by each AI provider.
 */

/**
 * Estimate token count for a given text
 * Rough approximation: 1 token ≈ 4 characters for English text
 */
export function estimateTokens(text: string): number {
	if (!text || text.length === 0) {
		return 0;
	}

	// Base estimation: 4 characters per token
	const baseEstimate = Math.ceil(text.length / 4);

	// Adjust for code (typically more tokens per character due to symbols)
	const codeAdjustment = estimateCodeDensity(text);

	return Math.ceil(baseEstimate * codeAdjustment);
}

/**
 * Estimate tokens for multiple text segments
 */
export function estimateTokensBatch(texts: string[]): number {
	return texts.reduce((total, text) => total + estimateTokens(text), 0);
}

/**
 * Estimate if text is code-heavy and adjust token count
 */
function estimateCodeDensity(text: string): number {
	// Code typically has more tokens per character due to:
	// - punctuation being separate tokens
	// - symbols being separate tokens
	// - identifiers being split

	const codeIndicators = [
		/{/g, /}/g, /\(/g, /\)/g, /;/g, /=>/g,
		/function/g, /const/g, /let/g, /var/g,
		/import/g, /export/g, /class/g
	];

	let indicatorCount = 0;
	for (const indicator of codeIndicators) {
		const matches = text.match(indicator);
		if (matches) {
			indicatorCount += matches.length;
		}
	}

	// If high density of code indicators, increase token estimate
	const density = indicatorCount / (text.length / 100);
	if (density > 5) {
		return 1.3; // Code-heavy: ~30% more tokens
	} else if (density > 2) {
		return 1.15; // Mixed: ~15% more tokens
	}

	return 1.0; // Normal text
}

/**
 * Truncate text to fit within a token budget
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
	const estimatedTokens = estimateTokens(text);

	if (estimatedTokens <= maxTokens) {
		return text;
	}

	// Approximate characters to keep
	const charsToKeep = Math.floor((maxTokens * 4) * 0.9); // 10% safety margin

	if (charsToKeep >= text.length) {
		return text;
	}

	// Try to truncate at a natural boundary
	const truncated = text.substring(0, charsToKeep);
	const lastNewline = truncated.lastIndexOf('\n');

	if (lastNewline > charsToKeep * 0.8) {
		// Truncate at last newline if it's not too far back
		return truncated.substring(0, lastNewline) + '\n\n... [truncated]';
	}

	return truncated + '\n... [truncated]';
}

/**
 * Truncate multiple text segments to fit within a combined token budget
 * Priority: earlier items in the array are higher priority
 */
export function truncateBatchToBudget(texts: string[], maxTokens: number): string[] {
	const result: string[] = [];
	let remainingBudget = maxTokens;

	for (const text of texts) {
		if (remainingBudget <= 0) {
			result.push('');
			continue;
		}

		const truncated = truncateToTokenBudget(text, remainingBudget);
		const tokensUsed = estimateTokens(truncated);

		result.push(truncated);
		remainingBudget -= tokensUsed;
	}

	return result;
}

/**
 * Get token budget breakdown for a context
 */
export interface TokenBudgetBreakdown {
	totalBudget: number;
	usedTokens: number;
	remainingTokens: number;
	breakdown: {
		currentFile: number;
		openFiles: number;
		recentEdits: number;
		projectStructure: number;
		buffer: number;
	};
}

/**
 * Calculate token budget breakdown
 */
export function calculateTokenBudget(
	currentFileContent: string,
	openFilesContent: string[],
	recentEditsContent: string[],
	projectStructureContent: string,
	totalBudget: number
): TokenBudgetBreakdown {
	// Reserve 20% for response
	const availableBudget = Math.floor(totalBudget * 0.8);

	const currentFileTokens = estimateTokens(currentFileContent);
	const openFilesTokens = estimateTokensBatch(openFilesContent);
	const recentEditsTokens = estimateTokensBatch(recentEditsContent);
	const projectStructureTokens = estimateTokens(projectStructureContent);

	// Reserve 10% buffer for prompt template
	const buffer = Math.floor(availableBudget * 0.1);

	const usedTokens = currentFileTokens + openFilesTokens + recentEditsTokens + projectStructureTokens;

	return {
		totalBudget,
		usedTokens,
		remainingTokens: availableBudget - usedTokens - buffer,
		breakdown: {
			currentFile: currentFileTokens,
			openFiles: openFilesTokens,
			recentEdits: recentEditsTokens,
			projectStructure: projectStructureTokens,
			buffer
		}
	};
}

/**
 * Format token count for display
 */
export function formatTokenCount(count: number): string {
	if (count >= 1000000) {
		return `${(count / 1000000).toFixed(1)}M`;
	}
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1)}k`;
	}
	return count.toString();
}

/**
 * Check if text fits within token budget
 */
export function fitsInBudget(text: string, maxTokens: number): boolean {
	return estimateTokens(text) <= maxTokens;
}

/**
 * Split text into chunks that fit within token budget
 */
export function splitIntoChunks(text: string, maxTokensPerChunk: number): string[] {
	const chunks: string[] = [];
	const lines = text.split('\n');
	let currentChunk = '';

	for (const line of lines) {
		const testChunk = currentChunk ? currentChunk + '\n' + line : line;

		if (estimateTokens(testChunk) > maxTokensPerChunk) {
			if (currentChunk) {
				chunks.push(currentChunk);
			}
			currentChunk = line;
		} else {
			currentChunk = testChunk;
		}
	}

	if (currentChunk) {
		chunks.push(currentChunk);
	}

	return chunks;
}
