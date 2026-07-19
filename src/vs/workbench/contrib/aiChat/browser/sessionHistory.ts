/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IChatService } from '../../chat/common/chatService/chatService.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';

/**
 * Session history picker using VS Code native chat session store.
 */
export class SessionHistory {

	constructor(
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IChatService private readonly chatService: IChatService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
	) { }

	async show(): Promise<void> {
		const sessions = await this.chatService.getHistorySessionItems();

		if (sessions.length === 0) {
			await this.quickInputService.pick(
				[{ label: localize('fewstepsaway.history.empty', "No sessions found") }],
				{ placeHolder: localize('fewstepsaway.history.placeholder', "Chat session history") }
			);
			return;
		}

		const items: (IQuickPickItem & { sessionResource: typeof sessions[0]['sessionResource'] })[] = sessions.map(session => ({
			label: session.title || localize('fewstepsaway.history.untitled', "Untitled"),
			description: session.lastMessageDate ? new Date(session.lastMessageDate).toLocaleString() : undefined,
			sessionResource: session.sessionResource,
		}));

		const picked = await this.quickInputService.pick(items, {
			placeHolder: localize('fewstepsaway.history.placeholder', "Select a chat session to open"),
			matchOnDescription: true,
		});

		if (picked && 'sessionResource' in picked) {
			await this.chatWidgetService.openSession(picked.sessionResource);
		}
	}
}
