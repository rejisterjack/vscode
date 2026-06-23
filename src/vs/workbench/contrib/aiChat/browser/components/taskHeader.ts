/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../../base/browser/dom.js';
import { ActionBar, ActionsOrientation } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { Action } from '../../../../../base/common/actions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';

/**
 * Compact header toolbar: new chat, history, more.
 */
export class TaskHeader extends Disposable {
	private readonly titleEl: HTMLElement;

	private onNewChatCallback: (() => void) | null = null;
	private onHistoryCallback: (() => void) | null = null;

	constructor(parent: HTMLElement) {
		super();

		const header = append(parent, $('div.fewstepsaway-chat-task-header'));

		this.titleEl = append(header, $('div.fewstepsaway-chat-session-title'));
		hideTitle(this.titleEl);

		const actions = append(header, $('div.fewstepsaway-chat-task-header-actions'));
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

		const moreAction = this._register(new Action(
			'fewstepsaway.chat.more',
			'',
			ThemeIcon.asClassName(Codicon.ellipsis),
			true,
			() => { /* future menu */ }
		));
		moreAction.tooltip = localize('fewstepsaway.chat.more', "More actions");

		actionBar.push(newChatAction, { icon: true, label: false });
		actionBar.push(historyAction, { icon: true, label: false });
		actionBar.push(moreAction, { icon: true, label: false });
	}

	onNewChat(callback: () => void): IDisposable {
		this.onNewChatCallback = callback;
		return { dispose: () => { this.onNewChatCallback = null; } };
	}

	onHistory(callback: () => void): IDisposable {
		this.onHistoryCallback = callback;
		return { dispose: () => { this.onHistoryCallback = null; } };
	}

	setTitle(_title: string): void {
		// Title shown in view tab; keep header minimal like Cursor.
	}

	setMetadata(_messages: unknown[]): void { }

	setConnectionStatus(_status: string): void { }
}

function hideTitle(el: HTMLElement): void {
	el.style.display = 'none';
}
