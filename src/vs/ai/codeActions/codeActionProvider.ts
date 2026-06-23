/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../base/common/cancellation.js';
import { CodeActionProvider, CodeAction, CodeActionContext, CodeActionList } from '../../editor/common/languages.js';
import { ITextModel } from '../../editor/common/model.js';
import { Range } from '../../editor/common/core/range.js';
import { IMarkerService } from '../../platform/markers/common/markers.js';
import { CodeActionKind } from '../../editor/contrib/codeAction/common/types.js';
import { SupportPromptType } from './supportPrompts.js';

/**
 * Code action provider that adds "Explain/Fix/Improve/Add with FewStepsAway"
 * actions to the editor context menu and quick-fix menu.
 */
export class FewStepsAwayCodeActionProvider implements CodeActionProvider {
	private static readonly PROVIDED_ACTIONS: Array<{
		readonly kind: string;
		readonly title: string;
		readonly type: SupportPromptType;
		readonly requiresDiagnostics?: boolean;
	}> = [
			{ kind: CodeActionKind.RefactorRewrite.value, title: 'Add to FewStepsAway', type: 'ADD_TO_CONTEXT' },
			{ kind: CodeActionKind.QuickFix.value, title: 'Fix with FewStepsAway', type: 'FIX', requiresDiagnostics: true },
			{ kind: CodeActionKind.RefactorRewrite.value, title: 'Explain with FewStepsAway', type: 'EXPLAIN', requiresDiagnostics: false },
			{ kind: CodeActionKind.RefactorRewrite.value, title: 'Improve with FewStepsAway', type: 'IMPROVE', requiresDiagnostics: false }
		];

	constructor(
		@IMarkerService private readonly markerService: IMarkerService
	) { }

	provideCodeActions(model: ITextModel, range: Range, context: CodeActionContext, _token: CancellationToken): CodeActionList {
		const hasSelection = range.startLineNumber !== range.endLineNumber || range.startColumn !== range.endColumn;
		if (!hasSelection) {
			return { actions: [], dispose: () => { } };
		}

		const diagnostics = this.getDiagnostics(model, range);
		const hasDiagnostics = diagnostics.length > 0;

		const actions: CodeAction[] = [];
		for (const action of FewStepsAwayCodeActionProvider.PROVIDED_ACTIONS) {
			if (action.requiresDiagnostics && !hasDiagnostics) { continue; }
			actions.push({
				title: action.title,
				kind: action.kind,
				command: {
					id: `fewstepsaway.codeAction.${action.type.toLowerCase()}`,
					title: action.title,
					arguments: [model.uri.fsPath, range.startLineNumber, range.endLineNumber]
				},
				isPreferred: action.kind === CodeActionKind.QuickFix.value
			});
		}
		return { actions, dispose: () => { } };
	}

	private getDiagnostics(model: ITextModel, range: Range): string {
		const markers = this.markerService.read({
			resource: model.uri,
			severities: 1 /* MarkerSeverity.Error */ | 2 /* Warning */
		});
		const inRange = markers.filter(m =>
			m.startLineNumber >= range.startLineNumber &&
			m.endLineNumber <= range.endLineNumber
		);
		return inRange
			.map(m => `Line ${m.startLineNumber}: ${m.message} (${m.source ?? 'diagnostic'})`)
			.join('\n');
	}
}
