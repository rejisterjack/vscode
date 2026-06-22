/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Extensions as ViewExtensions, IViewsRegistry, IViewDescriptor, IViewDescriptorService, ViewVisibilityState } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { FewStepsAwayChatViewId, FewStepsAwayChatContainerId } from './aiChatIds.js';

const VIEWS_CUSTOMIZATIONS_KEY = 'views.customizations';

/**
 * Ensures the native chat view is always present in the FewStepsAway auxiliary-bar
 * container. Users can accidentally close or drag the view out, leaving an empty
 * "Drag a view here" placeholder. A failed first render (e.g. TrustedHTML) can also
 * leave the container registered but with zero panes until the view is re-added.
 */
class RestoreChatViewContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewstepsaway.restoreChatView';

	constructor(
		@IViewsService private readonly viewsService: IViewsService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		void this.restore();
	}

	private async restore(): Promise<void> {
		await this.layoutService.whenRestored;

		const viewDescriptor = this.viewDescriptorService.getViewDescriptorById(FewStepsAwayChatViewId)
			?? Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).getView(FewStepsAwayChatViewId);
		const viewContainer = this.viewDescriptorService.getViewContainerById(FewStepsAwayChatContainerId);
		if (!viewDescriptor || !viewContainer) {
			return;
		}

		const defaultContainer = this.viewDescriptorService.getDefaultContainerById(FewStepsAwayChatViewId) ?? viewContainer;
		this.ensureViewInDefaultContainer(viewDescriptor, defaultContainer);

		await this.viewsService.openViewContainer(FewStepsAwayChatContainerId, false);
		const view = await this.viewsService.openView(FewStepsAwayChatViewId, false);

		// Retry once after layout settles — covers race with persisted view state restore.
		if (!view) {
			await new Promise(resolve => setTimeout(resolve, 500));
			this.ensureViewInDefaultContainer(viewDescriptor, defaultContainer);
			await this.viewsService.openViewContainer(FewStepsAwayChatContainerId, false);
			await this.viewsService.openView(FewStepsAwayChatViewId, false);
		}
	}

	private ensureViewInDefaultContainer(viewDescriptor: IViewDescriptor, defaultContainer: NonNullable<ReturnType<IViewDescriptorService['getDefaultContainerById']>>): void {
		const defaultModel = this.viewDescriptorService.getViewContainerModel(defaultContainer);
		const inDefault = defaultModel.allViewDescriptors.some(v => v.id === FewStepsAwayChatViewId);

		if (!inDefault) {
			this.clearPersistedViewLocation();

			const currentContainer = this.viewDescriptorService.getViewContainerByViewId(FewStepsAwayChatViewId);
			if (currentContainer && currentContainer.id !== defaultContainer.id) {
				this.viewDescriptorService.moveViewsToContainer(
					[viewDescriptor],
					defaultContainer,
					ViewVisibilityState.Expand,
					RestoreChatViewContribution.ID
				);
			}
		} else {
			const currentContainer = this.viewDescriptorService.getViewContainerByViewId(FewStepsAwayChatViewId);
			if (currentContainer && currentContainer.id !== defaultContainer.id) {
				this.viewDescriptorService.moveViewsToContainer(
					[viewDescriptor],
					defaultContainer,
					ViewVisibilityState.Expand,
					RestoreChatViewContribution.ID
				);
			}

			try {
				if (!defaultModel.isVisible(FewStepsAwayChatViewId)) {
					defaultModel.setVisible(FewStepsAwayChatViewId, true);
				}
				defaultModel.setCollapsed(FewStepsAwayChatViewId, false);
			} catch {
				// canToggleVisibility is false; visibility is managed by the view container model.
			}
		}
	}

	private clearPersistedViewLocation(): void {
		try {
			const raw = this.storageService.get(VIEWS_CUSTOMIZATIONS_KEY, StorageScope.PROFILE, '{}');
			const data = JSON.parse(raw);
			if (data.viewLocations?.[FewStepsAwayChatViewId]) {
				delete data.viewLocations[FewStepsAwayChatViewId];
				this.storageService.store(VIEWS_CUSTOMIZATIONS_KEY, JSON.stringify(data), StorageScope.PROFILE, StorageTarget.USER);
			}
		} catch {
			// Ignore malformed storage.
		}

		const workspaceStateKey = FewStepsAwayChatContainerId;
		const wsRaw = this.storageService.get(workspaceStateKey, StorageScope.WORKSPACE);
		if (!wsRaw) {
			return;
		}

		try {
			const ws = JSON.parse(wsRaw);
			if (ws[FewStepsAwayChatViewId]) {
				delete ws[FewStepsAwayChatViewId];
				if (Object.keys(ws).length > 0) {
					this.storageService.store(workspaceStateKey, JSON.stringify(ws), StorageScope.WORKSPACE, StorageTarget.MACHINE);
				} else {
					this.storageService.remove(workspaceStateKey, StorageScope.WORKSPACE);
				}
			}
		} catch {
			// Ignore malformed storage.
		}
	}
}

registerWorkbenchContribution2(RestoreChatViewContribution.ID, RestoreChatViewContribution, WorkbenchPhase.AfterRestored);
