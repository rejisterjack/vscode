/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
			default: 'openai',
			enum: ['anthropic', 'openai', 'google', 'google-vertex', 'zai', 'openrouter', 'ollama', 'lmstudio', 'azure', 'amazon-bedrock', 'mistral', 'deepseek', 'xai', 'groq', 'togetherai', 'cerebras', 'deepinfra', 'fireworks', 'baseten', 'kilo'],
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
		'ai.completion.kind': {
			type: 'string',
			enum: ['fim', 'nes'],
			default: 'fim',
			enumDescriptions: [
				localize('ai.completion.kind.fim', "Fill-in-the-middle: predict the code at the cursor position."),
				localize('ai.completion.kind.nes', "Next Edit Suggestions: predict the next edit based on recent changes (Mercury).")
			],
			description: localize('ai.completion.kind', "Which inline completion mechanism to use.")
		},
		'ai.chatInputSuggest.enabled': {
			type: 'boolean',
			default: false,
			description: localize('ai.chatInputSuggest.enabled', "Enable ghost-text completions in the chat input box.")
		},
		'ai.chat.mode': {
			type: 'string',
			enum: ['coding', 'ask', 'architect', 'debug', 'plan', 'learning'],
			default: 'coding',
			enumDescriptions: [
				localize('ai.chat.mode.coding', "Code -- full tool access for writing and editing code."),
				localize('ai.chat.mode.ask', "Ask -- read-only Q&A mode."),
				localize('ai.chat.mode.architect', "Architect -- system design and planning."),
				localize('ai.chat.mode.debug', "Debug -- systematic debugging with full tool access."),
				localize('ai.chat.mode.plan', "Plan -- read-only planning that produces plan documents."),
				localize('ai.chat.mode.learning', "Learning -- explain concepts with examples.")
			],
			description: localize('ai.chat.mode', "Default mode for new chat sessions.")
		},
		'ai.chat.hideBuiltinModes': {
			type: 'boolean',
			default: true,
			description: localize('ai.chat.hideBuiltinModes', "Hide VS Code's built-in Agent and Edit modes from the chat mode picker. FewStepsAway modes are shown instead.")
		},
		'ai.backend.apiUrl': {
			type: 'string',
			default: 'http://localhost:7380/api/v1',
			description: localize('ai.backend.apiUrl', "FewStepsAway cloud API base URL (fewstepsapp backend).")
		},
		'ai.auth.oauth.clientId': {
			type: 'string',
			default: 'fewstepsaway-ide',
			description: localize('ai.auth.oauth.clientId', "OAuth client id for FewStepsAway IDE sign-in.")
		},
		'ai.auth.oauth.redirectUri': {
			type: 'string',
			default: 'fewstepsaway://auth/callback',
			description: localize('ai.auth.oauth.redirectUri', "OAuth redirect URI registered for the IDE.")
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
		},

		// --- Native LLM provider configuration ---

		'ai.provider.anthropic.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.anthropic.apiKey', "Anthropic API key.")
		},
		'ai.provider.anthropic.endpoint': {
			type: 'string',
			default: '',
			description: localize('ai.provider.anthropic.endpoint', "Custom endpoint URL (optional). Defaults to the Anthropic API.")
		},
		'ai.provider.anthropic.model': {
			type: 'string',
			default: 'claude-sonnet-4-5-20250929',
			description: localize('ai.provider.anthropic.model', "Default Anthropic model id.")
		},
		'ai.provider.openai.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.openai.apiKey', "OpenAI API key.")
		},
		'ai.provider.openai.endpoint': {
			type: 'string',
			default: '',
			description: localize('ai.provider.openai.endpoint', "Custom endpoint URL (optional).")
		},
		'ai.provider.openai.model': {
			type: 'string',
			default: 'gpt-4o',
			description: localize('ai.provider.openai.model', "Default OpenAI model id.")
		},
		'ai.provider.google.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.google.apiKey', "Google AI (Gemini) API key.")
		},
		'ai.provider.google.model': {
			type: 'string',
			default: 'gemini-2.5-pro',
			description: localize('ai.provider.google.model', "Default Gemini model id.")
		},
		'ai.provider.google-vertex.project': {
			type: 'string',
			default: '',
			description: localize('ai.provider.google-vertex.project', "Google Cloud project id for Vertex AI.")
		},
		'ai.provider.google-vertex.location': {
			type: 'string',
			default: 'us-east5',
			description: localize('ai.provider.google-vertex.location', "Vertex AI location/region.")
		},
		'ai.provider.google-vertex.accessToken': {
			type: 'string',
			default: '',
			description: localize('ai.provider.google-vertex.accessToken', "OAuth2 access token (from `gcloud auth print-access-token`).")
		},
		'ai.provider.google-vertex.model': {
			type: 'string',
			default: 'claude-sonnet-4-5-20250929',
			description: localize('ai.provider.google-vertex.model', "Default Vertex-hosted model id.")
		},
		'ai.provider.amazon-bedrock.region': {
			type: 'string',
			default: 'us-east-1',
			description: localize('ai.provider.amazon-bedrock.region', "AWS region for Bedrock.")
		},
		'ai.provider.amazon-bedrock.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.amazon-bedrock.apiKey', "AWS Bedrock bearer token (or use environment credentials).")
		},
		'ai.provider.amazon-bedrock.model': {
			type: 'string',
			default: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
			description: localize('ai.provider.amazon-bedrock.model', "Default Bedrock model id.")
		},
		'ai.provider.azure.resourceName': {
			type: 'string',
			default: '',
			description: localize('ai.provider.azure.resourceName', "Azure OpenAI resource name.")
		},
		'ai.provider.azure.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.azure.apiKey', "Azure OpenAI API key.")
		},
		'ai.provider.azure.apiVersion': {
			type: 'string',
			default: '2024-10-21',
			description: localize('ai.provider.azure.apiVersion', "Azure OpenAI API version.")
		},
		'ai.provider.azure.model': {
			type: 'string',
			default: 'gpt-4o',
			description: localize('ai.provider.azure.model', "Default Azure OpenAI deployment id.")
		},
		'ai.provider.openrouter.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.openrouter.apiKey', "OpenRouter API key.")
		},
		'ai.provider.openrouter.model': {
			type: 'string',
			default: 'anthropic/claude-sonnet-4-5-20250929',
			description: localize('ai.provider.openrouter.model', "Default OpenRouter model (prefixed with upstream provider).")
		},
		'ai.provider.xai.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.xai.apiKey', "xAI (Grok) API key.")
		},
		'ai.provider.xai.model': {
			type: 'string',
			default: 'grok-4',
			description: localize('ai.provider.xai.model', "Default xAI model id.")
		},
		'ai.provider.mistral.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.mistral.apiKey', "Mistral AI API key.")
		},
		'ai.provider.mistral.model': {
			type: 'string',
			default: 'mistral-large-latest',
			description: localize('ai.provider.mistral.model', "Default Mistral model id.")
		},
		'ai.provider.deepseek.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.deepseek.apiKey', "DeepSeek API key.")
		},
		'ai.provider.deepseek.model': {
			type: 'string',
			default: 'deepseek-chat',
			description: localize('ai.provider.deepseek.model', "Default DeepSeek model id.")
		},
		'ai.provider.zai.apiKey': {
			type: 'string',
			default: '',
			markdownDescription: localize('ai.provider.zai.apiKey', "Z.ai API key from the [Z.AI Open Platform](https://z.ai/model-api). Required for GLM Coding Plan.")
		},
		'ai.provider.zai.codingPlan': {
			type: 'boolean',
			default: true,
			description: localize('ai.provider.zai.codingPlan', "Use the GLM Coding Plan endpoint (required for Coding Plan subscription). Turn off to use the general Z.ai API.")
		},
		'ai.provider.zai.region': {
			type: 'string',
			enum: ['international', 'china'],
			default: 'international',
			enumDescriptions: [
				localize('ai.provider.zai.region.intl', "International endpoints (api.z.ai)."),
				localize('ai.provider.zai.region.china', "China endpoints (open.bigmodel.cn).")
			],
			description: localize('ai.provider.zai.region', "API region for Z.ai endpoints.")
		},
		'ai.provider.zai.endpoint': {
			type: 'string',
			default: '',
			description: localize('ai.provider.zai.endpoint', "Custom API base URL override. Leave empty to use Coding Plan / region defaults.")
		},
		'ai.provider.zai.model': {
			type: 'string',
			default: 'glm-5',
			description: localize('ai.provider.zai.model', "Default GLM model id (e.g. glm-5, glm-5.2, glm-4.7).")
		},
		'ai.provider.ollama.endpoint': {
			type: 'string',
			default: 'http://localhost:11434/v1',
			description: localize('ai.provider.ollama.endpoint', "Ollama API endpoint.")
		},
		'ai.provider.ollama.model': {
			type: 'string',
			default: 'llama3.2',
			description: localize('ai.provider.ollama.model', "Default Ollama model id.")
		},
		'ai.provider.lmstudio.endpoint': {
			type: 'string',
			default: 'http://localhost:1234/v1',
			description: localize('ai.provider.lmstudio.endpoint', "LM Studio API endpoint.")
		},
		'ai.provider.lmstudio.model': {
			type: 'string',
			default: 'local-model',
			description: localize('ai.provider.lmstudio.model', "Default LM Studio model id.")
		},
		'ai.provider.deepseek.enabled': {
			type: 'boolean',
			default: false,
			description: localize('ai.provider.deepseek.enabled', "Enable the DeepSeek provider.")
		},
		'ai.provider.groq.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.groq.apiKey', "Groq API key.")
		},
		'ai.provider.groq.model': {
			type: 'string',
			default: 'llama-3.3-70b-versatile',
			description: localize('ai.provider.groq.model', "Default Groq model id.")
		},
		'ai.provider.togetherai.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.togetherai.apiKey', "Together AI API key.")
		},
		'ai.provider.togetherai.model': {
			type: 'string',
			default: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
			description: localize('ai.provider.togetherai.model', "Default Together AI model id.")
		},
		'ai.provider.cerebras.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.cerebras.apiKey', "Cerebras API key.")
		},
		'ai.provider.cerebras.model': {
			type: 'string',
			default: 'llama3.1-8b',
			description: localize('ai.provider.cerebras.model', "Default Cerebras model id.")
		},
		'ai.provider.deepinfra.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.deepinfra.apiKey', "DeepInfra API key.")
		},
		'ai.provider.fireworks.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.fireworks.apiKey', "Fireworks AI API key.")
		},
		'ai.provider.baseten.apiKey': {
			type: 'string',
			default: '',
			description: localize('ai.provider.baseten.apiKey', "Baseten API key.")
		}
	}
});
