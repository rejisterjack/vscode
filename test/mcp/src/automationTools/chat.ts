/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApplicationService } from '../application';
import { z } from 'zod';

/**
 * Chat Tools
 */
export function applyChatTools(server: McpServer, appService: ApplicationService): RegisteredTool[] {
	const tools: RegisteredTool[] = [];

	tools.push(server.tool(
		'vscode_automation_chat_send_message',
		'Send a message to the VS Code chat panel',
		{
			message: z.string().describe('The message to send to the chat')
		},
		async (args) => {
			const { message } = args;
			const app = await appService.getOrCreateApplication();
			try {
				await app.workbench.chat.sendMessage(message);
				return {
					content: [{
						type: 'text' as const,
						text: `Sent chat message: "${message}"`
					}]
				};
			} catch (error) {
				return {
					content: [{
						type: 'text' as const,
						text: `Failed to send chat message: ${error}`
					}]
				};
			}
		}
	));

	tools.push(server.tool(
		'fewstepsaway_sendMessage',
		'Send a message to the FewStepsAway native chat panel (stub — falls back to VS Code chat automation)',
		{
			message: z.string().describe('The message to send to FewStepsAway chat')
		},
		async (args) => {
			const { message } = args;
			const app = await appService.getOrCreateApplication();
			try {
				await app.workbench.quickaccess.runCommand('fewstepsaway.panel.chat');
				await app.workbench.chat.sendMessage(message);
				return {
					content: [{
						type: 'text' as const,
						text: `Sent FewStepsAway chat message (stub): "${message}"`
					}]
				};
			} catch (error) {
				return {
					content: [{
						type: 'text' as const,
						text: `Failed to send FewStepsAway chat message: ${error}`
					}]
				};
			}
		}
	));

	tools.push(server.tool(
		'fewstepsaway_approveTool',
		'Approve the pending FewStepsAway tool call in chat',
		{},
		async () => {
			const app = await appService.getOrCreateApplication();
			try {
				await app.workbench.quickaccess.runCommand('workbench.action.chat.acceptTool');
				return { content: [{ type: 'text' as const, text: 'Approved pending tool call' }] };
			} catch (error) {
				return { content: [{ type: 'text' as const, text: `Failed to approve tool: ${error}` }] };
			}
		}
	));

	tools.push(server.tool(
		'fewstepsaway_acceptComposerEdit',
		'Accept all pending FewStepsAway composer edits',
		{},
		async () => {
			const app = await appService.getOrCreateApplication();
			try {
				await app.workbench.quickaccess.runCommand('fewstepsaway.composer.acceptAll');
				return { content: [{ type: 'text' as const, text: 'Accepted composer edits' }] };
			} catch (error) {
				return { content: [{ type: 'text' as const, text: `Failed to accept composer edits: ${error}` }] };
			}
		}
	));

	return tools;
}
