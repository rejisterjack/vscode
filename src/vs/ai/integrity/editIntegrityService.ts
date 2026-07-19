/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { URI } from '../../base/common/uri.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { ITextFileService } from '../../workbench/services/textfile/common/textfiles.js';
import { IMarkerService, MarkerSeverity, IMarker } from '../../platform/markers/common/markers.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IFileService } from '../../platform/files/common/files.js';
import { DisposableStore } from '../../base/common/lifecycle.js';
import { stringHash } from '../../base/common/hash.js';
import {
	EditDiagnostic,
	EditSnapshot,
	EditValidationResult,
	SafeWriteOptions,
} from './editIntegrityTypes.js';
import { WorkspaceUriResolver } from './workspaceUriResolver.js';

export { AmbiguousWorkspacePathError } from './workspaceUriResolver.js';

export const IEditIntegrityService = createDecorator<IEditIntegrityService>('ai.editIntegrityService');

export interface IEditIntegrityService {
	readonly _serviceBrand: undefined;

	resolveWorkspaceUri(filePath: string): URI;
	resolveWorkspaceUriAsync(filePath: string): Promise<URI>;
	computeContentHash(content: string): string;
	readFileContent(uri: URI): Promise<string>;
	snapshot(uri: URI): Promise<EditSnapshot>;
	preApply(uri: URI, newContent: string, previousContent?: string): Promise<void>;
	safeWrite(uri: URI, content: string, options?: SafeWriteOptions): Promise<EditValidationResult | undefined>;
	waitForDiagnostics(uri: URI, timeoutMs?: number): Promise<readonly EditDiagnostic[]>;
	postApply(before: EditSnapshot, afterDiagnostics?: readonly EditDiagnostic[]): EditValidationResult;
	revert(snapshot: EditSnapshot): Promise<void>;
	formatValidationMessage(result: EditValidationResult, uri: URI): string;
	shouldAutoRevert(composerStaged: boolean): boolean;
}

const EDIT_TOOLS = new Set(['edit', 'write', 'apply_patch']);

export function isEditTool(toolId: string): boolean {
	return EDIT_TOOLS.has(toolId);
}

export class EditIntegrityService implements IEditIntegrityService {
	declare readonly _serviceBrand: undefined;

	private readonly uriResolver: WorkspaceUriResolver;

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IMarkerService private readonly markerService: IMarkerService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IFileService private readonly fileService: IFileService,
	) {
		this.uriResolver = new WorkspaceUriResolver(workspaceService, fileService);
	}

	resolveWorkspaceUri(filePath: string): URI {
		return this.uriResolver.resolveSync(filePath);
	}

	async resolveWorkspaceUriAsync(filePath: string): Promise<URI> {
		return this.uriResolver.resolve(filePath);
	}

	computeContentHash(content: string): string {
		return String(stringHash(content, 0));
	}

	async readFileContent(uri: URI): Promise<string> {
		const content = await this.textFileService.read(uri);
		return content.value;
	}

	async snapshot(uri: URI): Promise<EditSnapshot> {
		let content = '';
		try {
			content = await this.readFileContent(uri);
		} catch {
			content = '';
		}
		const diagnostics = this.getDiagnostics(uri);
		return {
			uri,
			content,
			errorsBefore: countSeverity(diagnostics, 'error'),
			warningsBefore: countSeverity(diagnostics, 'warning'),
			diagnosticsBefore: diagnostics,
		};
	}

	async preApply(uri: URI, newContent: string, previousContent?: string): Promise<void> {
		if (previousContent !== undefined && previousContent.length > 0 && newContent.length === 0) {
			throw new Error(`Refusing to overwrite non-empty file with empty content: ${uri.fsPath}`);
		}
		try {
			await this.fileService.stat(uri);
		} catch {
			// new file — allowed
		}
	}

	async safeWrite(uri: URI, content: string, options?: SafeWriteOptions): Promise<EditValidationResult | undefined> {
		const validate = this.configurationService.getValue<boolean>('ai.edit.validateAfterApply') ?? true;
		const before = await this.snapshot(uri);
		await this.preApply(uri, content, before.content);
		await this.textFileService.write(uri, content);

		if (!validate || options?.skipValidation) {
			return undefined;
		}

		const waitMs = this.configurationService.getValue<number>('ai.edit.diagnosticWaitMs') ?? 600;
		const afterDiagnostics = await this.waitForDiagnostics(uri, waitMs);
		const result = this.postApply(before, afterDiagnostics);

		const autoRevert = this.shouldAutoRevert(options?.composerStaged ?? false);
		if (!result.ok && autoRevert) {
			await this.revert(before);
		}

		return result;
	}

	async waitForDiagnostics(uri: URI, timeoutMs?: number): Promise<readonly EditDiagnostic[]> {
		const hardTimeout = timeoutMs ?? this.configurationService.getValue<number>('ai.edit.diagnosticWaitMs') ?? 600;
		const debounceMs = 100;

		return new Promise<readonly EditDiagnostic[]>((resolve) => {
			const store = new DisposableStore();
			let debounceTimer: ReturnType<typeof setTimeout> | undefined;
			let settled = false;

			const finish = () => {
				if (settled) {
					return;
				}
				settled = true;
				store.dispose();
				if (debounceTimer !== undefined) {
					clearTimeout(debounceTimer);
				}
				resolve(this.getDiagnostics(uri));
			};

			store.add(this.markerService.onMarkerChanged(changedUris => {
				if (!changedUris.some(u => u.toString() === uri.toString())) {
					return;
				}
				if (debounceTimer !== undefined) {
					clearTimeout(debounceTimer);
				}
				debounceTimer = setTimeout(finish, debounceMs);
			}));

			setTimeout(finish, hardTimeout);
		});
	}

	postApply(before: EditSnapshot, afterDiagnostics?: readonly EditDiagnostic[]): EditValidationResult {
		const diagnostics = afterDiagnostics ?? this.getDiagnostics(before.uri);
		const errorsAfter = countSeverity(diagnostics, 'error');
		const warningsAfter = countSeverity(diagnostics, 'warning');
		const newDiagnostics = computeDiagnosticDelta(before.diagnosticsBefore, diagnostics);
		const ok = !newDiagnostics.some(d => d.severity === 'error');
		return {
			ok,
			errorsBefore: before.errorsBefore,
			errorsAfter,
			warningsBefore: before.warningsBefore,
			warningsAfter,
			diagnostics,
			newDiagnostics,
		};
	}

	async revert(snapshot: EditSnapshot): Promise<void> {
		await this.textFileService.write(snapshot.uri, snapshot.content);
	}

	formatValidationMessage(result: EditValidationResult, uri: URI): string {
		if (result.ok) {
			return `Validation passed for ${uri.fsPath} (errors: ${result.errorsBefore} → ${result.errorsAfter}).`;
		}
		const lines = [
			`EDIT FAILED VALIDATION for ${uri.fsPath} — fix these errors before continuing:`,
			`Errors: ${result.errorsBefore} → ${result.errorsAfter}`,
		];
		for (const d of result.newDiagnostics.slice(0, 20)) {
			lines.push(`- ${uri.fsPath}:${d.line}: [${d.severity}] ${d.message}`);
		}
		if (result.newDiagnostics.length > 20) {
			lines.push(`... and ${result.newDiagnostics.length - 20} more`);
		}
		return lines.join('\n');
	}

	shouldAutoRevert(composerStaged: boolean): boolean {
		if (composerStaged) {
			return false;
		}
		return this.configurationService.getValue<boolean>('ai.edit.autoRevertOnNewErrors') ?? true;
	}

	private getDiagnostics(uri: URI): EditDiagnostic[] {
		const markers = this.markerService.read({ resource: uri });
		return markers.map(m => markerToDiagnostic(m));
	}
}

function markerToDiagnostic(marker: IMarker): EditDiagnostic {
	let severity: EditDiagnostic['severity'] = 'info';
	if (marker.severity === MarkerSeverity.Error) {
		severity = 'error';
	} else if (marker.severity === MarkerSeverity.Warning) {
		severity = 'warning';
	} else if (marker.severity === MarkerSeverity.Hint) {
		severity = 'hint';
	}
	return {
		line: marker.startLineNumber,
		message: marker.message,
		severity,
	};
}

function countSeverity(diagnostics: readonly EditDiagnostic[], severity: EditDiagnostic['severity']): number {
	return diagnostics.filter(d => d.severity === severity).length;
}

function diagnosticKey(d: EditDiagnostic): string {
	return `${d.line}|${d.severity}|${d.message}`;
}

function computeDiagnosticDelta(
	before: readonly EditDiagnostic[],
	after: readonly EditDiagnostic[],
): EditDiagnostic[] {
	const beforeKeys = new Set(before.map(diagnosticKey));
	return after.filter(d => !beforeKeys.has(diagnosticKey(d)));
}

registerSingleton(IEditIntegrityService, EditIntegrityService, InstantiationType.Delayed);
