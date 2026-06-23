/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { CancellationToken, CancellationTokenSource } from '../../base/common/cancellation.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IToolEnabledProvider } from '../provider/common/protocolBackedProvider.js';
import { IToolRegistry } from '../tool/toolRegistry.js';
import { ITool, ToolContext, ToolResult } from '../tool/toolTypes.js';
import {
	Message, ContentPart, SystemPart, ToolDefinition, ToolChoice,
	GenerationOptions, ModelRef
} from '../provider/common/llmProtocol.js';

/**
 * The agent loop orchestrates the tool-calling cycle: send the conversation
 * to the LLM, collect tool calls, execute them, feed results back, repeat
 * until the LLM stops emitting tool calls.
 *
 * Port of the tool-calling orchestration in
 * `references/kilocode/packages/opencode/src/session/llm.ts`.
 */
export const IAgentLoop = createDecorator<IAgentLoop>('ai.agentLoop');

/**
 * A single step in the agent loop: one LLM turn plus any tool executions.
 */
export interface AgentStep {
	readonly index: number;
	readonly text: string;
	readonly reasoning: string;
	readonly toolCalls: Array<{ id: string; name: string; input: unknown }>;
	readonly toolResults: Array<{ id: string; name: string; result: ToolResult }>;
	readonly finishReason?: string;
}

/**
 * An event emitted during the agent loop. The UI subscribes to this to render
 * streaming text, tool-call cards, and tool results.
 */
export type AgentEvent =
	| { readonly type: 'step-start'; readonly index: number }
	| { readonly type: 'text-delta'; readonly text: string }
	| { readonly type: 'reasoning-delta'; readonly text: string }
	| { readonly type: 'tool-call'; readonly id: string; readonly name: string; readonly input: unknown }
	| { readonly type: 'tool-result'; readonly id: string; readonly name: string; readonly result: ToolResult }
	| { readonly type: 'step-finish'; readonly step: AgentStep }
	| { readonly type: 'finish'; readonly steps: readonly AgentStep[] }
	| { readonly type: 'error'; readonly error: string };

/**
 * Options for running the agent loop.
 */
export interface AgentLoopOptions {
	readonly provider: IToolEnabledProvider;
	readonly model: ModelRef;
	readonly system: readonly SystemPart[];
	readonly messages: readonly Message[];
	readonly tools?: readonly ITool[];
	readonly toolChoice?: ToolChoice;
	readonly generation?: GenerationOptions;
	readonly maxSteps?: number;
	readonly sessionId: string;
	readonly messageId: string;
	readonly abortSignal?: CancellationToken;
}

export interface IAgentLoop {
	readonly _serviceBrand: undefined;
	/**
	 * Run the agent loop to completion, yielding events as they occur.
	 */
	run(options: AgentLoopOptions): AsyncIterable<AgentEvent>;
}

export class AgentLoop extends Disposable implements IAgentLoop {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IToolRegistry private readonly toolRegistry: IToolRegistry,
		@IConfigurationService private readonly configService: IConfigurationService
	) {
		super();
	}

	async *run(options: AgentLoopOptions): AsyncIterable<AgentEvent> {
		const maxSteps = options.maxSteps ?? 50;
		const steps: AgentStep[] = [];
		const autoApprove = this.configService.getValue<boolean>('ai.chat.autoApproveTools') ?? false;
		const messages = [...options.messages];

		for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
			yield { type: 'step-start', index: stepIndex };

			const cts = new CancellationTokenSource();
			const disposeAbort = options.abortSignal?.onCancellationRequested(() => cts.cancel());

			const toolDefs: ToolDefinition[] = (options.tools ?? this.toolRegistry.getAllTools()).map(t => ({
				name: t.id,
				description: t.description,
				parameters: t.parameters
			}));

			const textParts: string[] = [];
			const reasoningParts: string[] = [];
			const toolCalls: Array<{ id: string; name: string; input: unknown }> = [];

			try {
				for await (const event of options.provider.streamWithTools({
					model: options.model,
					system: options.system,
					messages,
					tools: toolDefs,
					toolChoice: options.toolChoice,
					generation: options.generation
				})) {
					if (event.type === 'text-delta') {
						textParts.push(event.text);
						yield { type: 'text-delta', text: event.text };
					} else if (event.type === 'reasoning-delta') {
						reasoningParts.push(event.text);
						yield { type: 'reasoning-delta', text: event.text };
					} else if (event.type === 'tool-call') {
						toolCalls.push({ id: event.id, name: event.name, input: event.input });
						yield { type: 'tool-call', id: event.id, name: event.name, input: event.input };
					} else if (event.type === 'provider-error') {
						yield { type: 'error', error: event.message };
						yield { type: 'finish', steps };
						return;
					}
				}
			} finally {
				disposeAbort?.dispose();
			}

			// Build the assistant message with text + tool calls.
			const assistantContent: ContentPart[] = [];
			if (textParts.join('')) {
				assistantContent.push({ type: 'text', text: textParts.join('') });
			}
			for (const tc of toolCalls) {
				assistantContent.push({ type: 'tool-call', id: tc.id, name: tc.name, input: tc.input });
			}
			messages.push({ role: 'assistant', content: assistantContent });

			// Execute tool calls.
			const toolResults: Array<{ id: string; name: string; result: ToolResult }> = [];
			for (const tc of toolCalls) {
				const tool = this.toolRegistry.getTool(tc.name);
				if (!tool) {
					const errorResult: ToolResult = { title: `Unknown tool: ${tc.name}`, output: `Error: unknown tool ${tc.name}` };
					toolResults.push({ id: tc.id, name: tc.name, result: errorResult });
					yield { type: 'tool-result', id: tc.id, name: tc.name, result: errorResult };
					continue;
				}

				const ctx: ToolContext = {
					sessionId: options.sessionId,
					messageId: options.messageId,
					callId: tc.id,
					abortSignal: cts.token,
					ask: async (prompt: string) => {
						if (autoApprove) { return true; }
						// Delegate to the question/permission system.
						return true; // Simplified -- real impl shows a permission prompt.
					}
				};

				try {
					const result = await tool.execute(tc.input as Record<string, unknown>, ctx);
					toolResults.push({ id: tc.id, name: tc.name, result });
					yield { type: 'tool-result', id: tc.id, name: tc.name, result };
				} catch (err) {
					const errorResult: ToolResult = {
						title: `Error in ${tc.name}`,
						output: `Error: ${err instanceof Error ? err.message : String(err)}`
					};
					toolResults.push({ id: tc.id, name: tc.name, result: errorResult });
					yield { type: 'tool-result', id: tc.id, name: tc.name, result: errorResult };
				}
			}

			// Add tool results as a tool message.
			if (toolResults.length > 0) {
				const resultParts: ContentPart[] = toolResults.map(r => ({
					type: 'tool-result',
					id: r.id,
					name: r.name,
					output: typeof r.result.output === 'string' ? r.result.output : JSON.stringify(r.result.output)
				}));
				messages.push({ role: 'tool', content: resultParts });
			}

			const step: AgentStep = {
				index: stepIndex,
				text: textParts.join(''),
				reasoning: reasoningParts.join(''),
				toolCalls,
				toolResults
			};
			steps.push(step);
			yield { type: 'step-finish', step };

			// If the LLM made no tool calls, we're done.
			if (toolCalls.length === 0) {
				yield { type: 'finish', steps };
				return;
			}
		}

		yield { type: 'finish', steps };
	}
}
