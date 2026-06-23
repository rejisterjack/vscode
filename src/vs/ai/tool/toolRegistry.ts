/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { ITool, ToolWireDefinition, toWireDefinition } from './toolTypes.js';

/**
 * The tool registry manages all available tools. Tools are filtered per-
 * request based on the active mode's permission ruleset.
 *
 * Port of `references/kilocode/packages/opencode/src/tool/registry.ts:249-312`.
 */
export const IToolRegistry = createDecorator<IToolRegistry>('ai.toolRegistry');

export interface IToolRegistry {
	readonly _serviceBrand: undefined;
	/**
	 * Register a tool.
	 */
	register(tool: ITool): void;
	/**
	 * Get a tool by id.
	 */
	getTool(toolId: string): ITool | undefined;
	/**
	 * Get all registered tools.
	 */
	getAllTools(): readonly ITool[];
	/**
	 * Get the wire-format definitions for the given tool ids. Used to build
	 * the `tools` array sent to the LLM.
	 */
	getWireDefinitions(toolIds: readonly string[]): ToolWireDefinition[];
	/**
	 * Fired when a tool is registered.
	 */
	readonly onDidRegisterTool: Event<ITool>;
}

export class ToolRegistry extends Disposable implements IToolRegistry {
	declare readonly _serviceBrand: undefined;

	private readonly tools = new Map<string, ITool>();

	private readonly _onDidRegisterTool = this._register(new Emitter<ITool>());
	readonly onDidRegisterTool: Event<ITool> = this._onDidRegisterTool.event;

	register(tool: ITool): void {
		if (this.tools.has(tool.id)) {
			throw new Error(`Tool with id ${tool.id} is already registered`);
		}
		this.tools.set(tool.id, tool);
		this._onDidRegisterTool.fire(tool);
	}

	getTool(toolId: string): ITool | undefined {
		return this.tools.get(toolId);
	}

	getAllTools(): readonly ITool[] {
		return Array.from(this.tools.values());
	}

	getWireDefinitions(toolIds: readonly string[]): ToolWireDefinition[] {
		const defs: ToolWireDefinition[] = [];
		for (const id of toolIds) {
			const tool = this.tools.get(id);
			if (tool) {
				defs.push(toWireDefinition(tool));
			}
		}
		return defs;
	}
}
