/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IMcpToolBridge } from '../../../../ai/mcp/mcpToolBridge.js';
import { IMcpService, McpConnectionState } from '../../mcp/common/mcpTypes.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';

export const FewStepsAwayMcpViewId = 'fewstepsaway.mcp.panel';

export class FewStepsAwayMcpViewPane extends ViewPane {
	private listContainer: HTMLElement | undefined;
	private readonly serverDisposables = this._register(new DisposableStore());

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IMcpService private readonly mcpService: IMcpService,
		@IMcpToolBridge private readonly mcpToolBridge: IMcpToolBridge,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.classList.add('fewstepsaway-mcp-panel');

		const toolbar = append(container, $('.fewstepsaway-mcp-panel-toolbar'));
		const refreshButton = this._register(new Button(toolbar, { ...defaultButtonStyles, title: localize('fewstepsaway.mcp.refresh', "Refresh MCP bridge") }));
		refreshButton.label = localize('fewstepsaway.mcp.refreshLabel', "Refresh");
		this._register(refreshButton.onDidClick(() => {
			this.mcpService.resetCaches();
			this.mcpToolBridge.refresh();
			this.renderServers();
		}));

		const galleryButton = this._register(new Button(toolbar, { ...defaultButtonStyles, title: localize('fewstepsaway.mcp.gallery', "Browse MCP gallery") }));
		galleryButton.label = localize('fewstepsaway.mcp.galleryLabel', "Gallery");
		this._register(galleryButton.onDidClick(() => {
			void this.commandService.executeCommand('fewstepsaway.mcp.browseGallery');
		}));

		this.listContainer = append(container, $('.fewstepsaway-mcp-panel-list'));
		this._register(autorun(reader => {
			this.mcpService.servers.read(reader);
			this.renderServers();
		}));
		this.renderServers();
	}

	private renderServers(): void {
		if (!this.listContainer) {
			return;
		}
		clearNode(this.listContainer);
		this.serverDisposables.clear();

		const servers = this.mcpService.servers.get();
		if (!servers.length) {
			append(this.listContainer, $('p', undefined, localize('fewstepsaway.mcp.empty', "No MCP servers configured. Open the gallery to add one.")));
			return;
		}

		for (const server of servers) {
			const row = append(this.listContainer, $('.fewstepsaway-mcp-server-row'));
			const label = server.definition.label;
			const state = server.connectionState.get();
			const toolCount = server.tools.get().length;
			append(row, $('span.codicon', { class: ThemeIcon.asClassName(Codicon.server) }));
			append(row, $('strong', undefined, label));
			append(row, $('span', undefined, ` — ${McpConnectionState.toKindString(state.state)}`));
			append(row, $('span', undefined, ` (${toolCount} tools)`));
		}
	}
}

export const fewStepsAwayMcpViewDescriptor = {
	id: FewStepsAwayMcpViewId,
	name: localize2('fewstepsaway.mcp.view.label', "MCP Servers"),
	ctorDescriptor: new SyncDescriptor(FewStepsAwayMcpViewPane),
	canToggleVisibility: true,
	canMoveView: true,
	order: 2,
	collapsed: true,
};

registerAction2(class OpenMcpPanelAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.mcp.openPanel',
			title: localize2('fewstepsaway.mcp.openPanel', "Open MCP Panel"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IViewsService).openView(FewStepsAwayMcpViewId, true);
	}
});
