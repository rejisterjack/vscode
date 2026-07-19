/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../base/common/uri.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IChatWidgetService, isIChatViewViewContext } from '../../chat/browser/chat.js';
import { IChatService } from '../../chat/common/chatService/chatService.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
import { IChatWidget } from '../../chat/browser/widget/chatWidget.js';
import { FewStepsAwayChatViewId } from './aiChatIds.js';

export function getFewStepsAwayWidgetFromService(widgetService: IChatWidgetService): IChatWidget | undefined {
	for (const widget of widgetService.getWidgetsByLocations(ChatAgentLocation.Chat)) {
		const ctx = widget.viewContext;
		if (isIChatViewViewContext(ctx) && ctx.viewId === FewStepsAwayChatViewId) {
			return widget;
		}
	}
	return undefined;
}

export function getFewStepsAwayWidget(accessor: ServicesAccessor): IChatWidget | undefined {
	const widgetService = accessor.get(IChatWidgetService);
	return getFewStepsAwayWidgetFromService(widgetService);
}

export function getFewStepsAwaySessionResource(widgetService: IChatWidgetService): URI | undefined {
	return getFewStepsAwayWidgetFromService(widgetService)?.viewModel?.sessionResource;
}

export async function openFewStepsAwayChat(accessor: ServicesAccessor, focusInput = true): Promise<IChatWidget | undefined> {
	const viewsService = accessor.get(IViewsService);
	await viewsService.openView(FewStepsAwayChatViewId, focusInput);
	return getFewStepsAwayWidget(accessor);
}

export async function startNewFewStepsAwaySession(accessor: ServicesAccessor): Promise<void> {
	const chatService = accessor.get(IChatService);
	const widget = await openFewStepsAwayChat(accessor, true);
	if (!widget) {
		return;
	}
	const ref = chatService.startSession(ChatAgentLocation.Chat);
	widget.setModel(ref.object);
}

export async function sendFewStepsAwayMessage(accessor: ServicesAccessor, message: string): Promise<void> {
	const chatService = accessor.get(IChatService);
	const widget = await openFewStepsAwayChat(accessor, false);
	if (!widget?.viewModel) {
		await startNewFewStepsAwaySession(accessor);
	}
	const target = getFewStepsAwayWidget(accessor);
	const sessionResource = target?.viewModel?.sessionResource;
	if (!sessionResource) {
		return;
	}
	await chatService.sendRequest(sessionResource, message);
	const widgetService = accessor.get(IChatWidgetService);
	const w = getFewStepsAwayWidget(accessor);
	if (w) {
		await widgetService.reveal(w);
		w.focusInput();
	}
}
