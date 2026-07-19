/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
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
import { IContextManager } from '../../../../ai/common/types/context.types.js';
import { parseMentions } from '../../../../ai/common/mentionParser.js';
import { chatVariablesToMentions } from './mentionAttachmentBridge.js';
import { IRulesLoader } from '../../../../ai/rules/rulesLoader.js';
import { getChatEditingBridge } from './agentChatEditingBridge.js';
import { isEditTool } from '../../../../ai/integrity/editIntegrityService.js';
import { IEditIntegrityService } from '../../../../ai/integrity/editIntegrityService.js';
import { ToolEditContent, ToolResult } from '../../../../ai/tool/toolTypes.js';
import { ILanguageModelsService } from '../../chat/common/languageModels.js';
import { IChatAgentHistoryEntry, IChatAgentImplementation, IChatAgentRequest, IChatAgentResult } from '../../chat/common/participants/chatAgents.js';
import { IChatProgress } from '../../chat/common/chatService/chatService.js';
import { asToolEnabledProvider, parseFewStepsAwayModelId } from './fewStepsAwayLanguageModelProvider.js';
import { isTestProviderEnabled } from '../../../../ai/provider/test/testProvider.js';
import { mapToolCallToProgress, mapToolResultToProgress } from './fewStepsAwayToolProgress.js';
import { IReviewFindingsService } from '../../../../ai/review/reviewFindingsService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ReviewFindingsViewId } from './reviewPanel.contribution.js';

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

	private readonly pendingToolInputs = new Map<string, unknown>();

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
		@IContextManager private readonly contextManager: IContextManager,
		@IRulesLoader private readonly rulesLoader: IRulesLoader,
		@IEditIntegrityService private readonly editIntegrity: IEditIntegrityService,
		@IReviewFindingsService private readonly reviewFindingsService: IReviewFindingsService,
		@IViewsService private readonly viewsService: IViewsService,
	) {
		super();
	}

	private isTestMode(): boolean {
		return isTestProviderEnabled()
			|| (this.configurationService.getValue<boolean>('ai.test.mockProvider.enabled') ?? false);
	}

	async invoke(
		request: IChatAgentRequest,
		progress: (parts: IChatProgress[]) => void,
		history: IChatAgentHistoryEntry[],
		token: CancellationToken
	): Promise<IChatAgentResult> {
		if (!this.isTestMode() && !this.authService.isSignedIn()) {
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

		const preflight = this.isTestMode()
			? { allowed: true as const }
			: await this.authService.runSecurityPreflight(request.message);
		if (!preflight.allowed) {
			progress([{
				kind: 'markdownContent',
				content: new MarkdownString(localize('fewstepsaway.preflightBlocked', "Request blocked by organization security policy.")),
			}]);
			return { errorDetails: { message: 'Security preflight blocked', responseIsIncomplete: true } };
		}
		const safeRequest = preflight.redacted && preflight.redacted !== request.message
			? { ...request, message: preflight.redacted }
			: request;

		const messages = this.buildMessages(history, safeRequest);
		const inlineMentions = parseMentions(safeRequest.message);
		const attachmentMentions = chatVariablesToMentions(safeRequest.variables);
		const mentionSnippets = await this.contextManager.resolveMentions([...inlineMentions, ...attachmentMentions]);
		const contextBlock = await this.buildContextBlock(mentionSnippets);
		const rules = await this.rulesLoader.loadWorkspaceRules();
		const rulesBlock = rules ? `\n\n## Workspace rules\n${rules}` : '';
		const system: SystemPart[] = [{
			type: 'text',
			text: this.buildSystemPrompt(mode, request) + contextBlock + rulesBlock,
		}];

		const temperature = mode.temperature ?? this.configurationService.getValue<number>('ai.chat.temperature') ?? 0.3;
		let assistantOutput = '';

		try {
			for await (const event of this.agentLoop.run({
				provider,
				model,
				system,
				messages,
				tools: enabledTools,
				generation: { temperature },
				permissionRuleset: mode.permissionRuleset,
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
				if (event.type === 'tool-result') {
					this.notifyChatEditingBridge(request.sessionResource, event.name, event.result);
				}
				if (event.type === 'text-delta') {
					assistantOutput += event.text;
				}
				if (event.type === 'step-finish' && event.step.text) {
					assistantOutput = event.step.text;
				}
				this.handleAgentEvent(event, progress);
			}
			if (mode.id === 'review' && assistantOutput.trim()) {
				const findings = this.reviewFindingsService.parseFindings(assistantOutput);
				if (findings.length > 0) {
					this.reviewFindingsService.setFindings(findings);
					void this.viewsService.openView(ReviewFindingsViewId, false);
				}
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
		const nested = (value as { value?: unknown } | null | undefined)?.value;
		if (typeof nested === 'string') {
			return nested;
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
		if (this.isTestMode()) {
			const testProvider = asToolEnabledProvider(this.providerRegistry.getProvider('fewstepsaway-test'));
			if (testProvider) {
				this.providerRegistry.setActiveProvider('fewstepsaway-test');
				return { provider: testProvider, model: { id: 'test-model' } };
			}
		}

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

	private async buildContextBlock(mentionSnippets: string[]): Promise<string> {
		const parts: string[] = [];
		if (mentionSnippets.length > 0) {
			parts.push('\n\n## Referenced context\n' + mentionSnippets.join('\n\n'));
		}
		try {
			const ctx = await this.contextManager.gatherContext({ maxTokens: 2000 });
			if (ctx.currentFile?.content) {
				parts.push(`\n\n## Active file: ${ctx.currentFile.path}\n${ctx.currentFile.content.slice(0, 1500)}`);
			}
		} catch {
			// optional
		}
		return parts.join('');
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

	private notifyChatEditingBridge(
		sessionResource: import('../../../../base/common/uri.js').URI,
		toolName: string,
		result: ToolResult,
	): void {
		if (!isEditTool(toolName)) {
			return;
		}
		if (result.validation && !result.validation.ok) {
			return;
		}
		const editContent = result.metadata?.editContent as ToolEditContent | undefined;
		if (!editContent) {
			return;
		}
		if (editContent.staged) {
			return;
		}
		const bridge = getChatEditingBridge();
		if (!bridge) {
			return;
		}
		void this.editIntegrity.resolveWorkspaceUriAsync(editContent.filePath).then(fileUri => {
			bridge.notifyFileEdit(sessionResource, fileUri, editContent.original, editContent.modified);
		});
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
				this.pendingToolInputs.set(event.id, event.input);
				progress([mapToolCallToProgress(event, event.input)]);
				break;
			case 'tool-result': {
				const input = this.pendingToolInputs.get(event.id);
				this.pendingToolInputs.delete(event.id);
				progress([mapToolResultToProgress(event, input)]);
				break;
			}
		}
	}
}
