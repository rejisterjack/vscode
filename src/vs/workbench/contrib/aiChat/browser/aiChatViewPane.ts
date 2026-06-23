/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import '../../chat/browser/widgetHosts/viewPane/media/chatViewPane.css';

import { $, append, getWindow } from '../../../../base/browser/dom.js';
import { MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { editorBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { SIDE_BAR_FOREGROUND } from '../../../common/theme.js';
import { ChatWidget } from '../../chat/browser/widget/chatWidget.js';
import { IChatModelReference, IChatService } from '../../chat/common/chatService/chatService.js';
import { IChatModeService } from '../../chat/common/chatModes.js';
import { ChatAgentLocation, ChatModeKind } from '../../chat/common/constants.js';
import { AI_CHAT_HIDE_BUILTIN_MODES_KEY } from '../../../../ai/mode/modeIcons.js';
import { FewStepsAwayChatViewId } from './aiChatIds.js';
import { findFewStepsAwayMode, isHiddenBuiltinMode } from './fewStepsAwayModeUtils.js';

/**
 * FewStepsAway chat view using VS Code's native ChatWidget.
 */
export class FewStepsAwayChatViewPane extends ViewPane {

	private _widget!: ChatWidget;
	private readonly modelRef = this._register(new MutableDisposable<IChatModelReference>());
	private initializingModel = false;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ILogService private readonly logService: ILogService,
		@IChatService private readonly chatService: IChatService,
		@IChatModeService private readonly chatModeService: IChatModeService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		container.classList.add('chat-viewpane');

		const chatControlsContainer = append(container, $('.chat-controls-container'));
		const locationBasedColors = this.getLocationBasedColors();

		const editorOverflowWidgetsDomNode = this.layoutService
			.getContainer(getWindow(chatControlsContainer))
			.appendChild($('.chat-editor-overflow.monaco-editor'));
		this._register(toDisposable(() => editorOverflowWidgetsDomNode.remove()));

		const scopedInstantiationService = this._register(this.instantiationService.createChild(
			new ServiceCollection([IContextKeyService, this.scopedContextKeyService])
		));

		this._widget = this._register(scopedInstantiationService.createInstance(
			ChatWidget,
			ChatAgentLocation.Chat,
			{ viewId: FewStepsAwayChatViewId },
			{
				autoScroll: mode => mode !== ChatModeKind.Ask,
				renderFollowups: true,
				supportsFileReferences: true,
				clear: () => this.clearChat(),
				rendererOptions: {
					renderTextEditsAsSummary: () => true,
					referencesExpandedWhenEmptyResponse: false,
					progressMessageAtBottomOfResponse: mode => mode !== ChatModeKind.Ask,
				},
				editorOverflowWidgetsDomNode,
				enableImplicitContext: true,
				enableWorkingSet: 'explicit',
				supportsChangingModes: true,
				dndContainer: container,
				defaultMode: findFewStepsAwayMode(this.chatModeService, 'coding'),
			},
			{
				listForeground: SIDE_BAR_FOREGROUND,
				listBackground: locationBasedColors.background,
				overlayBackground: locationBasedColors.overlayBackground,
				inputEditorBackground: locationBasedColors.background,
				resultEditorBackground: editorBackground,
			},
		));

		this._widget.render(chatControlsContainer);

		this._register(this.chatModeService.onDidChangeChatModes(() => this.applyFewStepsAwayDefaultMode()));
		this.applyFewStepsAwayDefaultMode();

		this._register(this.onDidChangeBodyVisibility(visible => {
			this._widget.setVisible(visible);
			if (visible) {
				void this.ensureModel();
			}
		}));

		this._widget.setVisible(this.isBodyVisible());
		void this.ensureModel();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this._widget?.layout(height, width);
	}

	override focus(): void {
		super.focus();
		this._widget?.focusInput();
	}

	override setExpanded(expanded: boolean): boolean {
		const changed = super.setExpanded(expanded);
		if (changed && expanded) {
			void this.ensureModel();
		}
		return changed;
	}

	private async ensureModel(): Promise<void> {
		if (this.modelRef.value || this.initializingModel || !this._widget) {
			return;
		}

		this.initializingModel = true;
		try {
			const ref = this.chatService.startSession(ChatAgentLocation.Chat);
			this.modelRef.value = ref;
			this._widget.setModel(ref.object);
		} catch (err) {
			this.logService.error('[FewStepsAwayChatViewPane] Failed to start chat session:', err);
		} finally {
			this.initializingModel = false;
		}
	}

	private async clearChat(): Promise<void> {
		this.modelRef.clear();
		await this.ensureModel();
	}

	private applyFewStepsAwayDefaultMode(): void {
		if (!this.configurationService.getValue<boolean>(AI_CHAT_HIDE_BUILTIN_MODES_KEY)) {
			return;
		}
		const input = this._widget?.input;
		if (!input) {
			return;
		}
		const currentMode = input.currentModeObs.get();
		if (!isHiddenBuiltinMode(currentMode)) {
			return;
		}
		const codeMode = findFewStepsAwayMode(this.chatModeService, 'coding');
		if (codeMode) {
			input.setChatMode(codeMode.id, false);
		}
	}
}
