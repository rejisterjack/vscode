import { describe, expect, test } from 'bun:test';
import { URI } from '../../base/common/uri.js';
import { Emitter } from '../../base/common/event.js';
import { MarkerSeverity } from '../../platform/markers/common/markers.js';
import { EditIntegrityService } from '../integrity/editIntegrityService.js';
import type { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import type { ITextFileService } from '../../workbench/services/textfile/common/textfiles.js';
import type { IMarkerService } from '../../platform/markers/common/markers.js';
import type { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import type { IFileService } from '../../platform/files/common/files.js';

function createService(workspaceFolders: URI[]): EditIntegrityService {
	const workspaceService = {
		getWorkspace: () => ({ folders: workspaceFolders.map(uri => ({ uri, name: uri.path, index: 0, toResource: (p: string) => URI.joinPath(uri, p) })) }),
	} as unknown as IWorkspaceContextService;
	const config = { getValue: () => undefined } as unknown as IConfigurationService;
	return new EditIntegrityService(
		workspaceService,
		{} as ITextFileService,
		{ read: () => [] } as unknown as IMarkerService,
		config,
		{} as IFileService,
	);
}

describe('EditIntegrityService', () => {
	test('resolveWorkspaceUri resolves relative paths against workspace', () => {
		const service = createService([URI.file('/workspace')]);
		const uri = service.resolveWorkspaceUri('src/foo.ts');
		expect(uri.fsPath).toBe('/workspace/src/foo.ts');
	});

	test('resolveWorkspaceUri keeps absolute paths', () => {
		const service = createService([URI.file('/workspace')]);
		const uri = service.resolveWorkspaceUri('/absolute/foo.ts');
		expect(uri.fsPath).toBe('/absolute/foo.ts');
	});

	test('computeContentHash is stable for identical content', () => {
		const service = createService([URI.file('/workspace')]);
		expect(service.computeContentHash('hello')).toBe(service.computeContentHash('hello'));
		expect(service.computeContentHash('hello')).not.toBe(service.computeContentHash('world'));
	});

	test('postApply passes when error count does not increase', async () => {
		const service = createService([URI.file('/workspace')]);
		const before = await service.snapshot(URI.file('/workspace/a.ts'));
		const existing = [{ line: 1, message: 'existing', severity: 'error' as const }];
		const result = service.postApply(
			{ ...before, errorsBefore: 1, warningsBefore: 0, diagnosticsBefore: existing },
			existing,
		);
		expect(result.ok).toBe(true);
		expect(result.errorsAfter).toBe(1);
		expect(result.newDiagnostics).toHaveLength(0);
	});

	test('postApply fails when new errors appear', async () => {
		const service = createService([URI.file('/workspace')]);
		const before = await service.snapshot(URI.file('/workspace/a.ts'));
		const result = service.postApply(
			{ ...before, errorsBefore: 0, warningsBefore: 0, diagnosticsBefore: [] },
			[{ line: 2, message: 'type error', severity: 'error' }],
		);
		expect(result.ok).toBe(false);
		expect(result.errorsAfter).toBe(1);
		expect(result.newDiagnostics).toHaveLength(1);
	});

	test('postApply delta ignores pre-existing diagnostics', async () => {
		const service = createService([URI.file('/workspace')]);
		const before = await service.snapshot(URI.file('/workspace/a.ts'));
		const existing = [{ line: 1, message: 'existing', severity: 'error' as const }];
		const after = [
			...existing,
			{ line: 5, message: 'new error', severity: 'error' as const },
		];
		const result = service.postApply(
			{ ...before, errorsBefore: 1, warningsBefore: 0, diagnosticsBefore: existing },
			after,
		);
		expect(result.ok).toBe(false);
		expect(result.newDiagnostics).toHaveLength(1);
		expect(result.newDiagnostics[0]?.line).toBe(5);
	});

	test('waitForDiagnostics resolves after marker updates', async () => {
		const uri = URI.file('/workspace/a.ts');
		const markerChanged = new Emitter<readonly URI[]>();
		let readCount = 0;
		const markerService = {
			onMarkerChanged: markerChanged.event,
			read: () => {
				readCount++;
				if (readCount >= 2) {
					return [{ startLineNumber: 4, message: 'new error', severity: MarkerSeverity.Error }];
				}
				return [];
			},
		};
		const textFileService = {
			read: async () => ({ value: 'before' }),
			write: async () => { },
		};
		const config = {
			getValue: (key: string) => {
				if (key === 'ai.edit.validateAfterApply') { return true; }
				if (key === 'ai.edit.diagnosticWaitMs') { return 500; }
				if (key === 'ai.edit.autoRevertOnNewErrors') { return false; }
				return undefined;
			},
		};
		const service = new EditIntegrityService(
			{
				getWorkspace: () => ({
					folders: [{ uri: URI.file('/workspace'), name: 'workspace', index: 0, toResource: (p: string) => URI.joinPath(URI.file('/workspace'), p) }],
				}),
			} as never,
			textFileService as never,
			markerService as never,
			config as never,
			{} as never,
		);

		const validationPromise = service.safeWrite(uri, 'after');
		setTimeout(() => markerChanged.fire([uri]), 20);
		const validation = await validationPromise;
		expect(validation?.ok).toBe(false);
		expect(validation?.newDiagnostics).toHaveLength(1);
	});
});
