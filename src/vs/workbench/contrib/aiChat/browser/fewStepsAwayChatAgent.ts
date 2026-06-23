/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { hasKey } from '../../../../base/common/types.js';
import { canceled, isCancellationError } from '../../../../base/common/errors.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { IAIService, IProviderRegistry } from '../../../../ai/common/types/provider.types.js';
import { IFewStepsAwayAuthService } from '../../../../ai/auth/fewStepsAwayAuthService.js';
import { FEWSTEPSAWAY_OPEN_PROVIDER_SETTINGS_COMMAND_ID, FEWSTEPSAWAY_SIGN_IN_COMMAND_ID } from '../../../../ai/mode/modeIcons.js';
import { localize } from '../../../../nls.js';
import { AIMode } from '../../../../ai/common/types/ai.types.js';
import { IAgentLoop, AgentEvent } from '../../../../ai/agent/agentLoop.js';
import { AIModeDefinition, IModeRegistry } from '../../../../ai/mode/modeRegistry.js';
import { Message, ModelRef, SystemPart } from '../../../../ai/provider/common/llmProtocol.js';
import { IToolEnabledProvider } from '../../../../ai/provider/common/protocolBackedProvider.js';
import { IToolRegistry } from '../../../../ai/tool/toolRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ILanguageModelsService } from '../../chat/common/languageModels.js';
import { IChatAgentHistoryEntry, IChatAgentImplementation, IChatAgentRequest, IChatAgentResult } from '../../chat/common/participants/chatAgents.js';
import { IChatProgress } from '../../chat/common/chatService/chatService.js';
import { asToolEnabledProvider, parseFewStepsAwayModelId } from './fewStepsAwayLanguageModelProvider.js';

const AGENT_ID_TO_MODE: Record<string, AIMode> = {
	'fewstepsaway.chat': 'ask',
	'fewstepsaway.edits': 'coding',
	'fewstepsaway.agent': 'coding',
};

const MODE_NAME_TO_ID: Record<string, AIMode> = {
	code: 'coding',
	coding: 'coding',
	ask: 'ask',
	architect: 'architect',
	debug: 'debug',
	plan: 'plan',
	learning: 'learning',
};

/**
 * Native FewStepsAway chat agent -- routes chat requests through the in-process
 * agent loop, provider registry, mode registry, and tool system.
 */
export class FewStepsAwayChatAgent extends Disposable implements IChatAgentImplementation {

	constructor(
		@IAIService _aiService: IAIService,
		@IFewStepsAwayAuthService private readonly authService: IFewStepsAwayAuthService,
		@IAgentLoop private readonly agentLoop: IAgentLoop,
		@IModeRegistry private readonly modeRegistry: IModeRegistry,
		@IProviderRegistry private readonly providerRegistry: IProviderRegistry,
		@IToolRegistry private readonly toolRegistry: IToolRegistry,
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async invoke(
		request: IChatAgentRequest,
		progress: (parts: IChatProgress[]) => void,
		history: IChatAgentHistoryEntry[],
		token: CancellationToken
	): Promise<IChatAgentResult> {
		if (!this.authService.isSignedIn()) {
			progress([{
				kind: 'markdownContent',
				content: new MarkdownString(
					localize('fewstepsaway.signInRequired', "Sign in to FewStepsAway to use AI chat.")
				),
			}]);
			progress([{
				kind: 'command',
				command: {
					id: FEWSTEPSAWAY_SIGN_IN_COMMAND_ID,
					title: localize('fewstepsaway.signIn', "Sign in to FewStepsAway"),
				},
			}]);
			progress([{
				kind: 'command',
				command: {
					id: FEWSTEPSAWAY_OPEN_PROVIDER_SETTINGS_COMMAND_ID,
					title: localize('fewstepsaway.configureProviders', "Configure AI Providers"),
				},
			}]);
			return {};
		}

		let mode: AIModeDefinition;
		try {
			mode = this.resolveMode(request);
		} catch (error) {
			return { errorDetails: { message: toErrorMessage(error), responseIsIncomplete: true } };
		}

		let provider: IToolEnabledProvider;
		let model: ModelRef;
		try {
			({ provider, model } = this.resolveModel(request));
		} catch (error) {
			return {
				errorDetails: {
					message: toErrorMessage(error) || 'No AI provider configured. Add an API key in Settings → AI Features.',
					responseIsIncomplete: true,
				},
			};
		}

		const allTools = this.toolRegistry.getAllTools();
		const enabledTools = this.modeRegistry.getEnabledTools(mode.id, allTools);
		const messages = this.buildMessages(history, request);
		const system: SystemPart[] = [{
			type: 'text',
			text: this.buildSystemPrompt(mode, request),
		}];

		const temperature = mode.temperature ?? this.configurationService.getValue<number>('ai.chat.temperature') ?? 0.3;

		try {
			for await (const event of this.agentLoop.run({
				provider,
				model,
				system,
				messages,
				tools: enabledTools,
				generation: { temperature },
				sessionId: request.sessionResource.toString(),
				messageId: request.requestId,
				abortSignal: token,
			})) {
				if (token.isCancellationRequested) {
					throw canceled();
				}
				if (event.type === 'error') {
					return { errorDetails: { message: event.error, responseIsIncomplete: true } };
				}
				this.handleAgentEvent(event, progress);
			}
		} catch (error) {
			if (isCancellationError(error)) {
				throw canceled();
			}
			this.logService.error('[FewStepsAwayChatAgent] Agent loop error:', error);
			return { errorDetails: { message: toErrorMessage(error), responseIsIncomplete: true } };
		}

		return {};
	}

	private resolveMode(request: IChatAgentRequest): AIModeDefinition {
		const metaMode = this.readMetadataString(request.modeInstructions?.metadata, 'fewstepsawayMode');
		if (metaMode) {
			const fromMeta = this.modeRegistry.getMode(metaMode as AIMode);
			if (fromMeta) {
				return fromMeta;
			}
		}

		const modeName = request.modeInstructions?.name?.toLowerCase();
		if (modeName && MODE_NAME_TO_ID[modeName]) {
			const fromName = this.modeRegistry.getMode(MODE_NAME_TO_ID[modeName]);
			if (fromName) {
				return fromName;
			}
		}

		const fromAgent = AGENT_ID_TO_MODE[request.agentId];
		if (fromAgent) {
			const mode = this.modeRegistry.getMode(fromAgent);
			if (mode) {
				return mode;
			}
		}

		const configMode = this.configurationService.getValue<AIMode>('ai.chat.mode') ?? 'coding';
		const fromConfig = this.modeRegistry.getMode(configMode);
		if (fromConfig) {
			return fromConfig;
		}

		const active = this.modeRegistry.getActiveMode();
		if (active) {
			return active;
		}

		throw new Error('No chat mode available.');
	}

	private readMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
		if (!metadata) {
			return undefined;
		}
		const value = metadata[key];
		if (typeof value === 'string') {
			return value;
		}
		if (value && typeof value === 'object' && hasKey(value, 'value') && typeof value.value === 'string') {
			return value.value;
		}
		return undefined;
	}

	private buildSystemPrompt(mode: AIModeDefinition, request: IChatAgentRequest): string {
		const extra = request.modeInstructions?.content?.trim();
		if (extra && extra !== mode.systemPrompt.trim()) {
			return `${mode.systemPrompt}\n\n${extra}`;
		}
		return mode.systemPrompt;
	}

	private resolveModel(request: IChatAgentRequest): { provider: IToolEnabledProvider; model: ModelRef } {
		const explicitModelId = request.userSelectedModelId
			|| this.configurationService.getValue<string>('ai.chat.model')
			|| '';

		if (explicitModelId) {
			const parsed = parseFewStepsAwayModelId(explicitModelId);
			if (parsed) {
				const provider = asToolEnabledProvider(this.providerRegistry.getProvider(parsed.providerId));
				if (provider) {
					this.providerRegistry.setActiveProvider(parsed.providerId);
					return { provider, model: { id: parsed.modelId } };
				}
			}

			const metadata = this.languageModelsService.lookupLanguageModel(explicitModelId);
			if (metadata) {
				const provider = asToolEnabledProvider(this.providerRegistry.getProvider(metadata.vendor));
				if (provider) {
					this.providerRegistry.setActiveProvider(metadata.vendor);
					return { provider, model: { id: metadata.id } };
				}
			}
		}

		const defaultProviderId = this.configurationService.getValue<string>('ai.provider.default') ?? 'openai';
		const providerInstance = this.providerRegistry.getProvider(defaultProviderId)
			?? this.providerRegistry.getActiveProvider()
			?? this.providerRegistry.getAllProviders()[0];

		const provider = asToolEnabledProvider(providerInstance);
		if (!provider) {
			throw new Error('No AI provider configured.');
		}

		const configModelKey = `ai.provider.${providerInstance!.id}.model`;
		const resolvedModelId = this.configurationService.getValue<string>(configModelKey)
			|| this.configurationService.getValue<string>('ai.provider.openai.model')
			|| 'gpt-4o';

		this.providerRegistry.setActiveProvider(providerInstance!.id);
		return { provider, model: { id: resolvedModelId } };
	}

	private buildMessages(history: IChatAgentHistoryEntry[], request: IChatAgentRequest): Message[] {
		const messages: Message[] = [];

		for (const entry of history) {
			if (entry.request.message) {
				messages.push({ role: 'user', content: entry.request.message });
			}

			let assistantText = '';
			for (const part of entry.response) {
				if (part.kind === 'markdownContent') {
					assistantText += part.content.value;
				}
			}
			if (assistantText) {
				messages.push({ role: 'assistant', content: assistantText });
			}
		}

		messages.push({ role: 'user', content: request.message });
		return messages;
	}

	private handleAgentEvent(
		event: AgentEvent,
		progress: (parts: IChatProgress[]) => void,
	): void {
		switch (event.type) {
			case 'text-delta': {
				if (event.text) {
					// VS Code merges consecutive markdownContent parts by appending -- send deltas only.
					progress([{ kind: 'markdownContent', content: new MarkdownString(event.text) }]);
				}
				break;
			}
			case 'reasoning-delta':
				progress([{
					kind: 'progressMessage',
					content: new MarkdownString(event.text),
				}]);
				break;
			case 'tool-call':
				progress([{
					kind: 'progressMessage',
					content: new MarkdownString(`**Tool:** ${event.name}`),
				}]);
				break;
			case 'tool-result': {
				const output = typeof event.result.output === 'string'
					? event.result.output
					: JSON.stringify(event.result.output);
				const preview = output.length > 500 ? `${output.slice(0, 500)}…` : output;
				progress([{
					kind: 'progressMessage',
					content: new MarkdownString(`**${event.name}:** ${preview}`),
				}]);
				break;
			}
		}
	}
}
