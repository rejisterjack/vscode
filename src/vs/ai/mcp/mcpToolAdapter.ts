/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { IMcpTool } from '../../../workbench/contrib/mcp/common/mcpTypes.js';
import { ITool, ToolContext, ToolResult } from '../tool/toolTypes.js';

/**
 * Adapts a VS Code MCP tool to the FewStepsAway agent ITool interface.
 */
export class McpToolAdapter implements ITool {
	readonly id: string;
	readonly description: string;
	readonly parameters: Record<string, unknown>;

	constructor(
		private readonly mcpTool: IMcpTool,
		private readonly serverLabel: string,
		private readonly allowlisted: boolean
	) {
		this.id = `mcp_${serverLabel}_${mcpTool.referenceName}`.replace(/[^a-zA-Z0-9_]/g, '_');
		this.description = mcpTool.definition.description ?? `MCP tool ${mcpTool.referenceName} from ${serverLabel}`;
		this.parameters = (mcpTool.definition.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} };
	}

	async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
		if (!this.allowlisted) {
			const granted = await ctx.ask(`Allow MCP tool ${this.mcpTool.referenceName} from ${this.serverLabel}?`);
			if (!granted) {
				return { title: 'MCP tool denied', output: 'User denied MCP tool execution.' };
			}
		}
		const result = await this.mcpTool.call(args, undefined, ctx.abortSignal ?? CancellationToken.None);
		const text = result.content
			?.map(c => ('text' in c ? c.text : JSON.stringify(c)))
			.join('\n') ?? '';
		return {
			title: `MCP ${this.mcpTool.referenceName}`,
			output: text || JSON.stringify(result),
			metadata: { server: this.serverLabel, tool: this.mcpTool.referenceName },
		};
	}
}
