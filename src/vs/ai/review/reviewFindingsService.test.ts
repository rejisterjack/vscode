/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from 'bun:test';
import { ReviewFindingsService } from './reviewFindingsService.js';

describe('ReviewFindingsService', () => {
	const service = new ReviewFindingsService();

	test('parses JSON findings block', () => {
		const output = `Here are issues:\n\`\`\`json\n{"findings":[{"severity":"high","file":"src/a.ts","line":10,"message":"Null check missing"}]}\n\`\`\``;
		const findings = service.parseFindings(output);
		expect(findings).toHaveLength(1);
		expect(findings[0].severity).toBe('high');
		expect(findings[0].file).toBe('src/a.ts');
		expect(findings[0].line).toBe(10);
	});

	test('parses markdown severity lines', () => {
		const output = '- [medium] src/b.ts:5 - Unused import';
		const findings = service.parseFindings(output);
		expect(findings).toHaveLength(1);
		expect(findings[0].severity).toBe('medium');
		expect(findings[0].message).toContain('Unused import');
	});
});
