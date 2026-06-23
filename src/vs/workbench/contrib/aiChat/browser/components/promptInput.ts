/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, addDisposableListener, EventType } from '../../../../../base/browser/dom.js';
import { ActionBar, ActionsOrientation } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { Action } from '../../../../../base/common/actions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { AIMode } from '../../../../../ai/common/types/ai.types.js';
import { IModeRegistry } from '../../../../../ai/mode/modeRegistry.js';
import { IModelsDevCatalog } from '../../../../../ai/provider/common/modelsDevCatalog.js';

const MODES: readonly AIMode[] = ['coding', 'ask', 'architect', 'debug', 'plan', 'learning'];

function getModeLabel(mode: AIMode): string {
	switch (mode) {
		case 'coding': return localize('fewstepsaway.mode.coding', "Code");
		case 'ask': return localize('fewstepsaway.mode.ask', "Ask");
		case 'architect': return localize('fewstepsaway.mode.architect', "Architect");
		case 'debug': return localize('fewstepsaway.mode.debug', "Debug");
		case 'plan': return localize('fewstepsaway.mode.plan', "Plan");
		case 'learning': return localize('fewstepsaway.mode.learning', "Learning");
	}
}

/**
 * Cursor-style prompt input: rounded box, mode/model pills, attach + send.
 */
export class PromptInput extends Disposable {
	private readonly container: HTMLElement;
	private readonly textarea: HTMLTextAreaElement;
	private readonly modePill: HTMLElement;
	private readonly modelPill: HTMLElement;
	private readonly sendAction: Action;
	private readonly attachAction: Action;

	private isStreaming = false;
	private isConnected = false;
	private onSendCallback: ((text: string) => void) | null = null;
	private onStopCallback: (() => void) | null = null;
	private modelOptions: string[] = [''];

	constructor(
		parent: HTMLElement,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IModeRegistry private readonly modeRegistry: IModeRegistry,
		@IModelsDevCatalog private readonly modelsCatalog: IModelsDevCatalog,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
	) {
		super();

		this.container = append(parent, $('div.fewstepsaway-chat-prompt-input'));

		const inputBox = append(this.container, $('div.fewstepsaway-chat-input-box'));

		this.textarea = document.createElement('textarea');
		this.textarea.className = 'fewstepsaway-chat-input';
		this.textarea.placeholder = localize('fewstepsaway.chat.input.followUp', "Add a follow-up");
		this.textarea.rows = 1;
		this.textarea.setAttribute('aria-label', localize('fewstepsaway.chat.input.aria', "Chat message input"));
		inputBox.appendChild(this.textarea);

		const footer = append(inputBox, $('div.fewstepsaway-chat-input-footer'));

		const pills = append(footer, $('div.fewstepsaway-chat-input-pills'));
		this.modePill = append(pills, $('button.fewstepsaway-chat-pill.fewstepsaway-chat-mode-pill'));
		this.modelPill = append(pills, $('button.fewstepsaway-chat-pill.fewstepsaway-chat-model-pill'));

		const actions = append(footer, $('div.fewstepsaway-chat-input-actions'));
		const attachContainer = append(actions, $('div'));
		const attachBar = this._register(new ActionBar(attachContainer, { orientation: ActionsOrientation.HORIZONTAL }));
		this.attachAction = this._register(new Action(
			'fewstepsaway.chat.attach',
			'',
			ThemeIcon.asClassName(Codicon.attach),
			true,
			() => { /* future: file attach */ }
		));
		this.attachAction.tooltip = localize('fewstepsaway.chat.attach', "Attach context");
		attachBar.push(this.attachAction, { icon: true, label: false });

		const sendContainer = append(actions, $('div'));
		const sendBar = this._register(new ActionBar(sendContainer, { orientation: ActionsOrientation.HORIZONTAL }));
		this.sendAction = this._register(new Action(
			'fewstepsaway.chat.send',
			'',
			ThemeIcon.asClassName(Codicon.arrowUp),
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

		this.updateModePill();
		void this.refreshModelOptions();

		this._register(addDisposableListener(this.modePill, EventType.CLICK, e => {
			e.preventDefault();
			this.showModeMenu();
		}));

		this._register(addDisposableListener(this.modelPill, EventType.CLICK, e => {
			e.preventDefault();
			this.showModelMenu();
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

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('ai.chat.mode') || e.affectsConfiguration('ai.chat.model')) {
				this.updateModePill();
				void this.refreshModelOptions();
			}
		}));

		this.updateSendEnabled();
	}

	private updateModePill(): void {
		clearChildren(this.modePill);
		const icon = append(this.modePill, $('span.fewstepsaway-chat-pill-icon'));
		icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.sparkle));
		const mode = this.configurationService.getValue<AIMode>('ai.chat.mode') ?? 'coding';
		append(this.modePill, document.createTextNode(getModeLabel(mode)));
		const chevron = append(this.modePill, $('span.fewstepsaway-chat-pill-chevron'));
		chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
	}

	private async refreshModelOptions(): Promise<void> {
		const options = [''];
		const providerId = this.configurationService.getValue<string>('ai.provider.default') ?? 'openai';
		try {
			const models = await this.modelsCatalog.getModels(providerId);
			for (const m of models.slice(0, 20)) {
				options.push(`${providerId}/${m.id}`);
			}
		} catch { /* ignore */ }

		const current = this.configurationService.getValue<string>('ai.chat.model') ?? '';
		if (current && !options.includes(current)) {
			options.push(current);
		}
		this.modelOptions = options;
		this.updateModelPill();
	}

	private updateModelPill(): void {
		clearChildren(this.modelPill);
		const current = this.configurationService.getValue<string>('ai.chat.model') ?? '';
		const label = current
			? (current.includes('/') ? current.split('/').pop()! : current)
			: localize('fewstepsaway.chat.modelAuto', "Auto");
		this.modelPill.appendChild(document.createTextNode(label));
		const chevron = append(this.modelPill, $('span.fewstepsaway-chat-pill-chevron'));
		chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
	}

	private showModeMenu(): void {
		const actions = MODES.map(mode => new Action(
			`fewstepsaway.mode.${mode}`,
			getModeLabel(mode),
			undefined,
			true,
			() => {
				void this.configurationService.updateValue('ai.chat.mode', mode);
				this.modeRegistry.setActiveMode(mode);
				this.updateModePill();
			}
		));
		this.contextMenuService.showContextMenu({
			getAnchor: () => this.modePill.getBoundingClientRect(),
			getActions: () => actions,
		});
	}

	private showModelMenu(): void {
		const actions = this.modelOptions.map((model, i) => new Action(
			`fewstepsaway.model.${i}`,
			model || localize('fewstepsaway.chat.modelAuto', "Auto"),
			undefined,
			true,
			() => {
				void this.configurationService.updateValue('ai.chat.model', model);
				this.updateModelPill();
			}
		));
		this.contextMenuService.showContextMenu({
			getAnchor: () => this.modelPill.getBoundingClientRect(),
			getActions: () => actions,
		});
	}

	setConnected(connected: boolean): void {
		this.isConnected = connected;
		this.textarea.disabled = !connected && !this.isStreaming;
		this.updateSendEnabled();
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
			this.sendAction.class = ThemeIcon.asClassName(Codicon.arrowUp);
			this.sendAction.tooltip = localize('fewstepsaway.chat.send', "Send message");
		}
	}

	private updateSendEnabled(): void {
		this.sendAction.enabled = this.isStreaming || (this.isConnected && this.textarea.value.trim().length > 0);
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
		this.textarea.style.height = `${Math.min(this.textarea.scrollHeight, 200)}px`;
	}
}

function clearChildren(el: HTMLElement): void {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}
