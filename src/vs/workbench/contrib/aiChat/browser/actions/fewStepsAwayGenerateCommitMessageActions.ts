/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, MutableDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { IMenuEntryActionViewItemOptions, MenuEntryActionViewItem } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { Action2, MenuId, MenuItemAction, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { ContextKeyExpr, IContextKey, IContextKeyService, RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { ICommitMessageService } from '../../../../../ai/scm/commitMessageService.js';
import { detectCommitConventions } from '../../../../../ai/scm/commitConventions.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../common/contributions.js';
import { ISCMRepository, ISCMResource, ISCMService } from '../../../scm/common/scm.js';
import { Event } from '../../../../../base/common/event.js';

const FEWSTEPSAWAY_GENERATE_COMMIT_IN_PROGRESS_KEY = 'fewstepsaway.generateCommitInProgress';

export const FewStepsAwayCommitContextKeys = {
	InProgress: new RawContextKey<boolean>(FEWSTEPSAWAY_GENERATE_COMMIT_IN_PROGRESS_KEY, false),
} as const;

let generateCommitInProgressKey: IContextKey<boolean> | undefined;

function setGenerateCommitInProgress(inProgress: boolean): void {
	generateCommitInProgressKey?.set(inProgress);
}

/**
 * Read the text content for a URI via the text model service. Returns an empty
 * string for resources that cannot be resolved (e.g. deleted files).
 */
async function readTextContent(
	textModelService: ITextModelService,
	uri: URI | undefined,
): Promise<string> {
	if (!uri) {
		return '';
	}
	const ref = await textModelService.createModelReference(uri);
	try {
		return ref.object.textEditorModel.getValue();
	} finally {
		ref.dispose();
	}
}

/**
 * Build a unified-diff-style textual summary of the staged changes in a
 * repository. Prefers the `index` (staged) group; falls back to the working
 * tree if nothing is staged so the feature still does something useful.
 */
async function buildStagedDiffSummary(
	repository: ISCMRepository,
	textModelService: ITextModelService,
	token: CancellationToken,
): Promise<{ diff: string; sourceLabel: string }> {
	const groups = [...repository.provider.groups];

	// Prefer staged changes; fall back to the working tree if empty.
	const staged = groups.find(g => g.id === 'index' && g.resources.length > 0);
	const group = staged ?? groups.find(g => g.id === 'workingTree' && g.resources.length > 0)
		?? groups.find(g => g.resources.length > 0);
	if (!group || group.resources.length === 0) {
		return { diff: '', sourceLabel: '' };
	}

	const sourceLabel = group.id === 'index' ? 'staged changes' : 'working tree changes';
	const parts: string[] = [];

	for (const resource of group.resources) {
		if (token.isCancellationRequested) {
			break;
		}
		const original = resource.multiDiffEditorOriginalUri;
		const modified = resource.multiDiffEditorModifiedUri ?? resource.sourceUri;
		const originalText = await readTextContent(textModelService, original);
		const modifiedText = await readTextContent(textModelService, modified);
		const relativePath = formatResourcePath(resource);
		parts.push(formatFileDiff(relativePath, originalText, modifiedText));
	}

	return { diff: parts.filter(Boolean).join('\n\n'), sourceLabel };
}

function formatResourcePath(resource: ISCMResource): string {
	const fsPath = resource.sourceUri.fsPath;
	const segments = fsPath.split('/');
	return segments.slice(-2).join('/');
}

/**
 * Produce a unified-diff-style block for a single file. We compute a simple
 * line-level diff inline (set difference between original/modified lines).
 * This is intentionally lightweight: the model only needs to infer intent,
 * and we avoid awaiting the editor worker so the output stays deterministic
 * and cancellation-safe.
 */
function formatFileDiff(
	pathLabel: string,
	originalText: string,
	modifiedText: string,
): string {
	// Fast path: identical content.
	if (originalText === modifiedText) {
		return '';
	}

	const originalLines = originalText.split(/\r?\n/);
	const modifiedLines = modifiedText.split(/\r?\n/);

	// Cap the per-file output so a single giant change can't blow the budget.
	const maxLinesPerSide = 80;
	const removed = originalLines
		.filter(l => !modifiedLines.includes(l))
		.slice(0, maxLinesPerSide)
		.map(l => `- ${l}`);
	const added = modifiedLines
		.filter(l => !originalLines.includes(l))
		.slice(0, maxLinesPerSide)
		.map(l => `+ ${l}`);

	if (removed.length === 0 && added.length === 0) {
		return '';
	}

	const body = [...removed, ...added].join('\n');
	return `diff --git a/${pathLabel} b/${pathLabel}\n${body}`;
}

class GenerateCommitMessageActionViewItem extends MenuEntryActionViewItem {

	private readonly _iconClassDispose = this._register(new MutableDisposable());

	constructor(
		action: MenuItemAction,
		options: IMenuEntryActionViewItemOptions | undefined,
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
	) {
		super(action, options, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);

		this._register(this._contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(new Set([FEWSTEPSAWAY_GENERATE_COMMIT_IN_PROGRESS_KEY]))) {
				this._updateState();
			}
		}));
	}

	override render(container: HTMLElement): void {
		super.render(container);
		this._updateState();
	}

	override async onClick(event: MouseEvent): Promise<void> {
		if (this._isInProgress()) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		await super.onClick(event);
	}

	protected override updateClass(): void {
		if (!this.options.icon) {
			return;
		}

		this._iconClassDispose.value = undefined;
		const { label } = this;
		if (!label) {
			return;
		}

		const icon = this._isInProgress()
			? ThemeIcon.modify(Codicon.loading, 'spin')
			: Codicon.sparkle;
		const iconClasses = ThemeIcon.asClassNameArray(icon);
		label.classList.add(...iconClasses);
		this._iconClassDispose.value = toDisposable(() => label.classList.remove(...iconClasses));
	}

	protected override getTooltip(): string {
		if (this._isInProgress()) {
			return localize('fewstepsaway.scm.generateCommitMessage.generating', "Generating commit message…");
		}
		return super.getTooltip();
	}

	private _isInProgress(): boolean {
		return !!this._contextKeyService.getContextKeyValue<boolean>(FEWSTEPSAWAY_GENERATE_COMMIT_IN_PROGRESS_KEY);
	}

	private _updateState(): void {
		const inProgress = this._isInProgress();
		if (this.element) {
			this.element.classList.toggle('disabled', inProgress);
			this.element.setAttribute('aria-disabled', String(inProgress));
		}
		this.updateClass();
		this.updateTooltip();
	}
}

export class GenerateCommitMessageAction extends Action2 {
	static readonly ID = 'fewstepsaway.scm.generateCommitMessage';

	constructor() {
		super({
			id: GenerateCommitMessageAction.ID,
			title: localize2('fewstepsaway.scm.generateCommitMessage.label', "Generate Commit Message"),
			tooltip: localize('fewstepsaway.scm.generateCommitMessage.tooltip', "Generate commit message from staged changes"),
			f1: true,
			icon: Codicon.sparkle,
			precondition: ContextKeyExpr.and(
				FewStepsAwayCommitContextKeys.InProgress.negate(),
			),
			menu: {
				id: MenuId.SCMInputBox,
				group: 'navigation',
				order: 1,
				when: ContextKeyExpr.and(
					FewStepsAwayCommitContextKeys.InProgress.negate(),
					ContextKeyExpr.equals('scmProvider', 'git'),
				),
			},
		});
	}

	override async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {
		const scmService = accessor.get(ISCMService);
		const commitMessageService = accessor.get(ICommitMessageService);
		const textModelService = accessor.get(ITextModelService);
		const fileService = accessor.get(IFileService);
		const notificationService = accessor.get(INotificationService);
		const logService = accessor.get(ILogService);

		const rootUri = args[0] as URI | undefined;
		const repository = this.resolveRepository(scmService, rootUri);
		if (!repository) {
			notificationService.warn(localize(
				'fewstepsaway.scm.generateCommitMessage.noRepository',
				"Could not find a git repository. Open a folder containing a git repo and try again.",
			));
			return;
		}

		const cts = new CancellationTokenSource();

		setGenerateCommitInProgress(true);
		try {
			// Detect project commit conventions (commitlint, git template,
			// recent git-log style) in parallel with diff gathering so the
			// generated message respects the project's husky / commitlint gate.
			const [diffSummary, conventions] = await Promise.all([
				buildStagedDiffSummary(repository, textModelService, cts.token),
				detectCommitConventions(repository.provider.rootUri, fileService, cts.token),
			]);

			if (!diffSummary.diff.trim()) {
				notificationService.info(localize(
					'fewstepsaway.scm.generateCommitMessage.noChanges',
					"No staged changes found. Stage your changes first, then click ✨ to generate a commit message.",
				));
				return;
			}

			const message = await commitMessageService.generateFromDiff(diffSummary.diff, { conventions });
			const next = message.trim();
			if (!next) {
				throw new Error(localize(
					'fewstepsaway.scm.generateCommitMessage.emptyResult',
					"The AI returned an empty commit message. Check your provider API key and try again.",
				));
			}

			repository.input.setValue(next, false);
			repository.input.setFocus();
			logService.debug(`[GenerateCommitMessageAction] Generated commit message from ${diffSummary.sourceLabel}.`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logService.error('[GenerateCommitMessageAction] Failed to generate commit message:', err);
			notificationService.error(message);
		} finally {
			cts.dispose();
			setGenerateCommitInProgress(false);
		}
	}

	private resolveRepository(scmService: ISCMService, rootUri: URI | undefined): ISCMRepository | undefined {
		if (rootUri) {
			const match = [...scmService.repositories].find(r => r.provider.rootUri?.toString() === rootUri.toString());
			if (match) {
				return match;
			}
		}
		// Fall back to the first available repository.
		return [...scmService.repositories][0];
	}
}

class FewStepsAwayGenerateCommitRendering extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewStepsAwayGenerateCommitRendering';

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IActionViewItemService actionViewItemService: IActionViewItemService,
	) {
		super();

		generateCommitInProgressKey = FewStepsAwayCommitContextKeys.InProgress.bindTo(contextKeyService);

		const onStateChange = Event.filter(
			contextKeyService.onDidChangeContext,
			e => e.affectsSome(new Set([FEWSTEPSAWAY_GENERATE_COMMIT_IN_PROGRESS_KEY])),
		);

		this._register(actionViewItemService.register(
			MenuId.SCMInputBox,
			GenerateCommitMessageAction.ID,
			(action, options, instantiationService) => {
				if (action instanceof MenuItemAction) {
					return instantiationService.createInstance(GenerateCommitMessageActionViewItem, action, options);
				}
				return undefined;
			},
			onStateChange,
		));
	}
}

registerAction2(GenerateCommitMessageAction);

registerWorkbenchContribution2(
	FewStepsAwayGenerateCommitRendering.ID,
	FewStepsAwayGenerateCommitRendering,
	WorkbenchPhase.AfterRestored,
);
