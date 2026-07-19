import { describe, expect, test } from 'bun:test';
import { claimsEditWithoutTool, enrichValidationResult } from './agentLoopValidation.ts';
import type { ToolResult } from '../tool/toolTypes.ts';

describe('agentLoop validation', () => {
	test('claimsEditWithoutTool detects edit claims without tools', () => {
		expect(claimsEditWithoutTool("I've updated the file for you.")).toBe(true);
		expect(claimsEditWithoutTool('Here is an explanation of the code.')).toBe(false);
	});

	test('enrichValidationResult appends diagnostic guidance', () => {
		const result: ToolResult = {
			title: 'Edit foo.ts',
			output: 'Edited foo.ts',
			validation: {
				ok: false,
				errorsBefore: 0,
				errorsAfter: 1,
				diagnostics: [{ line: 10, message: 'Type error', severity: 'error' }],
			},
		};
		const enriched = enrichValidationResult(result, 'edit', 0, 2);
		expect(String(enriched.output)).toContain('EDIT FAILED VALIDATION');
		expect(String(enriched.output)).toContain('line 10');
	});

	test('enrichValidationResult prefers newDiagnostics', () => {
		const result: ToolResult = {
			title: 'Edit foo.ts',
			output: 'Edited foo.ts',
			validation: {
				ok: false,
				errorsBefore: 1,
				errorsAfter: 2,
				diagnostics: [
					{ line: 1, message: 'old', severity: 'error' },
					{ line: 10, message: 'Type error', severity: 'error' },
				],
				newDiagnostics: [{ line: 10, message: 'Type error', severity: 'error' }],
			},
		};
		const enriched = enrichValidationResult(result, 'edit', 0, 2);
		expect(String(enriched.output)).toContain('line 10: Type error');
		expect(String(enriched.output)).not.toContain('line 1: old');
	});

	test('enrichValidationResult stops after max attempts', () => {
		const result: ToolResult = {
			title: 'Edit foo.ts',
			output: 'Edited foo.ts',
			validation: {
				ok: false,
				errorsBefore: 0,
				errorsAfter: 1,
				diagnostics: [{ line: 1, message: 'err', severity: 'error' }],
			},
		};
		const enriched = enrichValidationResult(result, 'edit', 2, 2);
		expect(String(enriched.output)).toContain('AUTO-FIX LIMIT REACHED');
		expect(String(enriched.output)).not.toContain('EDIT FAILED VALIDATION');
	});
});
