/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, hide, show } from '../../../../../base/browser/dom.js';
import { ActionBar, ActionsOrientation } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { Action } from '../../../../../base/common/actions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { ChatMessage } from '../../../../../ai/chat/chatModels.js';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * Session header with title, optional metadata, and compact icon actions.
 */
export class TaskHeader extends Disposable {
	private readonly titleEl: HTMLElement;
	private readonly metaEl: HTMLElement;

	private onNewChatCallback: (() => void) | null = null;
	private onHistoryCallback: (() => void) | null = null;

	constructor(parent: HTMLElement) {
		super();

		const header = append(parent, $('div.fewstepsaway-chat-task-header'));

		const mainRow = append(header, $('div.fewstepsaway-chat-task-header-main'));

		const titleBlock = append(mainRow, $('div.fewstepsaway-chat-task-header-titles'));
		this.titleEl = append(titleBlock, $('div.fewstepsaway-chat-session-title'));
		this.metaEl = append(titleBlock, $('div.fewstepsaway-chat-session-meta'));
		hide(this.metaEl);

		const actions = append(mainRow, $('div.fewstepsaway-chat-task-header-actions'));
		const actionBar = this._register(new ActionBar(actions, { orientation: ActionsOrientation.HORIZONTAL }));

		const newChatAction = this._register(new Action(
			'fewstepsaway.chat.newSession',
			'',
			ThemeIcon.asClassName(Codicon.add),
			true,
			() => this.onNewChatCallback?.()
		));
		newChatAction.tooltip = localize('fewstepsaway.chat.newSession', "New Chat");

		const historyAction = this._register(new Action(
			'fewstepsaway.chat.openHistory',
			'',
			ThemeIcon.asClassName(Codicon.history),
			true,
			() => this.onHistoryCallback?.()
		));
		historyAction.tooltip = localize('fewstepsaway.chat.openHistory', "Chat History");

		actionBar.push(newChatAction, { icon: true, label: false });
		actionBar.push(historyAction, { icon: true, label: false });

		this.setTitle(localize('fewstepsaway.chat.newConversation', "New Conversation"));
	}

	onNewChat(callback: () => void): IDisposable {
		this.onNewChatCallback = callback;
		return { dispose: () => { this.onNewChatCallback = null; } };
	}

	onHistory(callback: () => void): IDisposable {
		this.onHistoryCallback = callback;
		return { dispose: () => { this.onHistoryCallback = null; } };
	}

	setTitle(title: string): void {
		this.titleEl.textContent = title;
	}

	setMetadata(messages: ChatMessage[]): void {
		const totalCost = messages.reduce((sum, m) => sum + (m.cost ?? 0), 0);
		if (totalCost > 0) {
			this.metaEl.textContent = localize('fewstepsaway.chat.sessionCost', "Session cost: {0}", `$${totalCost.toFixed(4)}`);
			show(this.metaEl);
		} else {
			hide(this.metaEl);
		}
	}

	setConnectionStatus(_status: ConnectionStatus): void {
		// Connection state is shown in the error banner and input status line.
	}
}
