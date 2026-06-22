/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { ChatMessage, ChatMessagePart } from '../../../../../ai/chat/chatModels.js';
import { ToolCallCard } from './toolCallCard.js';

/**
 * Renders a single ChatMessage as a DOM element using VS Code's native theming.
 */
export class ChatMessageRenderer extends Disposable {

	render(message: ChatMessage): HTMLElement {
		const container = $('div.fewstepsaway-chat-message');
		container.classList.add(`role-${message.role}`);

		const roleLabel = append(container, $('div.fewstepsaway-chat-message-role'));
		roleLabel.textContent = message.role === 'user'
			? localize('fewstepsaway.chat.role.you', "You")
			: localize('fewstepsaway.chat.role.assistant', "Assistant");

		const content = append(container, $('div.fewstepsaway-chat-message-content'));

		for (const part of message.parts) {
			this.renderPart(content, part);
		}

		if (message.isStreaming) {
			append(content, $('span.fewstepsaway-chat-streaming-indicator'));
		}

		if (message.error) {
			const errorEl = append(container, $('div.fewstepsaway-chat-message-error'));
			errorEl.textContent = message.error;
		}

		return container;
	}

	private renderPart(container: HTMLElement, part: ChatMessagePart): void {
		switch (part.kind) {
			case 'text':
				this.renderText(container, part.text);
				break;
			case 'tool-call':
				new ToolCallCard(container, part.tool, part.input, part.state, part.title);
				break;
			case 'tool-result':
				this.renderToolResult(container, part);
				break;
			case 'diff':
				this.renderDiff(container, part);
				break;
			case 'step-start':
				append(container, $('hr.fewstepsaway-chat-step-separator'));
				break;
			case 'step-finish':
				break;
			case 'error':
				this.renderError(container, part.message);
				break;
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
				if (lang) {
					codeEl.classList.add(`language-${lang}`);
				}
				codeEl.textContent = code.replace(/\n$/, '');
			} else if (block.trim()) {
				const paragraphs = block.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
				for (const para of paragraphs) {
					const p = append(container, $('p'));
					this.appendInline(p, para);
				}
			}
		}
	}

	private appendInline(parent: HTMLElement, text: string): void {
		let i = 0;
		while (i < text.length) {
			if (text[i] === '`') {
				const end = text.indexOf('`', i + 1);
				if (end > i) {
					append(parent, $('code')).textContent = text.slice(i + 1, end);
					i = end + 1;
					continue;
				}
			}

			if (text.startsWith('**', i)) {
				const end = text.indexOf('**', i + 2);
				if (end > i + 2) {
					append(parent, $('strong')).textContent = text.slice(i + 2, end);
					i = end + 2;
					continue;
				}
			}

			if (text[i] === '*' && text[i + 1] !== '*') {
				const end = text.indexOf('*', i + 1);
				if (end > i + 1 && (end + 1 >= text.length || text[end + 1] !== '*')) {
					append(parent, $('em')).textContent = text.slice(i + 1, end);
					i = end + 1;
					continue;
				}
			}

			const nextSpecial = text.slice(i).search(/[`*]/);
			const length = nextSpecial === -1 ? text.length - i : nextSpecial;
			if (length > 0) {
				parent.appendChild(document.createTextNode(text.slice(i, i + length)));
				i += length;
			} else {
				parent.appendChild(document.createTextNode(text[i]));
				i++;
			}
		}
	}

	private renderToolResult(container: HTMLElement, part: { id: string; tool: string; output?: unknown; error?: string; title?: string }): void {
		const card = append(container, $('div.fewstepsaway-chat-tool-result'));
		const header = append(card, $('div.fewstepsaway-chat-tool-result-header'));
		header.textContent = part.error ? '✗ Error' : '✓ Result';

		if (part.error) {
			const errEl = append(card, $('div.fewstepsaway-chat-tool-result-error'));
			errEl.textContent = part.error;
		} else if (part.output !== undefined) {
			const outEl = append(card, $('div.fewstepsaway-chat-tool-result-output'));
			const pre = append(outEl, $('pre'));
			const code = append(pre, $('code'));
			try {
				const out = typeof part.output === 'string' ? part.output : JSON.stringify(part.output, null, 2);
				code.textContent = out;
			} catch {
				code.textContent = String(part.output);
			}
		}
	}

	private renderDiff(container: HTMLElement, part: { id: string; path: string; patch: string }): void {
		const diffEl = append(container, $('div.fewstepsaway-chat-diff'));
		const header = append(diffEl, $('div.fewstepsaway-chat-diff-header'));
		header.textContent = part.path;
		const pre = append(diffEl, $('pre'));
		const code = append(pre, $('code'));
		code.textContent = part.patch;
	}

	private renderError(container: HTMLElement, message: string): void {
		const errorEl = append(container, $('div.fewstepsaway-chat-message-error'));
		errorEl.textContent = message;
	}
}
