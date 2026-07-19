/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the root directory of source tree.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { parseMentions } from '../../../../ai/common/mentionParser.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IChatWidgetService, isIChatViewViewContext } from '../../chat/browser/chat.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
import { IChatWidget } from '../../chat/browser/widget/chatWidget.js';
import { FewStepsAwayChatViewId } from './aiChatIds.js';

/**
 * Renders removable mention chips above the FewStepsAway chat input when @tokens are present.
 */
class MentionChipsContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.fewstepsaway.mentionChips';

	private readonly widgetState = new Map<IChatWidget, { container: HTMLElement; disposables: DisposableStore }>();

	constructor(
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
	) {
		super();
		this._register(this.chatWidgetService.onDidAddWidget(widget => {
			if (!isIChatViewViewContext(widget.viewContext) || widget.viewContext.viewId !== FewStepsAwayChatViewId) {
				return;
			}
			this.attach(widget);
		}));
		for (const widget of this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat)) {
			if (isIChatViewViewContext(widget.viewContext) && widget.viewContext.viewId === FewStepsAwayChatViewId) {
				this.attach(widget);
			}
		}
	}

	private attach(widget: IChatWidget): void {
		if (this.widgetState.has(widget)) {
			return;
		}
		const inputPart = widget.input;
		const inputElement = (inputPart as { getElement?: () => HTMLElement }).getElement?.()
			?? (inputPart as { element?: HTMLElement }).element;
		if (!inputElement) {
			return;
		}
		const disposables = new DisposableStore();
		const chipContainer = append(inputElement, $('.fewstepsaway-mention-chips'));
		chipContainer.style.display = 'none';
		this.widgetState.set(widget, { container: chipContainer, disposables });

		const editor = widget.inputEditor;
		disposables.add(editor.onDidChangeModelContent(() => {
			this.renderChips(widget);
		}));
		this.renderChips(widget);
	}

	private renderChips(widget: IChatWidget): void {
		const state = this.widgetState.get(widget);
		if (!state) {
			return;
		}
		clearNode(state.container);
		const text = widget.inputEditor.getModel()?.getValue() ?? '';
		const mentions = parseMentions(text);
		if (mentions.length === 0) {
			state.container.style.display = 'none';
			return;
		}
		state.container.style.display = 'flex';
		for (const mention of mentions) {
			const chip = append(state.container, $('span.fewstepsaway-chat-suggestion-chip')) as HTMLSpanElement;
			chip.textContent = mention.raw;
			chip.title = 'Click to remove';
			chip.onclick = () => {
				const next = text.replace(mention.raw, '').replace(/\s{2,}/g, ' ').trim();
				widget.setInput(next);
			};
		}
	}
}

registerWorkbenchContribution2(MentionChipsContribution.ID, MentionChipsContribution, WorkbenchPhase.AfterRestored);
