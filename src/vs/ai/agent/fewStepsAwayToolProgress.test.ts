import { describe, expect, test } from 'bun:test';
import { mapToolCallToProgress, mapToolResultToProgress } from '../../workbench/contrib/aiChat/browser/fewStepsAwayToolProgress.ts';
import type { ToolResult } from '../tool/toolTypes.ts';

describe('fewStepsAwayToolProgress', () => {
	test('mapToolCallToProgress creates in-progress simpleToolInvocation', () => {
		const progress = mapToolCallToProgress(
			{ type: 'tool-call', id: 'call-1', name: 'read', input: { filePath: 'src/a.ts' } },
			{ filePath: 'src/a.ts' },
		);
		expect(progress.kind).toBe('externalToolInvocationUpdate');
		expect(progress.isComplete).toBe(false);
		expect(progress.toolSpecificData?.kind).toBe('simpleToolInvocation');
	});

	test('mapToolResultToProgress marks validation failures', () => {
		const result: ToolResult = {
			title: 'Edit',
			output: 'reverted',
			validation: {
				ok: false,
				errorsBefore: 0,
				errorsAfter: 1,
				diagnostics: [{ line: 3, message: 'syntax error', severity: 'error' }],
				newDiagnostics: [{ line: 3, message: 'syntax error', severity: 'error' }],
			},
		};
		const progress = mapToolResultToProgress(
			{ type: 'tool-result', id: 'call-1', name: 'edit', result },
			{ filePath: 'src/a.ts' },
		);
		expect(progress.isComplete).toBe(true);
		expect(progress.errorMessage).toBeDefined();
		expect(progress.toolSpecificData?.output).toContain('Validation errors');
	});

	test('mapToolResultToProgress formats clickable diagnostic links', () => {
		const result: ToolResult = {
			title: 'Edit',
			output: 'reverted',
			metadata: { editContent: { filePath: '/workspace/src/a.ts', original: '', modified: '' } },
			validation: {
				ok: false,
				errorsBefore: 0,
				errorsAfter: 1,
				diagnostics: [{ line: 3, message: 'syntax error', severity: 'error' }],
				newDiagnostics: [{ line: 3, message: 'syntax error', severity: 'error' }],
			},
		};
		const progress = mapToolResultToProgress(
			{ type: 'tool-result', id: 'call-1', name: 'edit', result },
			{ filePath: 'src/a.ts' },
		);
		expect(progress.toolSpecificData?.output).toContain('[L3: syntax error]');
		expect(progress.toolSpecificData?.output).toContain('file:///workspace/src/a.ts');
	});
});
