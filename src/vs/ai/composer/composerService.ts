/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { URI } from '../../../base/common/uri.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { IComposerService, ComposerSession, ComposerFileEdit, ComposerHunkStatus } from './composerTypes.js';
import { computeComposerHunks, getEffectiveModified, setHunkStatus as applyHunkStatus } from './composerHunkUtils.js';

/**
 * Manages multi-file composer sessions with per-file accept/reject.
 */
export class ComposerService extends Disposable implements IComposerService {
	declare readonly _serviceBrand: undefined;

	private session: ComposerSession | undefined;

	private readonly _onDidChangeSession = this._register(new Emitter<ComposerSession | undefined>());
	readonly onDidChangeSession: Event<ComposerSession | undefined> = this._onDidChangeSession.event;

	get activeSession(): ComposerSession | undefined {
		return this.session;
	}

	startSession(prompt: string): ComposerSession {
		this.session = {
			id: generateUuid(),
			prompt,
			edits: [],
			createdAt: Date.now(),
		};
		this._onDidChangeSession.fire(this.session);
		return this.session;
	}

	stageEdit(uri: URI, original: string, modified: string): ComposerFileEdit {
		if (!this.session) {
			this.startSession('');
		}
		const hunks = computeComposerHunks(original, modified);
		const pendingIndex = this.session!.edits.findIndex(
			edit => edit.status === 'pending' && edit.uri.toString() === uri.toString(),
		);
		if (pendingIndex >= 0) {
			const existing = this.session!.edits[pendingIndex]!;
			const updated: ComposerFileEdit = {
				...existing,
				original,
				modified,
				hunks,
			};
			const edits = [...this.session!.edits];
			edits[pendingIndex] = updated;
			this.session = { ...this.session!, edits };
			this._onDidChangeSession.fire(this.session);
			return updated;
		}
		const edit: ComposerFileEdit = {
			id: generateUuid(),
			uri,
			original,
			modified,
			hunks,
			status: 'pending',
		};
		this.session = {
			...this.session!,
			edits: [...this.session!.edits, edit],
		};
		this._onDidChangeSession.fire(this.session);
		return edit;
	}

	acceptEdit(editId: string): ComposerFileEdit | undefined {
		return this.setEditStatus(editId, 'accepted');
	}

	rejectEdit(editId: string): ComposerFileEdit | undefined {
		return this.setEditStatus(editId, 'rejected');
	}

	setHunkStatus(editId: string, hunkId: string, status: ComposerHunkStatus): ComposerFileEdit | undefined {
		if (!this.session) {
			return undefined;
		}
		let found: ComposerFileEdit | undefined;
		const edits = this.session.edits.map(edit => {
			if (edit.id !== editId) {
				return edit;
			}
			const hunks = applyHunkStatus(edit.hunks, hunkId, status);
			found = { ...edit, hunks, modified: getEffectiveModified(edit.original, hunks) };
			return found;
		});
		this.session = { ...this.session, edits };
		this._onDidChangeSession.fire(this.session);
		return found;
	}

	getEffectiveModified(editId: string): string | undefined {
		const edit = this.session?.edits.find(item => item.id === editId);
		if (!edit) {
			return undefined;
		}
		return getEffectiveModified(edit.original, edit.hunks);
	}

	getPendingEdits(): ComposerFileEdit[] {
		if (!this.session) {
			return [];
		}
		return this.session.edits.filter(e => e.status === 'pending');
	}

	acceptAll(): ComposerFileEdit[] {
		return this.getPendingEdits();
	}

	rejectAll(): void {
		if (!this.session) {
			return;
		}
		const edits = this.session.edits.map(e =>
			e.status === 'pending' ? { ...e, status: 'rejected' as const } : e
		);
		this.session = { ...this.session, edits };
		this._onDidChangeSession.fire(this.session);
	}

	endSession(): void {
		this.session = undefined;
		this._onDidChangeSession.fire(undefined);
	}

	private setEditStatus(editId: string, status: 'accepted' | 'rejected'): ComposerFileEdit | undefined {
		if (!this.session) {
			return undefined;
		}
		let found: ComposerFileEdit | undefined;
		const edits = this.session.edits.map(e => {
			if (e.id === editId) {
				found = { ...e, status };
				return found;
			}
			return e;
		});
		this.session = { ...this.session, edits };
		this._onDidChangeSession.fire(this.session);
		return found;
	}
}
