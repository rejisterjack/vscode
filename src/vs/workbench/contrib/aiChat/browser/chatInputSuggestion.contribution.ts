/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Range } from '../../../../editor/common/core/range.js';
import { IChatInputSuggestionService } from '../../../../ai/suggestion/chatInputSuggestionService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IChatWidgetService, isIChatViewViewContext } from '../../chat/browser/chat.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
import { IChatWidget } from '../../chat/browser/widget/chatWidget.js';
import { FewStepsAwayChatViewId } from './aiChatIds.js';

class ChatInputSuggestionContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.fewstepsaway.chatInputSuggestion';

	private debounceTimer: ReturnType<typeof setTimeout> | undefined;
	private readonly ghostDecorationIds = new Map<IChatWidget, string[]>();

	constructor(
		@IChatInputSuggestionService private readonly chatInputSuggestionService: IChatInputSuggestionService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
	) {
		super();
		this._register(this.chatWidgetService.onDidAddWidget(widget => {
			if (!isIChatViewViewContext(widget.viewContext) || widget.viewContext.viewId !== FewStepsAwayChatViewId) {
				return;
			}
			this.attachGhostSuggestion(widget);
		}));
		for (const widget of this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat)) {
			if (isIChatViewViewContext(widget.viewContext) && widget.viewContext.viewId === FewStepsAwayChatViewId) {
				this.attachGhostSuggestion(widget);
			}
		}
	}

	private attachGhostSuggestion(widget: IChatWidget): void {
		const editor = widget.inputEditor;
		this._register(editor.onDidChangeModelContent(() => {
			if (!this.chatInputSuggestionService.isEnabled()) {
				return;
			}
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
			}
			this.debounceTimer = setTimeout(() => {
				void this.updateGhostText(widget);
			}, 300);
		}));
	}

	private async updateGhostText(widget: IChatWidget): Promise<void> {
		const editor = widget.inputEditor;
		const model = editor.getModel();
		if (!model) {
			return;
		}
		const text = model.getValue();
		const position = editor.getPosition();
		if (!position) {
			return;
		}
		const offset = model.getOffsetAt(position);
		const suggestion = await this.chatInputSuggestionService.getSuggestion(text, offset);
		const previousIds = this.ghostDecorationIds.get(widget) ?? [];
		if (!suggestion) {
			const cleared = editor.deltaDecorations(previousIds, []);
			this.ghostDecorationIds.set(widget, cleared);
			return;
		}
		const line = model.getLineContent(position.lineNumber);
		const ghostEndColumn = line.length + suggestion.length + 1;
		const newIds = editor.deltaDecorations(previousIds, [{
			range: new Range(position.lineNumber, line.length + 1, position.lineNumber, ghostEndColumn),
			options: {
				inlineClassName: 'fewstepsaway-chat-ghost-text',
				description: 'chat-input-suggestion',
			},
		}]);
		this.ghostDecorationIds.set(widget, newIds);
	}
}

registerWorkbenchContribution2(ChatInputSuggestionContribution.ID, ChatInputSuggestionContribution, WorkbenchPhase.AfterRestored);
