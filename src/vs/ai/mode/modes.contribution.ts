/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { IModeRegistry, ModeRegistry, AIModeDefinition } from './modeRegistry.js';
import {
	codeRuleset, askRuleset, architectRuleset, debugRuleset, planRuleset
} from './permissionRuleset.js';
import { CODE_MODE_PROMPT } from './prompts/code.js';
import { ASK_MODE_PROMPT } from './prompts/ask.js';
import { ARCHITECT_MODE_PROMPT } from './prompts/architect.js';
import { DEBUG_MODE_PROMPT } from './prompts/debug.js';
import { PLAN_MODE_PROMPT } from './prompts/plan.js';

registerSingleton(IModeRegistry, ModeRegistry, InstantiationType.Delayed);

/**
 * All tools enabled in full-access modes.
 */
const FULL_TOOLS = ['read', 'write', 'edit', 'glob', 'grep', 'bash', 'webfetch', 'websearch', 'todo', 'question'] as const;

/**
 * Read-only tools (for ask mode).
 */
const READONLY_TOOLS = ['read', 'glob', 'grep', 'webfetch', 'websearch', 'question'] as const;

/**
 * Plan tools (read-only + todo + write restricted to plans).
 */
const PLAN_TOOLS = ['read', 'glob', 'grep', 'bash', 'webfetch', 'websearch', 'todo', 'question', 'write', 'edit'] as const;

/**
 * All built-in modes. Port of `patchAgents()` in
 * `references/kilocode/packages/opencode/src/kilocode/agent/index.ts:308-473`.
 */
export function getBuiltinModes(): readonly AIModeDefinition[] {
	return [
		{
			id: 'coding',
			displayName: 'Code',
			description: 'Default coding agent with full tool access.',
			systemPrompt: CODE_MODE_PROMPT,
			permissionRuleset: codeRuleset,
			enabledTools: FULL_TOOLS,
			temperature: 0.3
		},
		{
			id: 'ask',
			displayName: 'Ask',
			description: 'Read-only Q&A mode. Cannot make changes.',
			systemPrompt: ASK_MODE_PROMPT,
			permissionRuleset: askRuleset,
			enabledTools: READONLY_TOOLS,
			temperature: 0.3
		},
		{
			id: 'architect',
			displayName: 'Architect',
			description: 'System design and planning. Read-only; produces design docs.',
			systemPrompt: ARCHITECT_MODE_PROMPT,
			permissionRuleset: architectRuleset,
			enabledTools: PLAN_TOOLS,
			temperature: 0.4
		},
		{
			id: 'debug',
			displayName: 'Debug',
			description: 'Systematic debugging with full tool access.',
			systemPrompt: DEBUG_MODE_PROMPT,
			permissionRuleset: debugRuleset,
			enabledTools: FULL_TOOLS,
			temperature: 0.2
		},
		{
			id: 'plan',
			displayName: 'Plan',
			description: 'Read-only planning. Produces a plan document.',
			systemPrompt: PLAN_MODE_PROMPT,
			permissionRuleset: planRuleset,
			enabledTools: PLAN_TOOLS,
			temperature: 0.4
		},
		{
			id: 'learning',
			displayName: 'Learning',
			description: 'Teaching mode -- explains concepts with examples.',
			systemPrompt: 'You are a patient teacher. Explain programming concepts clearly with examples. Provide context and background for the code you discuss.',
			permissionRuleset: askRuleset,
			enabledTools: READONLY_TOOLS,
			temperature: 0.5
		}
	];
}

/**
 * Register all built-in modes. Called once at startup.
 */
export function registerBuiltinModes(registry: IModeRegistry): void {
	for (const mode of getBuiltinModes()) {
		registry.register(mode);
	}
}
