/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { URI } from '../../../../base/common/uri.js';
import { Range } from '../../../../editor/common/core/range.js';
import { Emitter, Event } from '../../../../base/common/event.js';

export type InlineEditState = 'idle' | 'prompting' | 'preview' | 'applied';

export interface InlineEditPending {
	readonly uri: URI;
	readonly range: Range;
	readonly originalText: string;
}

export const IInlineEditSessionService = createDecorator<IInlineEditSessionService>('fewstepsaway.inlineEditSession');

export interface IInlineEditSessionService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	getState(): InlineEditState;
	setPending(pending: InlineEditPending): void;
	setPreview(proposedText: string, fullModified: string): void;
	getPreview(): { proposedText: string; fullModified: string } | undefined;
	peekPending(): InlineEditPending | undefined;
	consumePending(): InlineEditPending | undefined;
	clearPending(): void;
	markApplied(): void;
}

export class InlineEditSessionService implements IInlineEditSessionService {
	declare readonly _serviceBrand: undefined;

	private state: InlineEditState = 'idle';
	private pending: InlineEditPending | undefined;
	private preview: { proposedText: string; fullModified: string } | undefined;

	private readonly _onDidChange = new Emitter<void>();
	readonly onDidChange = this._onDidChange.event;

	getState(): InlineEditState {
		return this.state;
	}

	setPending(pending: InlineEditPending): void {
		this.pending = pending;
		this.preview = undefined;
		this.state = 'prompting';
		this._onDidChange.fire();
	}

	setPreview(proposedText: string, fullModified: string): void {
		this.preview = { proposedText, fullModified };
		this.state = 'preview';
		this._onDidChange.fire();
	}

	getPreview(): { proposedText: string; fullModified: string } | undefined {
		return this.preview;
	}

	peekPending(): InlineEditPending | undefined {
		return this.pending;
	}

	consumePending(): InlineEditPending | undefined {
		const value = this.pending;
		this.pending = undefined;
		this.preview = undefined;
		this.state = 'idle';
		this._onDidChange.fire();
		return value;
	}

	clearPending(): void {
		this.pending = undefined;
		this.preview = undefined;
		this.state = 'idle';
		this._onDidChange.fire();
	}

	markApplied(): void {
		this.state = 'applied';
		this.pending = undefined;
		this.preview = undefined;
		this._onDidChange.fire();
	}
}

registerSingleton(IInlineEditSessionService, InlineEditSessionService, InstantiationType.Delayed);
