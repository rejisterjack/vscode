/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../nls.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../platform/registry/common/platform.js';

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

configurationRegistry.registerConfiguration({
	id: 'ai',
	order: 20,
	title: localize('aiConfigurationTitle', "AI Features"),
	type: 'object',
	properties: {
		'ai.provider.default': {
			type: 'string',
			default: 'kilo',
			enum: ['kilo'],
			description: localize('ai.provider.default', "Default AI provider to use.")
		},
		'ai.provider.kilo.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.kilo.apiKey', "Kilo Code API key for authentication.")
		},
		'ai.provider.kilo.endpoint': {
			type: 'string',
			default: 'https://api.kilo.ai/api/gateway',
			description: localize('ai.provider.kilo.endpoint', "Custom endpoint URL for the Kilo Code gateway API.")
		},
		'ai.provider.kilo.model': {
			type: 'string',
			default: 'anthropic/claude-3.5-sonnet',
			description: localize('ai.provider.kilo.model', "Default model to use with Kilo Code provider (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o).")
		},
		'ai.completion.enabled': {
			type: 'boolean',
			default: true,
			description: localize('ai.completion.enabled', "Enable AI inline completions (ghost text).")
		},
		'ai.completion.delay': {
			type: 'number',
			default: 50,
			minimum: 0,
			maximum: 1000,
			description: localize('ai.completion.delay', "Delay in milliseconds before triggering AI inline completions.")
		},
		'ai.completion.maxTokens': {
			type: 'number',
			default: 100,
			description: localize('ai.completion.maxTokens', "Maximum number of tokens to generate per completion suggestion.")
		},
		'ai.chat.mode': {
			type: 'string',
			enum: ['coding', 'architect', 'debug', 'learning'],
			default: 'coding',
			enumDescriptions: [
				localize('ai.chat.mode.coding', "General coding assistance — write, explain, and refactor code."),
				localize('ai.chat.mode.architect', "System design — architecture decisions, patterns, and best practices."),
				localize('ai.chat.mode.debug', "Debugging — analyze errors, identify root causes, and suggest fixes."),
				localize('ai.chat.mode.learning', "Teaching — explain concepts with examples for learning purposes.")
			],
			description: localize('ai.chat.mode', "Default mode for new chat sessions.")
		},
		'ai.chat.model': {
			type: 'string',
			default: '',
			description: localize('ai.chat.model', "Model to use for chat (e.g. anthropic/claude-3.5-sonnet, openai/gpt-4o). Leave empty to use the provider default.")
		},
		'ai.chat.temperature': {
			type: 'number',
			default: 0.3,
			minimum: 0,
			maximum: 2,
			description: localize('ai.chat.temperature', "Controls randomness in chat responses. Lower values are more focused; higher values are more creative.")
		},
		'ai.chat.autoApproveTools': {
			type: 'boolean',
			default: false,
			description: localize('ai.chat.autoApproveTools', "Automatically approve all tool calls without prompting. Use with caution.")
		},
		'ai.chat.sendContext': {
			type: 'boolean',
			default: true,
			description: localize('ai.chat.sendContext', "Automatically include the active file and open files as context when sending a chat message.")
		},
		'ai.chat.maxContextFiles': {
			type: 'number',
			default: 5,
			minimum: 0,
			maximum: 50,
			description: localize('ai.chat.maxContextFiles', "Maximum number of open files to include as context when sending a chat message.")
		},
		'ai.backend.spawnOnStartup': {
			type: 'boolean',
			default: true,
			description: localize('ai.backend.spawnOnStartup', "Automatically start the CLI backend when the chat view is first opened.")
		},
		'ai.backend.startupTimeoutSeconds': {
			type: 'number',
			default: 30,
			minimum: 5,
			maximum: 120,
			description: localize('ai.backend.startupTimeout', "Timeout in seconds for the CLI backend to start.")
		},
		'ai.chat.sounds.enabled': {
			type: 'boolean',
			default: false,
			description: localize('ai.chat.sounds.enabled', "Play sound effects when a chat turn completes, a permission is requested, or an error occurs.")
		},
		'ai.chat.sounds.volume': {
			type: 'number',
			default: 0.5,
			minimum: 0,
			maximum: 1,
			description: localize('ai.chat.sounds.volume', "Volume for chat sound effects (0.0 to 1.0).")
		}
	}
});
