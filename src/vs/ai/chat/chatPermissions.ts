/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { PermissionRequest, QuestionRequest } from '../backend/apiTypes.js';

/**
 * Pending permission and question requests awaiting user response.
 *
 * The ChatService surfaces these via events; this manager tracks the
 * pending queue and fires events when requests are added or resolved.
 * The UI subscribes to render inline prompts.
 */
export class ChatPermissionsManager extends Disposable {

	private readonly pendingPermissions = new Map<string, { request: PermissionRequest; conversationId: string }>();
	private readonly pendingQuestions = new Map<string, { request: QuestionRequest; conversationId: string }>();

	private readonly _onPermissionAdded = this._register(new Emitter<{ request: PermissionRequest; conversationId: string }>());
	readonly onPermissionAdded: Event<{ request: PermissionRequest; conversationId: string }> = this._onPermissionAdded.event;

	private readonly _onPermissionResolved = this._register(new Emitter<string>());
	readonly onPermissionResolved: Event<string> = this._onPermissionResolved.event;

	private readonly _onQuestionAdded = this._register(new Emitter<{ request: QuestionRequest; conversationId: string }>());
	readonly onQuestionAdded: Event<{ request: QuestionRequest; conversationId: string }> = this._onQuestionAdded.event;

	private readonly _onQuestionResolved = this._register(new Emitter<string>());
	readonly onQuestionResolved: Event<string> = this._onQuestionResolved.event;

	addPermission(request: PermissionRequest, conversationId: string): void {
		this.pendingPermissions.set(request.id, { request, conversationId });
		this._onPermissionAdded.fire({ request, conversationId });
	}

	resolvePermission(id: string): void {
		if (this.pendingPermissions.delete(id)) {
			this._onPermissionResolved.fire(id);
		}
	}

	getPendingPermissions(): Array<{ request: PermissionRequest; conversationId: string }> {
		return Array.from(this.pendingPermissions.values());
	}

	addQuestion(request: QuestionRequest, conversationId: string): void {
		this.pendingQuestions.set(request.id, { request, conversationId });
		this._onQuestionAdded.fire({ request, conversationId });
	}

	resolveQuestion(id: string): void {
		if (this.pendingQuestions.delete(id)) {
			this._onQuestionResolved.fire(id);
		}
	}

	getPendingQuestions(): Array<{ request: QuestionRequest; conversationId: string }> {
		return Array.from(this.pendingQuestions.values());
	}

	clear(): void {
		this.pendingPermissions.clear();
		this.pendingQuestions.clear();
	}
}
