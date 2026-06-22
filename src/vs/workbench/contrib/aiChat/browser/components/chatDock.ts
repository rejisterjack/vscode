/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, hide, show } from '../../../../../base/browser/dom.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { PermissionRequest, QuestionRequest } from '../../../../../ai/backend/apiTypes.js';
import { PermissionPrompt, PermissionResponse } from './permissionPrompt.js';
import { QuestionDock } from './questionDock.js';

/**
 * Fixed dock above the prompt input for permissions and questions.
 */
export class ChatDock extends Disposable {
	private readonly element: HTMLElement;
	private readonly questionDock: QuestionDock;
	private permissionPrompt: PermissionPrompt | undefined;
	private permissionSubscriptions: IDisposable[] = [];

	constructor(parent: HTMLElement) {
		super();

		this.element = append(parent, $('div.fewstepsaway-chat-dock'));
		hide(this.element);
		this.questionDock = this._register(new QuestionDock(this.element));
	}

	showPermission(request: PermissionRequest, onResponse: (response: PermissionResponse) => void): void {
		this.questionDock.hide();
		this.clearPermission();
		show(this.element);

		this.permissionPrompt = new PermissionPrompt(this.element, request);
		this.permissionSubscriptions.push(
			this.permissionPrompt.onResponse(response => {
				this.permissionPrompt?.markResolved(response !== 'deny');
				onResponse(response);
			})
		);
	}

	showQuestion(request: QuestionRequest, onAnswer: (values: string[]) => void): void {
		this.clearPermission();
		this.questionDock.hide();
		show(this.element);

		this.questionDock.show(request);
		const sub = this.questionDock.onAnswer(values => {
			this.questionDock.hide();
			onAnswer(values);
		});
		this.permissionSubscriptions.push(sub);
	}

	hide(): void {
		this.clearPermission();
		this.questionDock.hide();
		hide(this.element);
	}

	private clearPermission(): void {
		for (const sub of this.permissionSubscriptions) {
			sub.dispose();
		}
		this.permissionSubscriptions = [];

		if (this.permissionPrompt) {
			this.permissionPrompt.getElement().remove();
			this.permissionPrompt.dispose();
			this.permissionPrompt = undefined;
		}
	}
}
