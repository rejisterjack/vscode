/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEditIntegrityService } from '../../../../ai/integrity/editIntegrityService.js';
import { IComposerService } from '../../../../ai/composer/composerTypes.js';
import { IWorkspaceTaskRunner } from '../../../../ai/integrity/workspaceTaskRunner.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { Severity } from '../../../../platform/notification/common/notification.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { FewStepsAwayChatViewId } from './aiChatIds.js';
import { ComposerDock } from './components/composerDock.js';
import { getChatEditingBridge } from './agentChatEditingBridge.js';
import { getFewStepsAwaySessionResource, sendFewStepsAwayMessage } from './fewStepsAwayChatUtils.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../../../nls.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ComposerFileEdit } from '../../../../ai/composer/composerTypes.js';

class ComposerOverlayContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewstepsaway.composerOverlay';

	private composerDock: ComposerDock | undefined;

	constructor(
		@IViewsService private readonly viewsService: IViewsService,
		@IComposerService private readonly composerService: IComposerService,
		@IEditIntegrityService private readonly editIntegrity: IEditIntegrityService,
		@IDialogService private readonly dialogService: IDialogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkspaceTaskRunner private readonly workspaceTaskRunner: IWorkspaceTaskRunner,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IModelService private readonly modelService: IModelService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super();
		this._register(this.composerService.onDidChangeSession(() => {
			this.ensureMounted();
			this.syncStagedEditsToBridge();
		});
		this._register(this.viewsService.onDidChangeViewContainerVisibility(() => this.ensureMounted()));
		void this.ensureMounted();
	}

	private async ensureMounted(): Promise<void> {
		const view = this.viewsService.getActiveViewWithId(FewStepsAwayChatViewId);
		if (!view) {
			return;
		}
		const element = (view as { getElement?: () => HTMLElement }).getElement?.()
			?? (view as { element?: HTMLElement }).element;
		if (!element) {
			return;
		}
		if (!this.composerDock) {
			this.composerDock = this._register(new ComposerDock(
				element,
				this.composerService,
				this.instantiationService,
				this.modelService,
			));
			this.composerDock.onAcceptEdit(edit => {
				void this.acceptEdit(edit);
			});
			this.composerDock.onAcceptAll(() => {
				void this.acceptAllPending();
			});
		}
	}

	private syncStagedEditsToBridge(): void {
		const sessionResource = this.getActiveSessionResource();
		if (!sessionResource) {
			return;
		}
		const bridge = getChatEditingBridge();
		if (!bridge) {
			return;
		}
		for (const edit of this.composerService.getPendingEdits()) {
			const preview = this.composerService.getEffectiveModified(edit.id) ?? edit.modified;
			bridge.notifyFileEdit(sessionResource, edit.uri, edit.original, preview);
			void this.editorService.openEditor({ resource: edit.uri });
		}
	}

	private getActiveSessionResource(): import('../../../../base/common/uri.js').URI | undefined {
		return getFewStepsAwaySessionResource(this.chatWidgetService);
	}

	private async acceptEdit(edit: import('../../../../ai/composer/composerTypes.js').ComposerFileEdit): Promise<void> {
		const merged = this.composerService.getEffectiveModified(edit.id) ?? edit.modified;
		const before = await this.editIntegrity.snapshot(edit.uri);
		const validation = await this.editIntegrity.safeWrite(edit.uri, merged, { composerStaged: true });
		if (validation && !validation.ok) {
			const { result } = await this.dialogService.prompt<'accept' | 'revert' | 'fix'>({
				type: Severity.Warning,
				message: 'New errors detected after applying this edit',
				detail: this.editIntegrity.formatValidationMessage(validation, edit.uri),
				buttons: [
					{ label: 'Accept anyway', run: () => 'accept' as const },
					{ label: 'Fix with AI', run: () => 'fix' as const },
				],
				cancelButton: { label: 'Revert', run: () => 'revert' as const },
			});
			if (result === 'revert') {
				await this.editIntegrity.revert(before);
				this.composerService.rejectEdit(edit.id);
				return;
			}
			if (result === 'fix') {
				await this.editIntegrity.revert(before);
				this.composerService.rejectEdit(edit.id);
				const detail = this.editIntegrity.formatValidationMessage(validation, edit.uri);
				await this.instantiationService.invokeFunction(accessor =>
					sendFewStepsAwayMessage(accessor, `Fix the validation errors introduced in ${edit.uri.fsPath}:\n\n${detail}`)
				);
				return;
			}
		}
		this.composerService.acceptEdit(edit.id);

		const sessionResource = this.getActiveSessionResource();
		if (sessionResource) {
			const bridge = getChatEditingBridge();
			bridge?.notifyFileEdit(sessionResource, edit.uri, edit.original, merged, edit.hunks);
		}
	}

	private async acceptAllPending(): Promise<void> {
		const pending = [...this.composerService.getPendingEdits()];
		for (const edit of pending) {
			await this.acceptEdit(edit);
		}
		await this.maybeRunTypecheck();
	}

	private async maybeRunTypecheck(): Promise<void> {
		const runTypecheck = this.configurationService.getValue<boolean>('ai.edit.runTypecheckAfterBatch') ?? false;
		if (!runTypecheck) {
			return;
		}
		const typecheck = await this.workspaceTaskRunner.runTypecheck();
		if (!typecheck.ok) {
			await this.dialogService.info({
				message: 'Typecheck failed after accepting edits',
				detail: typecheck.output,
			});
		}
	}
}

registerWorkbenchContribution2(ComposerOverlayContribution.ID, ComposerOverlayContribution, WorkbenchPhase.AfterRestored);

registerAction2(class ComposerAcceptAllAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.composer.acceptAll',
			title: localize2('fewstepsaway.composer.acceptAll', "Accept All Composer Edits"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const composerService = accessor.get(IComposerService);
		const editIntegrity = accessor.get(IEditIntegrityService);
		const dialogService = accessor.get(IDialogService);
		const chatWidgetService = accessor.get(IChatWidgetService);
		const instantiationService = accessor.get(IInstantiationService);

		const pending = [...composerService.getPendingEdits()];
		for (const edit of pending) {
			const merged = composerService.getEffectiveModified(edit.id) ?? edit.modified;
			const before = await editIntegrity.snapshot(edit.uri);
			const validation = await editIntegrity.safeWrite(edit.uri, merged, { composerStaged: true });
			if (validation && !validation.ok) {
				const { result } = await dialogService.prompt<'accept' | 'revert' | 'fix'>({
					type: Severity.Warning,
					message: 'New errors detected after applying this edit',
					detail: editIntegrity.formatValidationMessage(validation, edit.uri),
					buttons: [
						{ label: 'Accept anyway', run: () => 'accept' as const },
						{ label: 'Fix with AI', run: () => 'fix' as const },
					],
					cancelButton: { label: 'Revert', run: () => 'revert' as const },
				});
				if (result === 'revert') {
					await editIntegrity.revert(before);
					composerService.rejectEdit(edit.id);
					continue;
				}
				if (result === 'fix') {
					await editIntegrity.revert(before);
					composerService.rejectEdit(edit.id);
					const detail = editIntegrity.formatValidationMessage(validation, edit.uri);
					await instantiationService.invokeFunction(accessor =>
						sendFewStepsAwayMessage(accessor, `Fix the validation errors introduced in ${edit.uri.fsPath}:\n\n${detail}`)
					);
					continue;
				}
			}
			composerService.acceptEdit(edit.id);
			const sessionResource = getFewStepsAwaySessionResource(chatWidgetService);
			if (sessionResource) {
				const bridge = getChatEditingBridge();
				bridge?.notifyFileEdit(sessionResource, edit.uri, edit.original, merged, edit.hunks);
			}
		}
	}
});
