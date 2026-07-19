/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2, localize } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IQuickInputService, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { McpCommandIds } from '../../../mcp/common/mcpCommandIds.js';
import starterPack from '../../../../../ai/mcp/mcpStarterPack.json';

const MCP_SETTINGS_QUERY = 'ai.mcp';

interface StarterPackServer {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly publisher: string;
}

export function openMcpSettings(accessor: ServicesAccessor): Promise<unknown> {
	return accessor.get(IPreferencesService).openSettings({
		query: MCP_SETTINGS_QUERY,
		focusSearch: true,
	});
}

registerAction2(class OpenMcpSettingsAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.mcp.openSettings',
			title: localize2('fewstepsaway.mcp.openSettings', "Configure MCP Tools"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): Promise<unknown> {
		return openMcpSettings(accessor);
	}
});

registerAction2(class BrowseMcpGalleryAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.mcp.browseGallery',
			title: localize2('fewstepsaway.mcp.browseGallery', "Browse MCP Gallery"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const commandService = accessor.get(ICommandService);
		const servers = (starterPack as { servers: StarterPackServer[] }).servers;
		const picks: (IQuickPickItem & { action: 'starter' | 'marketplace'; serverId?: string })[] = [
			...servers.map(server => ({
				label: server.name,
				description: server.publisher,
				detail: server.description,
				action: 'starter' as const,
				serverId: server.id,
			})),
			{
				label: localize('fewstepsaway.mcp.openMarketplace', "Open VS Code MCP Marketplace…"),
				description: localize('fewstepsaway.mcp.openMarketplace.desc', "Browse all available MCP servers"),
				action: 'marketplace' as const,
			},
		];

		const selected = await quickInputService.pick(picks, {
			placeHolder: localize('fewstepsaway.mcp.gallery.placeholder', "Choose a starter MCP server or open the marketplace"),
			matchOnDescription: true,
			matchOnDetail: true,
		});
		if (!selected) {
			return;
		}
		if (selected.action === 'marketplace') {
			await commandService.executeCommand(McpCommandIds.Browse);
			return;
		}
		await commandService.executeCommand(McpCommandIds.Browse);
	}
});
