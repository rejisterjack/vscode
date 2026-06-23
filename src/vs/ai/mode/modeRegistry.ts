/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { AIMode } from '../common/types/ai.types.js';
import { PermissionRuleset } from './permissionRuleset.js';
import { ITool } from '../tool/toolTypes.js';

/**
 * A mode definition. Modes are declarative config: they define a system
 * prompt, a permission ruleset (which tools are allowed/ask/deny), and
 * optional generation options.
 *
 * Port of the `Agent.Info` schema in
 * `references/kilocode/packages/opencode/src/agent/agent.ts:31-53`.
 */
export interface AIModeDefinition {
	readonly id: AIMode;
	readonly displayName: string;
	readonly description: string;
	readonly systemPrompt: string;
	readonly permissionRuleset: PermissionRuleset;
	/** Which tools to enable for this mode (filtered by the ruleset). */
	readonly enabledTools: readonly string[];
	readonly temperature?: number;
	readonly color?: string;
	readonly icon?: string;
}

/**
 * The mode registry manages all operational modes and tracks the active mode.
 */
export const IModeRegistry = createDecorator<IModeRegistry>('ai.modeRegistry');

export interface IModeRegistry {
	readonly _serviceBrand: undefined;
	/**
	 * Register a mode.
	 */
	register(mode: AIModeDefinition): void;
	/**
	 * Get a mode by id.
	 */
	getMode(modeId: AIMode): AIModeDefinition | undefined;
	/**
	 * Get all registered modes.
	 */
	getAllModes(): readonly AIModeDefinition[];
	/**
	 * Set the active mode.
	 */
	setActiveMode(modeId: AIMode): void;
	/**
	 * Get the active mode.
	 */
	getActiveMode(): AIModeDefinition | undefined;
	/**
	 * Fired when the active mode changes.
	 */
	readonly onDidChangeActiveMode: Event<{ oldMode: AIMode; newMode: AIMode }>;
	/**
	 * Get the list of tools enabled for a mode, filtered by the tool registry.
	 */
	getEnabledTools(modeId: AIMode, allTools: readonly ITool[]): readonly ITool[];
}

export class ModeRegistry extends Disposable implements IModeRegistry {
	declare readonly _serviceBrand: undefined;

	private readonly modes = new Map<AIMode, AIModeDefinition>();
	private activeModeId: AIMode = 'coding';

	private readonly _onDidChangeActiveMode = this._register(new Emitter<{ oldMode: AIMode; newMode: AIMode }>());
	readonly onDidChangeActiveMode: Event<{ oldMode: AIMode; newMode: AIMode }> = this._onDidChangeActiveMode.event;

	register(mode: AIModeDefinition): void {
		this.modes.set(mode.id, mode);
	}

	getMode(modeId: AIMode): AIModeDefinition | undefined {
		return this.modes.get(modeId);
	}

	getAllModes(): readonly AIModeDefinition[] {
		return Array.from(this.modes.values());
	}

	setActiveMode(modeId: AIMode): void {
		if (!this.modes.has(modeId)) {
			throw new Error(`Unknown mode: ${modeId}`);
		}
		if (this.activeModeId !== modeId) {
			const oldMode = this.activeModeId;
			this.activeModeId = modeId;
			this._onDidChangeActiveMode.fire({ oldMode, newMode: modeId });
		}
	}

	getActiveMode(): AIModeDefinition | undefined {
		return this.modes.get(this.activeModeId);
	}

	getEnabledTools(modeId: AIMode, allTools: readonly ITool[]): readonly ITool[] {
		const mode = this.getMode(modeId);
		if (!mode) { return []; }
		return allTools.filter(tool => mode.enabledTools.includes(tool.id));
	}
}
