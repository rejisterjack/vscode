/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { canceled, isCancellationError } from '../../../../base/common/errors.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { IBackendService } from '../../../../ai/backend/backendService.js';
import { PermissionRequest, QuestionRequest, SSEEventPayload } from '../../../../ai/backend/apiTypes.js';
import { BackendHttpClient } from '../../../../ai/backend/httpClient.js';
import { toUiPart } from '../../../../ai/chat/chatModels.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IChatAgentHistoryEntry, IChatAgentImplementation, IChatAgentRequest, IChatAgentResult } from '../../chat/common/participants/chatAgents.js';
import { IChatProgress } from '../../chat/common/chatService/chatService.js';
import { humanizeConnectionError } from './connectionErrors.js';

/**
 * Chat agent implementation that bridges the FewStepsAway CLI backend
 * to VS Code's native chat progress pipeline.
 */
export class FewStepsAwayChatAgent extends Disposable implements IChatAgentImplementation {

	private readonly backendSessionByResource = new Map<string, string>();

	constructor(
		@IBackendService private readonly backendService: IBackendService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async invoke(
		request: IChatAgentRequest,
		progress: (parts: IChatProgress[]) => void,
		_history: IChatAgentHistoryEntry[],
		token: CancellationToken
	): Promise<IChatAgentResult> {
		const directory = this.getWorkspaceDirectory();
		try {
			await this.backendService.ensureConnected(directory);
		} catch (error) {
			const raw = toErrorMessage(error);
			const { friendly } = humanizeConnectionError(raw);
			return { errorDetails: { message: friendly, responseIsIncomplete: true } };
		}

		const client = this.backendService.getHttpClient();
		if (!client) {
			const { friendly } = humanizeConnectionError('Backend client unavailable');
			return { errorDetails: { message: friendly, responseIsIncomplete: true } };
		}

		let backendSessionId: string;
		try {
			backendSessionId = await this.getOrCreateBackendSession(client, request.sessionResource, directory, token);
		} catch (error) {
			if (isCancellationError(error)) {
				throw canceled();
			}
			return { errorDetails: { message: toErrorMessage(error), responseIsIncomplete: true } };
		}

		const textByPartId = new Map<string, string>();
		let turnError: string | undefined;

		const turnComplete = new Promise<void>((resolve, reject) => {
			const subscription = this.backendService.subscribeToEvents(event => {
				const payload = event.data as SSEEventPayload;
				if (payload.sessionID && payload.sessionID !== backendSessionId) {
					return;
				}

				try {
					switch (payload.type) {
						case 'message.part.updated':
							this.handlePartUpdated(payload, textByPartId, progress);
							break;
						case 'message.part.removed': {
							const data = payload.data as { id?: string };
							if (data?.id) {
								textByPartId.delete(data.id);
								this.emitMarkdown(textByPartId, progress);
							}
							break;
						}
						case 'permission.asked':
							void this.handlePermissionAsked(client, payload, directory, token);
							break;
						case 'question.asked':
							void this.handleQuestionAsked(client, payload, directory, token);
							break;
						case 'session.turn.close':
							subscription.dispose();
							resolve();
							break;
						case 'session.error': {
							const data = payload.data as { error?: string };
							turnError = data?.error ?? 'Session error';
							subscription.dispose();
							reject(new Error(turnError));
							break;
						}
					}
				} catch (err) {
					this.logService.error('[FewStepsAwayChatAgent] SSE handler error:', err);
				}
			});

			token.onCancellationRequested(() => {
				subscription.dispose();
				void client.abortSession(backendSessionId, directory).catch(err => {
					this.logService.warn('[FewStepsAwayChatAgent] Abort failed:', err);
				});
				reject(canceled());
			});
		});

		try {
			await client.sendMessage(backendSessionId, {
				directory,
				prompt: request.message,
				parts: [{ type: 'text', text: request.message }],
			}, token);
			await turnComplete;
		} catch (error) {
			if (isCancellationError(error)) {
				throw canceled();
			}
			return { errorDetails: { message: toErrorMessage(error), responseIsIncomplete: true } };
		}

		if (turnError) {
			return { errorDetails: { message: turnError, responseIsIncomplete: true } };
		}

		return {};
	}

	private getWorkspaceDirectory(): string {
		const folders = this.workspaceContextService.getWorkspace().folders;
		return folders.length > 0 ? folders[0].uri.fsPath : '';
	}

	private async getOrCreateBackendSession(
		client: BackendHttpClient,
		sessionResource: URI,
		directory: string,
		token: CancellationToken
	): Promise<string> {
		const key = sessionResource.toString();
		const existing = this.backendSessionByResource.get(key);
		if (existing) {
			return existing;
		}

		const session = await client.createSession({ directory }, token);
		this.backendSessionByResource.set(key, session.id);
		return session.id;
	}

	private handlePartUpdated(
		payload: SSEEventPayload,
		textByPartId: Map<string, string>,
		progress: (parts: IChatProgress[]) => void
	): void {
		const data = payload.data as { info?: { id: string; type: string; text?: string; [key: string]: unknown } };
		if (!data?.info) {
			return;
		}

		const uiPart = toUiPart(data.info as never);
		if (uiPart.kind === 'text') {
			textByPartId.set(uiPart.id, uiPart.text);
			this.emitMarkdown(textByPartId, progress);
		} else if (uiPart.kind === 'tool-call') {
			progress([{
				kind: 'progressMessage',
				content: new MarkdownString(`**${uiPart.title ?? uiPart.tool}**`),
			}]);
		} else if (uiPart.kind === 'error') {
			progress([{
				kind: 'warning',
				content: new MarkdownString(uiPart.message),
			}]);
		}
	}

	private emitMarkdown(textByPartId: Map<string, string>, progress: (parts: IChatProgress[]) => void): void {
		const text = Array.from(textByPartId.values()).join('\n\n');
		if (!text) {
			return;
		}
		progress([{
			kind: 'markdownContent',
			content: new MarkdownString(text),
		}]);
	}

	private async handlePermissionAsked(
		client: BackendHttpClient,
		payload: SSEEventPayload,
		directory: string,
		token: CancellationToken
	): Promise<void> {
		const perm = payload.data as PermissionRequest;
		if (!perm?.id) {
			return;
		}
		try {
			await client.replyPermission({
				id: perm.id,
				reply: 'allow',
				sessionID: perm.sessionID,
				messageID: perm.messageID,
				partID: perm.partID,
			}, token);
		} catch (err) {
			this.logService.warn('[FewStepsAwayChatAgent] Permission reply failed:', err);
		}
	}

	private async handleQuestionAsked(
		client: BackendHttpClient,
		payload: SSEEventPayload,
		directory: string,
		token: CancellationToken
	): Promise<void> {
		const question = payload.data as QuestionRequest;
		if (!question?.id) {
			return;
		}
		const answer = question.options?.[0]?.value ?? '';
		try {
			await client.answerQuestion({
				id: question.id,
				answers: answer ? [answer] : [],
				sessionID: question.sessionID,
				messageID: question.messageID,
				partID: question.partID,
			}, token);
		} catch (err) {
			this.logService.warn('[FewStepsAwayChatAgent] Question answer failed:', err);
		}
	}
}
