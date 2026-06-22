/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../../base/browser/dom.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';

/**
 * Collapsible tool call card with expand/collapse for input and output.
 */
export class ToolCallCard extends Disposable {
	private readonly element: HTMLElement;
	private detailsEl: HTMLElement | null = null;
	private expanded = false;

	constructor(
		parent: HTMLElement,
		private readonly tool: string,
		private readonly input: unknown,
		private readonly state?: string,
		private readonly title?: string
	) {
		super();

		this.element = append(parent, $('div.fewstepsaway-chat-tool-call'));
		this.element.classList.add(`state-${state ?? 'pending'}`);

		this.renderHeader();
		this.renderDetails();
	}

	private renderHeader(): void {
		const header = append(this.element, $('div.fewstepsaway-chat-tool-call-header'));

		const stateIcon = append(header, $('span.fewstepsaway-chat-tool-state-icon'));
		stateIcon.textContent = this.getStateIcon();

		const name = append(header, $('span.fewstepsaway-chat-tool-name'));
		name.textContent = this.title ?? this.tool;

		const toggle = append(header, $('span.fewstepsaway-chat-tool-toggle'));
		toggle.classList.add(...ThemeIcon.asClassNameArray(this.expanded ? Codicon.chevronDown : Codicon.chevronRight));

		header.style.cursor = 'pointer';
		header.addEventListener('click', () => {
			this.expanded = !this.expanded;
			if (this.detailsEl) {
				this.detailsEl.style.display = this.expanded ? 'block' : 'none';
			}
			toggle.classList.remove('codicon-chevron-down', 'codicon-chevron-right');
			toggle.classList.add(this.expanded ? 'codicon-chevron-down' : 'codicon-chevron-right');
		});
	}

	private renderDetails(): void {
		this.detailsEl = append(this.element, $('div.fewstepsaway-chat-tool-call-details'));
		this.detailsEl.style.display = this.expanded ? 'block' : 'none';

		if (this.input && typeof this.input === 'object' && Object.keys(this.input as object).length > 0) {
			const label = append(this.detailsEl, $('div.fewstepsaway-chat-tool-section-label'));
			label.textContent = localize('fewstepsaway.tool.input', "Input");
			const pre = append(this.detailsEl, $('pre'));
			const code = append(pre, $('code'));
			try {
				code.textContent = JSON.stringify(this.input, null, 2);
			} catch {
				code.textContent = String(this.input);
			}
		}
	}

	private getStateIcon(): string {
		switch (this.state) {
			case 'completed': return '✓';
			case 'error': return '✗';
			case 'running': return '◐';
			case 'pending':
			default: return '○';
		}
	}

	getElement(): HTMLElement {
		return this.element;
	}

	updateState(state: string, output?: unknown): void {
		this.element.classList.remove('state-pending', 'state-running', 'state-completed', 'state-error');
		this.element.classList.add(`state-${state}`);
		const stateIcon = this.element.querySelector('.fewstepsaway-chat-tool-state-icon');
		if (stateIcon) {
			stateIcon.textContent = this.getStateIcon();
		}
		if (output !== undefined && this.detailsEl) {
			const label = append(this.detailsEl, $('div.fewstepsaway-chat-tool-section-label'));
			label.textContent = localize('fewstepsaway.tool.output', "Output");
			const pre = append(this.detailsEl, $('pre'));
			const code = append(pre, $('code'));
			try {
				const out = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
				code.textContent = out;
			} catch {
				code.textContent = String(output);
			}
		}
	}
}
