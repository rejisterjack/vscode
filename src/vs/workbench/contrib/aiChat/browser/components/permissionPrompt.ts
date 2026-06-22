/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../../base/browser/dom.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { PermissionRequest } from '../../../../../ai/backend/apiTypes.js';

export type PermissionResponse = 'allow' | 'always' | 'deny';

/**
 * Permission dock card (Kilo PermissionDock shape): Allow once, Always, Deny.
 */
export class PermissionPrompt extends Disposable {
	private readonly element: HTMLElement;
	private allowOnceButton: Button | null = null;
	private allowAlwaysButton: Button | null = null;
	private denyButton: Button | null = null;

	private onResponseCallback: ((response: PermissionResponse) => void) | null = null;

	constructor(parent: HTMLElement, request: PermissionRequest) {
		super();

		this.element = append(parent, $('div.fewstepsaway-chat-permission-prompt'));

		const title = append(this.element, $('div.fewstepsaway-chat-permission-title'));
		title.textContent = localize('fewstepsaway.permission.title', "Tool requires permission: {0}", request.tool);

		if (request.input && typeof request.input === 'object' && Object.keys(request.input as object).length > 0) {
			const inputEl = append(this.element, $('div.fewstepsaway-chat-permission-input'));
			const pre = append(inputEl, $('pre'));
			const code = append(pre, $('code'));
			try {
				code.textContent = JSON.stringify(request.input, null, 2);
			} catch {
				code.textContent = String(request.input);
			}
		}

		const actions = append(this.element, $('div.fewstepsaway-chat-permission-actions'));

		this.allowOnceButton = this._register(new Button(actions, {
			...defaultButtonStyles,
			title: localize('fewstepsaway.permission.allowOnce', "Allow this tool call once")
		}));
		this.allowOnceButton.label = localize('fewstepsaway.permission.allowOnceLabel', "Allow Once");
		this.allowOnceButton.icon = Codicon.check;

		this.allowAlwaysButton = this._register(new Button(actions, {
			...defaultButtonStyles,
			title: localize('fewstepsaway.permission.allowAlways', "Always allow this tool")
		}));
		this.allowAlwaysButton.label = localize('fewstepsaway.permission.allowAlwaysLabel', "Always");
		this.allowAlwaysButton.icon = Codicon.checkAll;

		this.denyButton = this._register(new Button(actions, {
			...defaultButtonStyles,
			title: localize('fewstepsaway.permission.deny', "Deny this tool call")
		}));
		this.denyButton.label = localize('fewstepsaway.deny', "Deny");
		this.denyButton.icon = Codicon.close;

		this._register(this.allowOnceButton.onDidClick(() => this.onResponseCallback?.('allow')));
		this._register(this.allowAlwaysButton.onDidClick(() => this.onResponseCallback?.('always')));
		this._register(this.denyButton.onDidClick(() => this.onResponseCallback?.('deny')));
	}

	onResponse(callback: (response: PermissionResponse) => void): IDisposable {
		this.onResponseCallback = callback;
		return { dispose: () => { this.onResponseCallback = null; } };
	}

	/** @deprecated Use onResponse */
	onAllow(callback: () => void): IDisposable {
		return this.onResponse(r => { if (r === 'allow' || r === 'always') { callback(); } });
	}

	/** @deprecated Use onResponse */
	onDeny(callback: () => void): IDisposable {
		return this.onResponse(r => { if (r === 'deny') { callback(); } });
	}

	getElement(): HTMLElement {
		return this.element;
	}

	markResolved(allowed: boolean): void {
		this.allowOnceButton!.enabled = false;
		this.allowAlwaysButton!.enabled = false;
		this.denyButton!.enabled = false;
		this.element.classList.add('resolved');
		this.element.classList.add(allowed ? 'allowed' : 'denied');
	}
}
