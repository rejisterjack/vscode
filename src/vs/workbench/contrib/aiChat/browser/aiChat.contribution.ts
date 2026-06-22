/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { localize2, localize } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IViewsRegistry, IViewContainersRegistry, ViewContainerLocation, Extensions as ViewExtensions } from '../../../common/views.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';

import { FewStepsAwayChatViewPane } from './aiChatViewPane.js';
import { FewStepsAwayChatViewId, FewStepsAwayChatContainerId } from './aiChatIds.js';
import './commands.js';
import './restoreChatView.contribution.js';
import './fewStepsAwayChatAgent.contribution.js';

// Re-export for backwards compatibility with any external importers.
export { FewStepsAwayChatViewId, FewStepsAwayChatContainerId };

// Register our view icon (standard chat codicon — no custom branding asset).
const fewstepsawayChatIcon = registerIcon(
	'fewstepsaway-chat-view-icon',
	Codicon.commentDiscussion,
	localize('fewstepsawayChatViewIcon', "View icon of the FewStepsAway chat view.")
);

// Register a dedicated view container in the AuxiliaryBar (secondary sidebar).
// Using our own container id avoids any dependency on workbench.panel.chat
// (which has hideIfEmpty: true and only shows for Copilot chat participants).
const chatViewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry)
	.registerViewContainer({
		id: FewStepsAwayChatContainerId,
		title: localize2('fewstepsaway.chat.container.label', "FewStepsAway"),
		icon: fewstepsawayChatIcon,
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [FewStepsAwayChatContainerId, { mergeViewWithContainerWhenSingleView: true }]),
		storageId: FewStepsAwayChatContainerId,
		hideIfEmpty: false,
		rejectAddedViews: true,
		order: 0,
	}, ViewContainerLocation.AuxiliaryBar, { isDefault: true, doNotRegisterOpenCommand: true });

// Register the native view descriptor into our dedicated container.
const chatViewDescriptor = {
	id: FewStepsAwayChatViewId,
	name: localize2('fewstepsaway.chat.view.label', "FewStepsAway Chat"),
	containerIcon: fewstepsawayChatIcon,
	containerTitle: 'FewStepsAway',
	singleViewPaneContainerTitle: 'FewStepsAway',
	canToggleVisibility: false,
	canMoveView: false,
	openCommandActionDescriptor: {
		id: FewStepsAwayChatContainerId,
		title: localize2('fewstepsaway.chat.open', "Open FewStepsAway Chat"),
		mnemonicTitle: localize({ key: 'miToggleFewStepsAwayChat', comment: ['&& denotes a mnemonic'] }, "&&FewStepsAway Chat"),
		keybindings: {
			primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyI,
			mac: {
				primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.KeyI
			}
		},
		order: 1
	},
	ctorDescriptor: new SyncDescriptor(FewStepsAwayChatViewPane),
	when: ContextKeyExpr.true()
};

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry)
	.registerViews([chatViewDescriptor], chatViewContainer);
