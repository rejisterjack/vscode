/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../../base/browser/dom.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { ChatMessage } from '../../../../../ai/chat/chatModels.js';
import { SessionInfo } from '../../../../../ai/backend/apiTypes.js';
import { ChatMessageRenderer } from './chatMessageRenderer.js';

const SUGGESTIONS = [
	{ label: () => localize('fewstepsaway.suggestion.explain', "Explain this code"), prompt: () => localize('fewstepsaway.suggestion.explainPrompt', "Explain what this code does and how it fits into the project.") },
	{ label: () => localize('fewstepsaway.suggestion.debug', "Find bugs"), prompt: () => localize('fewstepsaway.suggestion.debugPrompt', "Review my code for bugs, edge cases, and potential issues.") },
	{ label: () => localize('fewstepsaway.suggestion.tests', "Write tests"), prompt: () => localize('fewstepsaway.suggestion.testsPrompt', "Write unit tests for the selected code.") },
	{ label: () => localize('fewstepsaway.suggestion.refactor', "Refactor"), prompt: () => localize('fewstepsaway.suggestion.refactorPrompt', "Suggest a cleaner refactor for this code while preserving behavior.") },
];

/**
 * Scrollable chat message list with rich empty state and recent sessions.
 */
export class ChatMessageList extends Disposable {
	private readonly container: HTMLElement;
	private readonly messagesContainer: HTMLElement;
	private readonly renderer: ChatMessageRenderer;

	private scrollLocked = false;
	private emptyStateEl: HTMLElement | null = null;
	private onSelectSession: ((sessionId: string) => void) | undefined;
	private loadRecentSessions: (() => Promise<SessionInfo[]>) | undefined;
	private onSuggestionCallback: ((text: string) => void) | null = null;

	constructor(parent: HTMLElement) {
		super();

		this.container = append(parent, $('div.fewstepsaway-chat-messages'));
		this.renderer = this._register(new ChatMessageRenderer());

		this.container.addEventListener('scroll', () => {
			const atBottom = this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight < 50;
			this.scrollLocked = !atBottom;
		});

		this.messagesContainer = append(this.container, $('div.fewstepsaway-chat-messages-inner'));
	}

	setSessionCallbacks(loadRecentSessions: () => Promise<SessionInfo[]>, onSelectSession: (sessionId: string) => void): void {
		this.loadRecentSessions = loadRecentSessions;
		this.onSelectSession = onSelectSession;
	}

	onSuggestion(callback: (text: string) => void): IDisposable {
		this.onSuggestionCallback = callback;
		return { dispose: () => { this.onSuggestionCallback = null; } };
	}

	renderMessages(messages: ChatMessage[]): void {
		if (messages.length === 0) {
			clearNode(this.messagesContainer);
			this.emptyStateEl = null;
			void this.renderEmptyState();
			return;
		}

		if (this.emptyStateEl) {
			this.emptyStateEl.remove();
			this.emptyStateEl = null;
		}

		clearNode(this.messagesContainer);

		for (const message of messages) {
			const el = this.renderer.render(message);
			this.messagesContainer.appendChild(el);
		}

		this.scrollToBottom();
	}

	private async renderEmptyState(): Promise<void> {
		if (this.emptyStateEl) {
			return;
		}

		this.emptyStateEl = append(this.messagesContainer, $('div.fewstepsaway-chat-empty-state'));

		const hero = append(this.emptyStateEl, $('div.fewstepsaway-chat-empty-hero'));
		const title = append(hero, $('div.fewstepsaway-chat-empty-title'));
		title.textContent = localize('fewstepsaway.chat.empty.title', "How can I help?");
		const hint = append(hero, $('p.fewstepsaway-chat-empty-hint'));
		hint.textContent = localize('fewstepsaway.chat.welcome.desc', "Ask me anything about your code. I can help you write, debug, explain, and refactor.");

		const suggestions = append(this.emptyStateEl, $('div.fewstepsaway-chat-suggestions'));
		for (const item of SUGGESTIONS) {
			const chip = append(suggestions, $('button.fewstepsaway-chat-suggestion-chip'));
			chip.textContent = item.label();
			chip.addEventListener('click', () => {
				this.onSuggestionCallback?.(item.prompt());
			});
		}

		const recentSection = append(this.emptyStateEl, $('div.fewstepsaway-chat-recent-section'));
		const recentLabel = append(recentSection, $('div.fewstepsaway-chat-recent-label'));
		recentLabel.textContent = localize('fewstepsaway.chat.recentSessions', "Recent sessions");

		const list = append(recentSection, $('div.fewstepsaway-chat-recent-sessions'));

		if (!this.loadRecentSessions) {
			append(list, $('div.fewstepsaway-chat-recent-empty')).textContent =
				localize('fewstepsaway.history.empty', "No sessions found");
			return;
		}

		try {
			const sessions = await this.loadRecentSessions();
			const recent = sessions.slice(0, 6);

			if (recent.length === 0) {
				append(list, $('div.fewstepsaway-chat-recent-empty')).textContent =
					localize('fewstepsaway.history.empty', "No sessions found");
				return;
			}

			for (const session of recent) {
				const row = append(list, $('button.fewstepsaway-chat-recent-session'));
				const titleEl = append(row, $('span.fewstepsaway-chat-recent-session-title'));
				titleEl.textContent = session.title || localize('fewstepsaway.history.untitled', "Untitled");
				const time = append(row, $('span.fewstepsaway-chat-recent-session-time'));
				time.textContent = this.formatTimestamp(session.time);
				row.addEventListener('click', () => {
					this.onSelectSession?.(session.id);
				});
			}
		} catch {
			append(list, $('div.fewstepsaway-chat-recent-empty')).textContent =
				localize('fewstepsaway.chat.recentSessionsOffline', "Connect to the AI backend to see recent sessions");
		}
	}

	updateMessage(_message: ChatMessage): void {
		// Incremental updates deferred; widget throttles full re-renders.
	}

	scrollToBottom(): void {
		if (this.scrollLocked) {
			return;
		}
		this.container.scrollTop = this.container.scrollHeight;
	}

	getElement(): HTMLElement {
		return this.container;
	}

	private formatTimestamp(time: number): string {
		if (!time) { return ''; }
		const date = new Date(time * (time < 1e12 ? 1000 : 1));
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60_000);
		const diffHours = Math.floor(diffMs / 3_600_000);
		const diffDays = Math.floor(diffMs / 86_400_000);

		if (diffMins < 1) { return localize('fewstepsaway.time.justNow', "just now"); }
		if (diffMins < 60) { return localize('fewstepsaway.time.minutesAgo', "{0}m ago", diffMins); }
		if (diffHours < 24) { return localize('fewstepsaway.time.hoursAgo', "{0}h ago", diffHours); }
		if (diffDays < 7) { return localize('fewstepsaway.time.daysAgo', "{0}d ago", diffDays); }
		return date.toLocaleDateString();
	}
}
