/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../../base/browser/dom.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { QuestionRequest } from '../../../../../ai/backend/apiTypes.js';

/**
 * Interactive question dock shown above the prompt input (Kilo QuestionDock shape).
 */
export class QuestionDock extends Disposable {
	private readonly element: HTMLElement;
	private readonly titleEl: HTMLElement;
	private readonly optionsEl: HTMLElement;

	private onAnswerCallback: ((values: string[]) => void) | null = null;

	constructor(parent: HTMLElement) {
		super();

		this.element = append(parent, $('div.fewstepsaway-chat-question-dock'));
		this.element.style.display = 'none';

		this.titleEl = append(this.element, $('div.fewstepsaway-chat-question-dock-title'));
		this.optionsEl = append(this.element, $('div.fewstepsaway-chat-question-dock-options'));
	}

	show(request: QuestionRequest): void {
		this.clearOptions();
		this.element.style.display = 'block';
		this.titleEl.textContent = request.title ?? 'Question';

		for (const option of request.options ?? []) {
			const btn = document.createElement('button');
			btn.className = 'fewstepsaway-chat-question-option';
			btn.textContent = option.label;
			btn.addEventListener('click', () => {
				this.markResolved();
				this.onAnswerCallback?.([option.value]);
			});
			this.optionsEl.appendChild(btn);
		}
	}

	hide(): void {
		this.element.style.display = 'none';
		this.clearOptions();
	}

	onAnswer(callback: (values: string[]) => void): IDisposable {
		this.onAnswerCallback = callback;
		return { dispose: () => { this.onAnswerCallback = null; } };
	}

	private markResolved(): void {
		this.element.classList.add('resolved');
		for (const btn of this.optionsEl.querySelectorAll('button')) {
			(btn as HTMLButtonElement).disabled = true;
		}
	}

	private clearOptions(): void {
		this.element.classList.remove('resolved');
		this.optionsEl.replaceChildren();
	}
}
