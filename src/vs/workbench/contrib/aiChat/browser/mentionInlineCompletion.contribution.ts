/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { localize } from '../../../../nls.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Range } from '../../../../editor/common/core/range.js';
import { CompletionItemKind, CompletionItemProvider } from '../../../../editor/common/languages.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';

const MENTION_KINDS = [
	{ label: '@file:', insertText: '@file:', detail: localize('fewstepsaway.mention.file', "Attach a workspace file") },
	{ label: '@folder:', insertText: '@folder:', detail: localize('fewstepsaway.mention.folder', "List folder contents") },
	{ label: '@symbol:', insertText: '@symbol:', detail: localize('fewstepsaway.mention.symbol', "Find symbol (path#Name)") },
	{ label: '@codebase', insertText: '@codebase', detail: localize('fewstepsaway.mention.codebase', "Semantic codebase search") },
	{ label: '@git:status', insertText: '@git:status', detail: localize('fewstepsaway.mention.gitStatus', "Git working tree status") },
	{ label: '@git:diff', insertText: '@git:diff', detail: localize('fewstepsaway.mention.gitDiff', "Git unstaged diff") },
	{ label: '@commit:', insertText: '@commit:', detail: localize('fewstepsaway.mention.commit', "Show commit details") },
	{ label: '@branch:', insertText: '@branch:', detail: localize('fewstepsaway.mention.branch', "List matching branches") },
	{ label: '@selection', insertText: '@selection', detail: localize('fewstepsaway.mention.selection', "Current editor selection") },
	{ label: '@web:', insertText: '@web:', detail: localize('fewstepsaway.mention.web', "Web search query") },
	{ label: '@terminal', insertText: '@terminal', detail: localize('fewstepsaway.mention.terminal', "Terminal output") },
];

class MentionInlineCompletionContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.fewstepsaway.mentionInlineCompletion';

	constructor(
		@ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super();

		const provider: CompletionItemProvider = {
			_debugDisplayName: 'fewstepsawayMentions',
			triggerCharacters: ['@'],
			provideCompletionItems: (model, position) => {
				const line = model.getLineContent(position.lineNumber);
				const textBefore = line.substring(0, position.column - 1);
				const atMatch = textBefore.match(/@([\w:]*)$/);
				if (!atMatch) {
					return undefined;
				}
				const prefix = atMatch[1] ?? '';
				const replaceRange = new Range(position.lineNumber, position.column - atMatch[0].length, position.lineNumber, position.column);

				const suggestions = MENTION_KINDS
					.filter(kind => kind.label.toLowerCase().includes(prefix.toLowerCase()) || prefix === '')
					.map(kind => ({
						label: kind.label,
						kind: CompletionItemKind.Keyword,
						insertText: kind.insertText,
						detail: kind.detail,
						range: replaceRange,
					}));

				for (const folder of this.workspaceContextService.getWorkspace().folders) {
					const rel = folder.name;
					if (rel.toLowerCase().includes(prefix.toLowerCase()) || prefix === '') {
						suggestions.push({
							label: `@${rel}`,
							kind: CompletionItemKind.File,
							insertText: `@${rel}`,
							detail: folder.uri.fsPath,
							range: replaceRange,
						});
					}
				}

				return { suggestions };
			},
		};

		this._register(this.languageFeaturesService.completionProvider.register(
			{ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true },
			provider,
		));
	}
}

registerWorkbenchContribution2(MentionInlineCompletionContribution.ID, MentionInlineCompletionContribution, WorkbenchPhase.AfterRestored);
