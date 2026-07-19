/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { IViewDescriptorService, IViewsRegistry, IViewContainersRegistry, Extensions as ViewExtensions } from '../../../common/views.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IBackgroundAgentService } from '../../../../ai/agent/backgroundAgentService.js';
import { FewStepsAwayChatContainerId } from './aiChatIds.js';
import { registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';

export const BackgroundAgentsViewId = 'fewstepsaway.backgroundAgents';

class BackgroundAgentsViewPane extends ViewPane {
	private listContainer: HTMLElement | undefined;
	private readonly localDisposables = this._register(new DisposableStore());

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IBackgroundAgentService private readonly backgroundAgents: IBackgroundAgentService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		const toolbar = append(container, $('.background-agents-toolbar'));
		const enqueueBtn = append(toolbar, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
		enqueueBtn.textContent = localize('fewstepsaway.backgroundAgents.enqueue', "Run in background");
		enqueueBtn.onclick = () => {
			void this.instantiationService.invokeFunction(accessor =>
				accessor.get(IQuickInputService).input({
					prompt: localize('fewstepsaway.backgroundAgents.prompt', "Background agent task"),
				}).then(prompt => {
					if (prompt) {
						this.backgroundAgents.enqueue(prompt);
					}
				})
			);
		};
		this.listContainer = append(container, $('.background-agents-list'));
		this.localDisposables.add(this.backgroundAgents.onDidChange(() => this.renderList()));
		this.renderList();
	}

	private renderList(): void {
		if (!this.listContainer) {
			return;
		}
		clearNode(this.listContainer);
		const tasks = this.backgroundAgents.list();
		if (tasks.length === 0) {
			append(this.listContainer, $('p', undefined, localize('fewstepsaway.backgroundAgents.empty', "No background agent tasks yet.")));
			return;
		}
		for (const task of tasks) {
			const row = append(this.listContainer, $('.background-agent-task'));
			append(row, $('strong', undefined, task.status.toUpperCase()));
			append(row, $('span', undefined, ` — ${task.prompt.slice(0, 80)}${task.prompt.length > 80 ? '…' : ''}`));
			if (task.status === 'queued' || task.status === 'running') {
				const cancel = append(row, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
				cancel.textContent = localize('fewstepsaway.backgroundAgents.cancel', "Cancel");
				cancel.onclick = () => this.backgroundAgents.cancel(task.id);
			}
			if (task.result) {
				append(row, $('pre', undefined, task.result));
			}
		}
	}
}

class BackgroundAgentsViewContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.fewstepsaway.backgroundAgents';

	constructor() {
		const container = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).get(FewStepsAwayChatContainerId);
		if (!container) {
			return;
		}
		Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
			id: BackgroundAgentsViewId,
			name: localize2('fewstepsaway.backgroundAgents.view', "Background Agents"),
			ctorDescriptor: new SyncDescriptor(BackgroundAgentsViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			order: 2,
			weight: 20,
		}], container);
	}
}

registerWorkbenchContribution2(BackgroundAgentsViewContribution.ID, BackgroundAgentsViewContribution, WorkbenchPhase.BlockStartup);

registerAction2(class EnqueueBackgroundAgentAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.backgroundAgent.enqueue',
			title: localize2('fewstepsaway.backgroundAgent.enqueue', "Enqueue Background Agent"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const backgroundAgents = accessor.get(IBackgroundAgentService);
		const prompt = await quickInput.input({ prompt: 'Background agent task' });
		if (prompt) {
			backgroundAgents.enqueue(prompt);
		}
	}
});
