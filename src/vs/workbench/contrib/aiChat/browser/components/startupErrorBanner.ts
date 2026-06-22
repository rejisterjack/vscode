/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, addDisposableListener, EventType, hide, show } from '../../../../../base/browser/dom.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';

export interface IConnectionErrorInfo {
	readonly friendly: string;
	readonly technical?: string;
}

/**
 * Top-of-panel error banner with friendly copy, optional technical details, and retry.
 */
export class StartupErrorBanner extends Disposable {
	private readonly element: HTMLElement;
	private readonly titleEl: HTMLElement;
	private readonly detailEl: HTMLElement;
	private readonly retryButton: Button;

	private onRetryCallback: (() => void) | null = null;

	constructor(parent: HTMLElement) {
		super();

		this.element = append(parent, $('div.fewstepsaway-chat-error-banner'));
		hide(this.element);

		const content = append(this.element, $('div.fewstepsaway-chat-error-banner-content'));
		this.titleEl = append(content, $('div.fewstepsaway-chat-error-banner-title'));
		this.detailEl = append(content, $('div.fewstepsaway-chat-error-banner-detail'));
		hide(this.detailEl);

		const actions = append(this.element, $('div.fewstepsaway-chat-error-banner-actions'));
		this.retryButton = this._register(new Button(actions, {
			...defaultButtonStyles,
			secondary: true,
			title: localize('fewstepsaway.chat.retryConnection', "Retry connection")
		}));
		this.retryButton.label = localize('fewstepsaway.chat.retry', "Retry");
		this.retryButton.icon = Codicon.refresh;

		this._register(this.retryButton.onDidClick(() => this.onRetryCallback?.()));

		this._register(addDisposableListener(this.detailEl, EventType.CLICK, () => {
			this.detailEl.classList.toggle('expanded');
		}));
	}

	onRetry(callback: () => void): IDisposable {
		this.onRetryCallback = callback;
		return { dispose: () => { this.onRetryCallback = null; } };
	}

	setError(info: IConnectionErrorInfo | undefined): void {
		if (!info) {
			hide(this.element);
			return;
		}
		this.titleEl.textContent = info.friendly;
		if (info.technical) {
			this.detailEl.textContent = info.technical;
			show(this.detailEl);
		} else {
			hide(this.detailEl);
		}
		show(this.element);
	}

	clear(): void {
		this.setError(undefined);
	}
}
