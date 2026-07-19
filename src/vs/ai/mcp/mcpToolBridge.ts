/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { IMcpService } from '../../../workbench/contrib/mcp/common/mcpTypes.js';
import { IToolRegistry } from '../tool/toolRegistry.js';
import { McpToolAdapter } from './mcpToolAdapter.js';
import { autorun } from '../../../base/common/observable.js';
import { IFewStepsAwayAuthService } from '../auth/fewStepsAwayAuthService.js';

export const IMcpToolBridge = createDecorator<IMcpToolBridge>('ai.mcpToolBridge');

export interface IMcpToolBridge {
	readonly _serviceBrand: undefined;
	/** Refresh MCP tool registrations in the tool registry. */
	refresh(): void;
	/** Sync MCP allow/deny policy from FewStepsAway security preflight (stub). */
	syncMcpPolicy(): Promise<void>;
}

/**
 * Bridges VS Code's native MCP service into the FewStepsAway agent tool registry.
 */
export class McpToolBridge extends Disposable implements IMcpToolBridge {
	declare readonly _serviceBrand: undefined;

	private readonly registeredIds = new Set<string>();

	constructor(
		@IMcpService private readonly mcpService: IMcpService,
		@IToolRegistry private readonly toolRegistry: IToolRegistry,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IFewStepsAwayAuthService private readonly authService: IFewStepsAwayAuthService,
	) {
		super();
		this._register(autorun(reader => {
			const servers = this.mcpService.servers.read(reader);
			void servers;
			this.refresh();
		}));
	}

	async syncMcpPolicy(): Promise<void> {
		if (!this.authService.isSignedIn()) {
			return;
		}
		const servers = this.mcpService.servers.get();
		const summary = servers.map(server => {
			const tools = server.tools.get().map(tool => tool.referenceName);
			return `${server.definition.label}: ${tools.join(', ')}`;
		}).join('\n');
		const preflight = await this.authService.runSecurityPreflight(
			`MCP tool policy sync\n${summary}`,
		);
		if (!preflight.allowed) {
			const violations = preflight.policy?.violations ?? [];
			const deniedServers = violations
				.filter(v => v.toLowerCase().includes('mcp') || v.includes('/'))
				.map(v => v.split(':').pop()?.trim().toLowerCase())
				.filter((v): v is string => !!v);
			if (deniedServers.length > 0) {
				const current = this.configurationService.getValue<string[]>('ai.mcp.denylist') ?? [];
				const merged = [...new Set([...current, ...deniedServers])];
				await this.configurationService.updateValue('ai.mcp.denylist', merged);
			}
			return;
		}
	}

	refresh(): void {
		if (!this.configurationService.getValue<boolean>('ai.mcp.enabled')) {
			return;
		}
		void this.syncMcpPolicy();
		const allowlist = new Set(
			(this.configurationService.getValue<string[]>('ai.mcp.allowlist') ?? []).map(s => s.toLowerCase())
		);
		const denylist = new Set(
			(this.configurationService.getValue<string[]>('ai.mcp.denylist') ?? []).map(s => s.toLowerCase())
		);

		for (const server of this.mcpService.servers.get()) {
			const label = server.definition.label;
			for (const mcpTool of server.tools.get()) {
				const ref = mcpTool.referenceName.toLowerCase();
				if (denylist.has(ref) || denylist.has(`${label}/${ref}`)) {
					continue;
				}
				const allowlisted = allowlist.size === 0 || allowlist.has(ref) || allowlist.has(`${label}/${ref}`);
				const adapter = new McpToolAdapter(mcpTool, label, allowlisted);
				if (!this.registeredIds.has(adapter.id)) {
					try {
						this.toolRegistry.register(adapter);
						this.registeredIds.add(adapter.id);
					} catch {
						// Already registered
					}
				}
			}
		}
	}
}
