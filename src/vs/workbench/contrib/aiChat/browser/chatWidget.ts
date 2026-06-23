/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { throttle } from '../../../../base/common/decorators.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ChatMessageList } from './components/chatMessageList.js';
import { PromptInput } from './components/promptInput.js';
import { TaskHeader } from './components/taskHeader.js';
import { ChatDock } from './components/chatDock.js';
import { IAttentionService } from '../../../../ai/common/attentionService.js';
import { SessionHistory } from './sessionHistory.js';
import { NativeChatController } from './nativeChatController.js';

/**
 * Cursor-style agent chat widget: activity log, mode/model pills, follow-up input.
 */
export class FewStepsAwayChatWidget extends Disposable {
	private readonly container: HTMLElement;
	private readonly taskHeader: TaskHeader;
	private readonly messageList: ChatMessageList;
	private readonly chatDock: ChatDock;
	private readonly input: PromptInput;
	private readonly controller: NativeChatController;

	private currentSessionId: string | undefined;
	private isStreaming = false;

	constructor(
		parent: HTMLElement,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IAttentionService private readonly attentionService: IAttentionService,
	) {
		super();

		this.controller = this._register(instantiationService.createInstance(NativeChatController));

		this.container = append(parent, $('div.fewstepsaway-chat-container'));

		this.taskHeader = this._register(new TaskHeader(this.container));
		this.messageList = this._register(instantiationService.createInstance(ChatMessageList, this.container));
		this.chatDock = this._register(new ChatDock(this.container));
		this.input = this._register(instantiationService.createInstance(PromptInput, this.container));

		this.messageList.setSessionCallbacks(
			() => this.controller.loadSessionHistory(),
			sessionId => this.controller.switchToSession(sessionId),
		);

		this.input.onSend(text => void this.handleSend(text));
		this.input.onStop(() => void this.handleStop());
		this.messageList.onSuggestion(text => this.input.setSuggestion(text));

		this.taskHeader.onNewChat(() => void this.handleNewChat());
		this.taskHeader.onHistory(() => void this.handleHistory());

		this._register(this.controller.onSessionChanged(sessionId => {
			this.currentSessionId = sessionId;
			this.refreshSessionHeader(sessionId);
			if (sessionId) {
				this.messageList.renderMessages(this.controller.getMessages(sessionId));
			} else {
				this.messageList.renderMessages([]);
			}
		}));

		this._register(this.controller.onChatMessageUpdated(e => {
			if (e.conversationId === this.currentSessionId) {
				this.throttledRender(e.conversationId);
				const wasStreaming = this.isStreaming;
				this.setStreaming(e.message.isStreaming);
				if (wasStreaming && !e.message.isStreaming) {
					this.attentionService.play(e.message.error ? 'nope' : 'yup');
				}
			}
		}));

		this._register(this.controller.onConversationUpdated(conversation => {
			if (conversation.id === this.currentSessionId) {
				this.taskHeader.setTitle(conversation.title);
			}
		}));

		void this.bootstrap();
	}

	focusInput(): void {
		this.input.focus();
	}

	private async bootstrap(): Promise<void> {
		this.input.setConnected(true);
		if (!this.controller.getCurrentSessionId()) {
			await this.controller.createConversation({
				title: localize('fewstepsaway.chat.newConversation', "New Conversation"),
			});
		} else {
			this.refreshSessionHeader(this.controller.getCurrentSessionId());
		}
		this.input.focus();
	}

	private refreshSessionHeader(sessionId: string | undefined): void {
		if (!sessionId) {
			this.taskHeader.setTitle(localize('fewstepsaway.chat.newConversation', "New Conversation"));
			return;
		}
		const conversation = this.controller.getConversation(sessionId);
		this.taskHeader.setTitle(conversation?.title ?? localize('fewstepsaway.chat.newConversation', "New Conversation"));
	}

	private async handleNewChat(): Promise<void> {
		await this.controller.createConversation({
			title: localize('fewstepsaway.chat.newConversation', "New Conversation"),
		});
		this.chatDock.hide();
		this.input.focus();
	}

	private async handleHistory(): Promise<void> {
		const sessionHistory = this.instantiationService.createInstance(SessionHistory);
		await sessionHistory.show();
	}

	private async handleSend(text: string): Promise<void> {
		if (!this.currentSessionId) {
			await this.controller.createConversation();
			this.currentSessionId = this.controller.getCurrentSessionId();
		}
		if (!this.currentSessionId) {
			return;
		}

		this.input.clear();
		this.setStreaming(true);

		try {
			await this.controller.sendMessage(this.currentSessionId, text);
		} catch {
			this.setStreaming(false);
		}
	}

	private async handleStop(): Promise<void> {
		await this.controller.abortCurrentStream();
		this.setStreaming(false);
	}

	private setStreaming(streaming: boolean): void {
		if (this.isStreaming === streaming) { return; }
		this.isStreaming = streaming;
		this.input.setStreaming(streaming);
	}

	@throttle(16)
	protected throttledRender(sessionId: string): void {
		this.messageList.renderMessages(this.controller.getMessages(sessionId));
	}
}
