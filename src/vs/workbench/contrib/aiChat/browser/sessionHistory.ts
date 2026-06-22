/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IChatService } from '../../../../ai/common/types/conversation.types.js';
import { ChatService } from '../../../../ai/chat/chatService.js';
import { SessionInfo } from '../../../../ai/backend/apiTypes.js';

/**
 * Session history picker.
 *
 * Shows a QuickPick listing past chat sessions from the CLI backend.
 * Selecting a session loads its messages into the chat view.
 */
export class SessionHistory {

	constructor(
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IChatService private readonly chatService: IChatService
	) { }

	async show(): Promise<void> {
		const cs = this.chatService as ChatService;
		const sessions = await cs.loadSessionHistory();

		if (sessions.length === 0) {
			this.quickInputService.pick(
				[{ label: localize('fewstepsaway.history.empty', "No sessions found") }],
				{ placeHolder: localize('fewstepsaway.history.placeholder', "Chat session history") }
			);
			return;
		}

		const items: (IQuickPickItem & { session: SessionInfo })[] = sessions.map(session => ({
			label: session.title || localize('fewstepsaway.history.untitled', "Untitled"),
			description: this.formatTimestamp(session.time),
			detail: session.mode ? `Mode: ${session.mode}` : undefined,
			session
		}));

		const picked = await this.quickInputService.pick(items, {
			placeHolder: localize('fewstepsaway.history.placeholder', "Select a chat session to open"),
			matchOnDescription: true,
			matchOnDetail: true
		});

		if (picked && 'session' in picked) {
			const sessionItem = picked as IQuickPickItem & { session: SessionInfo };
			await cs.switchToSession(sessionItem.session.id);
		}
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
