/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, MutableDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { IMenuEntryActionViewItemOptions, MenuEntryActionViewItem } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { Action2, MenuId, MenuItemAction, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { ContextKeyExpr, IContextKey, IContextKeyService, RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IPromptEnhancementService } from '../../../../../ai/enhance/promptEnhancementService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../common/contributions.js';
import { CHAT_CATEGORY } from '../../../chat/browser/actions/chatActions.js';
import { IChatExecuteActionContext } from '../../../chat/browser/actions/chatExecuteActions.js';
import { IChatWidgetService, IChatWidget } from '../../../chat/browser/chat.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import { parseFewStepsAwayModelId } from '../fewStepsAwayLanguageModelProvider.js';
import { Event } from '../../../../../base/common/event.js';

const FEWSTEPSAWAY_ENHANCE_PROMPT_IN_PROGRESS_KEY = 'fewstepsaway.enhancePromptInProgress';

export const FewStepsAwayEnhancePromptContextKeys = {
	InProgress: new RawContextKey<boolean>(FEWSTEPSAWAY_ENHANCE_PROMPT_IN_PROGRESS_KEY, false),
} as const;

let enhancePromptInProgressKey: IContextKey<boolean> | undefined;

function setEnhancePromptInProgress(inProgress: boolean): void {
	enhancePromptInProgressKey?.set(inProgress);
}

class EnhancePromptActionViewItem extends MenuEntryActionViewItem {

	private readonly _iconClassDispose = this._register(new MutableDisposable());

	constructor(
		action: MenuItemAction,
		options: IMenuEntryActionViewItemOptions | undefined,
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
	) {
		super(action, options, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);

		this._register(this._contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(new Set([FEWSTEPSAWAY_ENHANCE_PROMPT_IN_PROGRESS_KEY]))) {
				this._updateEnhanceState();
			}
		}));
	}

	override render(container: HTMLElement): void {
		super.render(container);
		this._updateEnhanceState();
	}

	override async onClick(event: MouseEvent): Promise<void> {
		if (this._isEnhancing()) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		await super.onClick(event);
	}

	protected override updateClass(): void {
		if (!this.options.icon) {
			return;
		}

		this._iconClassDispose.value = undefined;
		const { label } = this;
		if (!label) {
			return;
		}

		const icon = this._isEnhancing()
			? ThemeIcon.modify(Codicon.loading, 'spin')
			: Codicon.sparkle;
		const iconClasses = ThemeIcon.asClassNameArray(icon);
		label.classList.add(...iconClasses);
		this._iconClassDispose.value = toDisposable(() => label.classList.remove(...iconClasses));
	}

	protected override getTooltip(): string {
		if (this._isEnhancing()) {
			return localize('fewstepsaway.chat.enhancePrompt.enhancing', "Enhancing prompt…");
		}
		return super.getTooltip();
	}

	private _isEnhancing(): boolean {
		return !!this._contextKeyService.getContextKeyValue<boolean>(FEWSTEPSAWAY_ENHANCE_PROMPT_IN_PROGRESS_KEY);
	}

	private _updateEnhanceState(): void {
		const enhancing = this._isEnhancing();
		if (this.element) {
			this.element.classList.toggle('disabled', enhancing);
			this.element.setAttribute('aria-disabled', String(enhancing));
		}
		this.updateClass();
		this.updateTooltip();
	}
}

export class EnhancePromptAction extends Action2 {
	static readonly ID = 'fewstepsaway.chat.enhancePrompt';

	constructor() {
		super({
			id: EnhancePromptAction.ID,
			title: localize2('fewstepsaway.chat.enhancePrompt.label', "Enhance Prompt"),
			tooltip: localize('fewstepsaway.chat.enhancePrompt.tooltip', "Enhance prompt"),
			category: CHAT_CATEGORY,
			f1: false,
			icon: Codicon.sparkle,
			precondition: ContextKeyExpr.and(
				ChatContextKeys.enabled,
				FewStepsAwayEnhancePromptContextKeys.InProgress.negate(),
			),
			menu: {
				id: MenuId.ChatExecute,
				group: 'navigation',
				// 3.9 sits between voice mic (order 3) and send (order 4).
				order: 3.9,
				when: ContextKeyExpr.and(
					ChatContextKeys.enabled,
					ChatContextKeys.location.isEqualTo(ChatAgentLocation.Chat),
					ChatContextKeys.requestInProgress.negate(),
				),
			},
		});
	}

	override async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {
		const widgetService = accessor.get(IChatWidgetService);
		const enhancementService = accessor.get(IPromptEnhancementService);
		const notificationService = accessor.get(INotificationService);
		const logService = accessor.get(ILogService);

		const context = args[0] as IChatExecuteActionContext | undefined;
		const widget = this.resolveWidget(context, widgetService);
		if (!widget) {
			notificationService.warn(localize(
				'fewstepsaway.chat.enhancePrompt.noWidget',
				"Could not find the chat input. Click inside the chat box and try again.",
			));
			return;
		}

		const inputEditor = widget.input.inputEditor;
		const draft = inputEditor.getValue().trim();

		if (!draft) {
			const description = localize(
				'fewstepsaway.chat.enhancePrompt.emptyDescription',
				"Type a draft prompt here, then click Enhance (✨) to rewrite it into a clearer, more specific version using AI before you send.",
			);
			widget.input.setValue(description, false);
			inputEditor.focus();
			return;
		}

		const preferredProviderId = this.getPreferredProviderId(widget);

		setEnhancePromptInProgress(true);
		try {
			const enhanced = await enhancementService.enhance(draft, preferredProviderId);

			const next = enhanced.trim();
			if (!next) {
				throw new Error(localize(
					'fewstepsaway.chat.enhancePrompt.emptyResult',
					"The AI returned an empty response. Check your provider API key and try again.",
				));
			}

			widget.input.setValue(next, false);
			inputEditor.focus();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logService.error('[EnhancePromptAction] Failed to enhance prompt:', err);
			notificationService.error(message);
		} finally {
			setEnhancePromptInProgress(false);
		}
	}

	private resolveWidget(context: IChatExecuteActionContext | undefined, widgetService: IChatWidgetService): IChatWidget | undefined {
		if (context?.widget) {
			return context.widget;
		}
		return widgetService.lastFocusedWidget
			?? widgetService.getWidgetsByLocations(ChatAgentLocation.Chat)[0];
	}

	private getPreferredProviderId(widget: IChatWidget): string | undefined {
		const selectedModelId = widget.input.currentLanguageModel;
		return selectedModelId ? parseFewStepsAwayModelId(selectedModelId)?.providerId : undefined;
	}
}

class FewStepsAwayEnhancePromptRendering extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewStepsAwayEnhancePromptRendering';

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IActionViewItemService actionViewItemService: IActionViewItemService,
	) {
		super();

		enhancePromptInProgressKey = FewStepsAwayEnhancePromptContextKeys.InProgress.bindTo(contextKeyService);

		const onEnhanceStateChange = Event.filter(
			contextKeyService.onDidChangeContext,
			e => e.affectsSome(new Set([FEWSTEPSAWAY_ENHANCE_PROMPT_IN_PROGRESS_KEY])),
		);

		this._register(actionViewItemService.register(
			MenuId.ChatExecute,
			EnhancePromptAction.ID,
			(action, options, instantiationService) => {
				if (action instanceof MenuItemAction) {
					return instantiationService.createInstance(EnhancePromptActionViewItem, action, options);
				}
				return undefined;
			},
			onEnhanceStateChange,
		));
	}
}

registerAction2(EnhancePromptAction);

registerWorkbenchContribution2(
	FewStepsAwayEnhancePromptRendering.ID,
	FewStepsAwayEnhancePromptRendering,
	WorkbenchPhase.AfterRestored,
);
