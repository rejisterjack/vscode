/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../base/common/event.js';

export type ComposerEditStatus = 'pending' | 'accepted' | 'rejected';
export type ComposerHunkStatus = 'pending' | 'accepted' | 'rejected';

export interface ComposerHunk {
	readonly id: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly original: string;
	readonly modified: string;
	status: ComposerHunkStatus;
}

export interface ComposerFileEdit {
	readonly id: string;
	readonly uri: URI;
	readonly original: string;
	readonly modified: string;
	hunks: ComposerHunk[];
	status: ComposerEditStatus;
}

export interface ComposerSession {
	readonly id: string;
	readonly prompt: string;
	readonly edits: ComposerFileEdit[];
	readonly createdAt: number;
}

export const IComposerService = createDecorator<IComposerService>('ai.composerService');

export interface IComposerService {
	readonly _serviceBrand: undefined;

	readonly activeSession: ComposerSession | undefined;

	onDidChangeSession: Event<ComposerSession | undefined>;

	/**
	 * Start a new composer session from a user prompt.
	 */
	startSession(prompt: string): ComposerSession;

	/**
	 * Stage a file edit in the active session.
	 */
	stageEdit(uri: URI, original: string, modified: string): ComposerFileEdit;

	/**
	 * Accept a single staged edit (applies to disk via caller).
	 */
	acceptEdit(editId: string): ComposerFileEdit | undefined;

	/**
	 * Reject a single staged edit.
	 */
	rejectEdit(editId: string): ComposerFileEdit | undefined;

	/**
	 * Accept or reject an individual hunk within a staged edit.
	 */
	setHunkStatus(editId: string, hunkId: string, status: ComposerHunkStatus): ComposerFileEdit | undefined;

	/**
	 * Return the file content after applying accepted/pending hunks.
	 */
	getEffectiveModified(editId: string): string | undefined;

	/**
	 * Return pending edits without mutating status (for accept-all orchestration).
	 */
	getPendingEdits(): ComposerFileEdit[];

	/**
	 * Accept all pending edits in the session.
	 */
	acceptAll(): ComposerFileEdit[];

	/**
	 * Reject all pending edits.
	 */
	rejectAll(): void;

	/**
	 * End the current session.
	 */
	endSession(): void;
}
