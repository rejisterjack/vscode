/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, addDisposableListener, EventType, hide } from '../../../../../base/browser/dom.js';
import { ActionBar, ActionsOrientation } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { SelectBox } from '../../../../../base/browser/ui/selectBox/selectBox.js';
import { Action } from '../../../../../base/common/actions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextViewService } from '../../../../../platform/contextview/browser/contextView.js';
import { defaultSelectBoxStyles } from '../../../../../platform/theme/browser/defaultStyles.js';

const MODES = ['coding', 'architect', 'debug', 'learning'] as const;
const MODEL_PRESETS = [
	'',
	'anthropic/claude-3.5-sonnet',
	'openai/gpt-4o',
	'google/gemini-2.0-flash',
];

function getModeLabel(mode: string): string {
	switch (mode) {
		case 'coding': return localize('fewstepsaway.mode.coding', "Coding");
		case 'architect': return localize('fewstepsaway.mode.architect', "Architect");
		case 'debug': return localize('fewstepsaway.mode.debug', "Debug");
		case 'learning': return localize('fewstepsaway.mode.learning', "Learning");
		default: return mode;
	}
}

function getModelLabel(model: string): string {
	return model || localize('fewstepsaway.chat.modelDefault', "Default");
}

/**
 * Prompt input with standard VS Code select boxes and toolbar actions.
 */
export class PromptInput extends Disposable {
	private readonly container: HTMLElement;
	private readonly attachmentsEl: HTMLElement;
	private readonly statusEl: HTMLElement;
	private readonly textarea: HTMLTextAreaElement;
	private readonly sendAction: Action;
	private readonly modeSelect: SelectBox;
	private readonly modelSelect: SelectBox;

	private isStreaming = false;
	private isConnected = false;
	private onSendCallback: ((text: string) => void) | null = null;
	private onStopCallback: (() => void) | null = null;

	constructor(
		parent: HTMLElement,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();

		this.container = append(parent, $('div.fewstepsaway-chat-prompt-input'));

		this.statusEl = append(this.container, $('div.fewstepsaway-chat-status'));
		hide(this.statusEl);

		this.attachmentsEl = append(this.container, $('div.fewstepsaway-chat-attachments'));
		hide(this.attachmentsEl);

		const inputContainer = append(this.container, $('div.fewstepsaway-chat-input-container'));
		this.textarea = document.createElement('textarea');
		this.textarea.className = 'fewstepsaway-chat-input';
		this.textarea.placeholder = localize('fewstepsaway.chat.input.placeholder', "Ask anything…");
		this.textarea.rows = 2;
		this.textarea.setAttribute('aria-label', localize('fewstepsaway.chat.input.aria', "Chat message input"));
		inputContainer.appendChild(this.textarea);

		const toolbars = append(this.container, $('div.fewstepsaway-chat-input-toolbars'));
		const toolbar = append(toolbars, $('div.fewstepsaway-chat-input-toolbar'));

		const currentMode = this.configurationService.getValue<string>('ai.chat.mode') ?? 'coding';
		const modeIdx = MODES.indexOf(currentMode as typeof MODES[number]);
		const modeIndex = modeIdx >= 0 ? modeIdx : 0;
		this.modeSelect = this._register(new SelectBox(
			MODES.map(m => ({ text: getModeLabel(m) })),
			modeIndex,
			this.contextViewService,
			defaultSelectBoxStyles,
			{ ariaLabel: localize('fewstepsaway.chat.modeSelect', "Chat mode") }
		));
		this.modeSelect.render(append(toolbar, $('div.fewstepsaway-chat-toolbar-mode')));

		const modelOptions = this.buildModelOptions();
		const currentModel = this.configurationService.getValue<string>('ai.chat.model') ?? '';
		const modelIndex = modelOptions.findIndex(m => m === currentModel);
		const safeModelIndex = modelIndex >= 0 ? modelIndex : 0;
		this.modelSelect = this._register(new SelectBox(
			modelOptions.map(m => ({ text: getModelLabel(m) })),
			safeModelIndex,
			this.contextViewService,
			defaultSelectBoxStyles,
			{ ariaLabel: localize('fewstepsaway.chat.modelSelect', "Chat model") }
		));
		this.modelSelect.render(append(toolbar, $('div.fewstepsaway-chat-toolbar-model')));

		const sendContainer = append(toolbar, $('div.fewstepsaway-chat-toolbar-send'));
		const sendBar = this._register(new ActionBar(sendContainer, { orientation: ActionsOrientation.HORIZONTAL }));
		this.sendAction = this._register(new Action(
			'fewstepsaway.chat.send',
			'',
			ThemeIcon.asClassName(Codicon.send),
			false,
			() => {
				if (this.isStreaming) {
					this.onStopCallback?.();
				} else {
					this.handleSend();
				}
			}
		));
		this.sendAction.tooltip = localize('fewstepsaway.chat.send', "Send message");
		sendBar.push(this.sendAction, { icon: true, label: false });

		this._register(this.modeSelect.onDidSelect(e => {
			void this.configurationService.updateValue('ai.chat.mode', MODES[e.index]);
		}));

		this._register(this.modelSelect.onDidSelect(e => {
			void this.configurationService.updateValue('ai.chat.model', modelOptions[e.index]);
		}));

		this._register(addDisposableListener(this.textarea, EventType.INPUT, () => {
			this.autoGrow();
			this.updateSendEnabled();
		}));

		this._register(addDisposableListener(this.textarea, EventType.KEY_DOWN, e => {
			const event = e as KeyboardEvent;
			if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
				event.preventDefault();
				this.handleSend();
			}
		}));

		this.updateSendEnabled();
	}

	setConnected(connected: boolean): void {
		this.isConnected = connected;
		this.textarea.disabled = !connected && !this.isStreaming;
		this.updateSendEnabled();
	}

	private buildModelOptions(): string[] {
		const current = this.configurationService.getValue<string>('ai.chat.model') ?? '';
		const options = [...MODEL_PRESETS];
		if (current && !options.includes(current)) {
			options.push(current);
		}
		return options;
	}

	setStatus(text: string, _kind: 'info' | 'error' | 'connecting' = 'info'): void {
		if (!text) {
			hide(this.statusEl);
			return;
		}
		this.statusEl.textContent = text;
		this.statusEl.className = 'fewstepsaway-chat-status';
		this.statusEl.style.display = 'block';
	}

	clearStatus(): void {
		hide(this.statusEl);
		this.statusEl.textContent = '';
	}

	setSuggestion(text: string): void {
		this.textarea.value = text;
		this.autoGrow();
		this.updateSendEnabled();
		this.focus();
	}

	onSend(callback: (text: string) => void): IDisposable {
		this.onSendCallback = callback;
		return { dispose: () => { this.onSendCallback = null; } };
	}

	onStop(callback: () => void): IDisposable {
		this.onStopCallback = callback;
		return { dispose: () => { this.onStopCallback = null; } };
	}

	setStreaming(streaming: boolean): void {
		this.isStreaming = streaming;
		this.textarea.disabled = streaming ? false : !this.isConnected;
		this.updateButtonIcon();
		this.updateSendEnabled();
	}

	focus(): void {
		this.textarea.focus();
	}

	clear(): void {
		this.textarea.value = '';
		this.autoGrow();
		this.updateSendEnabled();
	}

	private updateButtonIcon(): void {
		if (this.isStreaming) {
			this.sendAction.class = ThemeIcon.asClassName(Codicon.debugStop);
			this.sendAction.tooltip = localize('fewstepsaway.chat.stop', "Stop");
		} else {
			this.sendAction.class = ThemeIcon.asClassName(Codicon.send);
			this.sendAction.tooltip = localize('fewstepsaway.chat.send', "Send message");
		}
	}

	private updateSendEnabled(): void {
		if (this.isStreaming) {
			this.sendAction.enabled = true;
			return;
		}
		this.sendAction.enabled = this.isConnected && this.textarea.value.trim().length > 0;
	}

	private handleSend(): void {
		const text = this.textarea.value.trim();
		if (!text || this.isStreaming || !this.isConnected) {
			return;
		}
		this.onSendCallback?.(text);
	}

	private autoGrow(): void {
		this.textarea.style.height = 'auto';
		this.textarea.style.height = `${Math.min(this.textarea.scrollHeight, 160)}px`;
	}
}
