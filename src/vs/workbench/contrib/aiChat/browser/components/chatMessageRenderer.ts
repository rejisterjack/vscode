/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../../base/browser/dom.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { ChatMessage, ChatMessagePart } from '../../../../../ai/chat/chatModels.js';

/**
 * Cursor-style message renderer: user bubbles, agent activity log, follow-up text.
 */
export class ChatMessageRenderer extends Disposable {

	render(message: ChatMessage): HTMLElement {
		if (message.role === 'user') {
			return this.renderUserMessage(message);
		}
		return this.renderAssistantMessage(message);
	}

	private renderUserMessage(message: ChatMessage): HTMLElement {
		const container = $('div.fewstepsaway-chat-message.role-user');
		const bubble = append(container, $('div.fewstepsaway-chat-user-bubble'));
		for (const part of message.parts) {
			if (part.kind === 'text') {
				bubble.textContent = part.text;
			}
		}
		return container;
	}

	private renderAssistantMessage(message: ChatMessage): HTMLElement {
		const container = $('div.fewstepsaway-chat-message.role-assistant');

		const reasoning = message.parts.find(p => p.kind === 'text' && p.id === '__reasoning__') as { text: string } | undefined;
		const toolParts = message.parts.filter(p => p.kind === 'tool-call' || p.kind === 'tool-result');
		const textParts = message.parts.filter(p => p.kind === 'text' && p.id !== '__reasoning__');
		const errors = message.parts.filter(p => p.kind === 'error');

		if (reasoning) {
			const thought = append(container, $('div.fewstepsaway-chat-thought'));
			thought.textContent = reasoning.text;
		}

		if (toolParts.length > 0 || message.isStreaming) {
			const activity = append(container, $('div.fewstepsaway-chat-activity'));
			this.renderActivityLog(activity, message.parts, message.isStreaming);
		}

		for (const part of textParts) {
			if (part.kind === 'text' && part.text.trim()) {
				const content = append(container, $('div.fewstepsaway-chat-assistant-text'));
				this.renderText(content, part.text);
			}
		}

		for (const part of errors) {
			if (part.kind === 'error') {
				const errorEl = append(container, $('div.fewstepsaway-chat-message-error'));
				errorEl.textContent = part.message;
			}
		}

		if (message.isStreaming) {
			append(container, $('span.fewstepsaway-chat-streaming-indicator'));
		}

		if (message.error) {
			const errorEl = append(container, $('div.fewstepsaway-chat-message-error'));
			errorEl.textContent = message.error;
		}

		return container;
	}

	private renderActivityLog(container: HTMLElement, parts: ChatMessagePart[], isStreaming: boolean): void {
		const list = append(container, $('ul.fewstepsaway-chat-activity-list'));

		for (const part of parts) {
			if (part.kind === 'tool-call') {
				const item = append(list, $('li.fewstepsaway-chat-activity-item'));
				const dot = append(item, $('span.fewstepsaway-chat-activity-dot'));
				dot.classList.add(...ThemeIcon.asClassNameArray(Codicon.circleFilled));

				const body = append(item, $('div.fewstepsaway-chat-activity-body'));
				const titleRow = append(body, $('div.fewstepsaway-chat-activity-title-row'));
				append(titleRow, $('span.fewstepsaway-chat-activity-title')).textContent = part.title ?? part.tool;

				const badge = append(titleRow, $('span.fewstepsaway-chat-activity-badge'));
				badge.textContent = part.state === 'completed'
					? localize('fewstepsaway.activity.completed', "Completed")
					: localize('fewstepsaway.activity.running', "Running");

				if (part.input && typeof part.input === 'object') {
					const detail = this.describeToolInput(part.tool, part.input as Record<string, unknown>);
					if (detail) {
						append(body, $('div.fewstepsaway-chat-activity-detail')).textContent = detail;
					}
				}
			}
		}

		if (isStreaming) {
			const footer = append(container, $('div.fewstepsaway-chat-activity-footer'));
			const filesToggle = append(footer, $('button.fewstepsaway-chat-files-toggle'));
			const toolCount = parts.filter(p => p.kind === 'tool-call').length;
			filesToggle.textContent = localize('fewstepsaway.activity.files', "> {0} Actions", toolCount || '…');
		}
	}

	private describeToolInput(tool: string, input: Record<string, unknown>): string {
		switch (tool) {
			case 'read': return localize('fewstepsaway.activity.read', "Read {0}", String(input.path ?? input.file ?? ''));
			case 'write': return localize('fewstepsaway.activity.write', "Write {0}", String(input.path ?? ''));
			case 'edit': return localize('fewstepsaway.activity.edit', "Edit {0}", String(input.path ?? ''));
			case 'glob': return localize('fewstepsaway.activity.glob', "Glob {0}", String(input.pattern ?? ''));
			case 'grep': return localize('fewstepsaway.activity.grep', "Grep {0}", String(input.pattern ?? ''));
			case 'bash': return localize('fewstepsaway.activity.bash', "Ran {0}", String(input.command ?? 'command').slice(0, 80));
			default: return '';
		}
	}

	private renderText(container: HTMLElement, text: string): void {
		const blocks = text.split(/```/);
		for (let i = 0; i < blocks.length; i++) {
			const block = blocks[i];
			if (i % 2 === 1) {
				const firstNewline = block.indexOf('\n');
				const lang = firstNewline >= 0 ? block.slice(0, firstNewline).trim() : '';
				const code = firstNewline >= 0 ? block.slice(firstNewline + 1) : block;
				const pre = append(container, $('pre'));
				const codeEl = append(pre, $('code'));
				if (lang) { codeEl.classList.add(`language-${lang}`); }
				codeEl.textContent = code.replace(/\n$/, '');
			} else if (block.trim()) {
				for (const para of block.split(/\n\n+/).map(p => p.trim()).filter(Boolean)) {
					append(container, $('p')).textContent = para;
				}
			}
		}
	}
}
