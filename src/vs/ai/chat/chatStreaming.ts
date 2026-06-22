/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { throttle } from '../../base/common/decorators.js';
import { ChatMessage } from './chatModels.js';

/**
 * Manages the streaming state for chat messages.
 *
 * The ChatService already accumulates part-updated events into ChatMessages.
 * This helper provides throttled change notification so the UI can batch
 * DOM updates to ~60fps instead of re-rendering on every single token.
 */
export class ChatStreamingManager extends Disposable {

	private readonly _onDidUpdate = this._register(new Emitter<{ conversationId: string; message: ChatMessage }>());
	readonly onDidUpdate: Event<{ conversationId: string; message: ChatMessage }> = this._onDidUpdate.event;

	private pendingUpdates = new Map<string, { conversationId: string; message: ChatMessage }>();
	private flushScheduled = false;

	/**
	 * Queue an update. Multiple updates for the same message within the
	 * throttle window are coalesced into a single emission.
	 */
	queueUpdate(conversationId: string, message: ChatMessage): void {
		this.pendingUpdates.set(message.id, { conversationId, message });
		this.scheduleFlush();
	}

	private scheduleFlush(): void {
		if (this.flushScheduled) { return; }
		this.flushScheduled = true;
		// Use the throttled flusher: at most one flush per 16ms (~60fps)
		this.throttledFlush();
	}

	@throttle(16)
	private throttledFlush(): void {
		this.flushScheduled = false;
		for (const { conversationId, message } of this.pendingUpdates.values()) {
			this._onDidUpdate.fire({ conversationId, message });
		}
		this.pendingUpdates.clear();
	}

	override dispose(): void {
		this.pendingUpdates.clear();
		super.dispose();
	}
}
