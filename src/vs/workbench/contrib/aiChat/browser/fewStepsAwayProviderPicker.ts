/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { renderLabelWithIcons } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { IAction } from '../../../../base/common/actions.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, IObservable, observableValue } from '../../../../base/common/observable.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuItemAction, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IActionWidgetService } from '../../../../platform/actionWidget/browser/actionWidget.js';
import { IActionWidgetDropdownAction, IActionWidgetDropdownActionProvider, IActionWidgetDropdownOptions } from '../../../../platform/actionWidget/browser/actionWidgetDropdown.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IProviderRegistry } from '../../../../ai/common/types/provider.types.js';
import { AI_CHAT_HIDE_BUILTIN_MODES_KEY, FEWSTEPSAWAY_OPEN_PROVIDER_SETTINGS_COMMAND_ID } from '../../../../ai/mode/modeIcons.js';
import { compareProviderIds } from '../../../../ai/provider/providerOrder.js';
import { CHAT_CATEGORY } from '../../chat/browser/actions/chatActions.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { ChatContextKeys } from '../../chat/common/actions/chatContextKeys.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
import { ILanguageModelsService } from '../../chat/common/languageModels.js';
import { ChatInputPickerActionViewItem, IChatInputPickerOptions } from '../../chat/browser/widget/input/chatInputPickerActionItem.js';

export interface IProviderPickerDelegate {
	readonly currentProviderId: IObservable<string>;
	setProvider(providerId: string): Promise<void>;
	getProviders(): ReadonlyArray<{ id: string; name: string }>;
}

export class ProviderPickerActionItem extends ChatInputPickerActionViewItem {

	constructor(
		action: MenuItemAction,
		private readonly delegate: IProviderPickerDelegate,
		pickerOptions: IChatInputPickerOptions,
		@IActionWidgetService actionWidgetService: IActionWidgetService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ITelemetryService telemetryService: ITelemetryService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		const actionProvider: IActionWidgetDropdownActionProvider = {
			getActions: () => {
				const providers = [...delegate.getProviders()].sort((a, b) => compareProviderIds(a.id, b.id));
				const currentId = delegate.currentProviderId.get();
				return providers.map(provider => ({
					id: provider.id,
					label: provider.name,
					enabled: true,
					checked: provider.id === currentId,
					class: undefined,
					tooltip: provider.name,
					run: () => { void delegate.setProvider(provider.id); },
				} satisfies IActionWidgetDropdownAction));
			}
		};

		const actionWithLabel: IAction = {
			...action,
			label: delegate.getProviders().find(p => p.id === delegate.currentProviderId.get())?.name
				?? delegate.currentProviderId.get(),
			run: () => { }
		};

		const options: Omit<IActionWidgetDropdownOptions, 'label' | 'labelRenderer'> = {
			actionProvider,
			actionBarActionProvider: {
				getActions: () => [{
					id: 'fewstepsaway.configureProviders',
					label: localize('fewstepsaway.configureProviders', "Configure AI Providers..."),
					enabled: true,
					tooltip: localize('fewstepsaway.configureProviders.tooltip', "Add API keys and configure AI model providers"),
					class: undefined,
					run: () => this.commandService.executeCommand(FEWSTEPSAWAY_OPEN_PROVIDER_SETTINGS_COMMAND_ID),
				}]
			},
		};

		super(actionWithLabel, options, pickerOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService);

		this._register(autorun((reader) => {
			delegate.currentProviderId.read(reader);
			if (this.element) {
				this.renderLabel(this.element);
			}
		}));
	}

	protected override renderLabel(element: HTMLElement): IDisposable | null {
		const providerId = this.delegate.currentProviderId.get();
		const label = this.delegate.getProviders().find(p => p.id === providerId)?.name ?? providerId;
		dom.reset(element,
			dom.$('span.chat-input-picker-label', undefined, label),
			...renderLabelWithIcons(`$(chevron-down)`));
		element.ariaLabel = localize('fewstepsaway.providerPicker.ariaLabel', "Pick AI provider, {0}", label);
		return null;
	}
}

export class OpenProviderPickerAction extends Action2 {
	static readonly ID = 'fewstepsaway.chat.openProviderPicker';

	constructor() {
		super({
			id: OpenProviderPickerAction.ID,
			title: localize2('fewstepsaway.openProviderPicker', "Open Provider Picker"),
			tooltip: localize('fewstepsaway.openProviderPicker.tooltip', "Select AI provider"),
			category: CHAT_CATEGORY,
			f1: false,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatInput,
				order: 2,
				group: 'navigation',
				when: ContextKeyExpr.and(
					ChatContextKeys.enabled,
					ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Chat),
					ContextKeyExpr.equals(`config.${AI_CHAT_HIDE_BUILTIN_MODES_KEY}`, true),
				),
			},
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const widgetService = accessor.get(IChatWidgetService);
		const widget = widgetService.lastFocusedWidget;
		widget?.input.openProviderPicker();
	}
}

export function registerFewStepsAwayProviderPickerActions(): void {
	registerAction2(OpenProviderPickerAction);
}

export function createProviderPickerDelegate(
	providerRegistry: IProviderRegistry,
	configurationService: IConfigurationService,
	languageModelsService: ILanguageModelsService,
	onProviderChanged: () => void,
): IProviderPickerDelegate {
	const currentProviderId = observableValue<string>('fewstepsawayCurrentProvider', configurationService.getValue<string>('ai.provider.default') ?? 'openai');

	configurationService.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('ai.provider.default')) {
			currentProviderId.set(configurationService.getValue<string>('ai.provider.default') ?? 'openai', undefined);
		}
	});

	return {
		currentProviderId,
		getProviders: () => providerRegistry.getAllProviders().map((p) => ({ id: p.id, name: p.name })),
		setProvider: async (providerId: string) => {
			await configurationService.updateValue('ai.provider.default', providerId);
			currentProviderId.set(providerId, undefined);
			await languageModelsService.selectLanguageModels({ vendor: providerId });
			onProviderChanged();
		},
	};
}
