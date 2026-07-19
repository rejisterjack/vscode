/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';

export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ReviewFinding {
	readonly severity: ReviewSeverity;
	readonly file?: string;
	readonly line?: number;
	readonly message: string;
}

export const IReviewFindingsService = createDecorator<IReviewFindingsService>('ai.reviewFindingsService');

export interface IReviewFindingsService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	parseFindings(output: string): ReviewFinding[];
	setFindings(findings: readonly ReviewFinding[]): void;
	getFindings(): readonly ReviewFinding[];
	clearFindings(): void;
}

const SEVERITIES: readonly ReviewSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

function normalizeSeverity(value: unknown): ReviewSeverity {
	if (typeof value === 'string') {
		const lower = value.toLowerCase() as ReviewSeverity;
		if (SEVERITIES.includes(lower)) {
			return lower;
		}
	}
	return 'info';
}

export class ReviewFindingsService extends Disposable implements IReviewFindingsService {
	declare readonly _serviceBrand: undefined;

	private findings: ReviewFinding[] = [];
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	parseFindings(output: string): ReviewFinding[] {
		const fromJson = this.parseJsonBlock(output);
		if (fromJson.length > 0) {
			return fromJson;
		}
		return this.parseMarkdown(output);
	}

	setFindings(findings: readonly ReviewFinding[]): void {
		this.findings = [...findings];
		this._onDidChange.fire();
	}

	getFindings(): readonly ReviewFinding[] {
		return this.findings;
	}

	clearFindings(): void {
		this.findings = [];
		this._onDidChange.fire();
	}

	private parseJsonBlock(output: string): ReviewFinding[] {
		const jsonMatch = output.match(/```json\s*([\s\S]*?)```/i);
		const candidates = jsonMatch ? [jsonMatch[1]] : [output];
		for (const candidate of candidates) {
			try {
				const parsed = JSON.parse(candidate.trim()) as { findings?: unknown };
				if (!Array.isArray(parsed.findings)) {
					continue;
				}
				return parsed.findings
					.map(item => this.toFinding(item))
					.filter((f): f is ReviewFinding => !!f);
			} catch {
				// try next candidate
			}
		}
		return [];
	}

	private toFinding(item: unknown): ReviewFinding | undefined {
		if (!item || typeof item !== 'object') {
			return undefined;
		}
		const record = item as Record<string, unknown>;
		const message = typeof record.message === 'string' ? record.message.trim() : '';
		if (!message) {
			return undefined;
		}
		return {
			severity: normalizeSeverity(record.severity),
			file: typeof record.file === 'string' ? record.file : undefined,
			line: typeof record.line === 'number' ? record.line : undefined,
			message,
		};
	}

	private parseMarkdown(output: string): ReviewFinding[] {
		const findings: ReviewFinding[] = [];
		const linePattern = /^\s*(?:[-*]|\d+\.)\s*(?:\*\*)?\[?(critical|high|medium|low|info)\]?(?:\*\*)?[:\s-]+(?:`?([^`:]+?)`?(?::(\d+))?)?\s*-?\s*(.+)$/gim;
		let match: RegExpExecArray | null;
		while ((match = linePattern.exec(output)) !== null) {
			const [, severity, file, line, message] = match;
			findings.push({
				severity: normalizeSeverity(severity),
				file: file?.trim() || undefined,
				line: line ? parseInt(line, 10) : undefined,
				message: message.trim(),
			});
		}
		return findings;
	}
}

registerSingleton(IReviewFindingsService, ReviewFindingsService, InstantiationType.Delayed);
