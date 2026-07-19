/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { URI } from '../../../../base/common/uri.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { IViewDescriptorService, IViewsRegistry, IViewContainersRegistry, Extensions as ViewExtensions } from '../../../common/views.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IReviewFindingsService } from '../../../../ai/review/reviewFindingsService.js';
import { FewStepsAwayChatContainerId } from './aiChatIds.js';
import { registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { sendFewStepsAwayMessage } from './fewStepsAwayChatUtils.js';

export const ReviewFindingsViewId = 'fewstepsaway.reviewFindings';

class ReviewFindingsViewPane extends ViewPane {
	private listContainer: HTMLElement | undefined;
	private readonly localDisposables = this._register(new DisposableStore());

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService private readonly openerService: IOpenerService,
		@ICommandService private readonly commandService: ICommandService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IReviewFindingsService private readonly reviewFindings: IReviewFindingsService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.listContainer = append(container, $('.fewstepsaway-review-findings'));
		this.localDisposables.add(this.reviewFindings.onDidChange(() => this.renderList()));
		this.renderList();
	}

	private renderList(): void {
		if (!this.listContainer) {
			return;
		}
		clearNode(this.listContainer);
		const findings = this.reviewFindings.getFindings();
		if (findings.length === 0) {
			append(this.listContainer, $('p', undefined, localize('fewstepsaway.review.empty', "No review findings yet. Run Review Changes to analyze your diff.")));
			return;
		}
		for (const [index, finding] of findings.entries()) {
			const row = append(this.listContainer, $('div.fewstepsaway-review-finding'));
			append(row, $('div.finding-header', undefined, `[${finding.severity}] ${finding.file ?? 'general'}${finding.line ? `:${finding.line}` : ''}`));
			append(row, $('div.finding-message', undefined, finding.message));
			const actions = append(row, $('div.finding-actions'));
			if (finding.file) {
				const open = append(actions, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
				open.textContent = localize('fewstepsaway.review.open', "Open");
				open.onclick = () => {
					const uri = URI.file(finding.file!);
					void this.openerService.open(finding.line ? uri.with({ fragment: `L${finding.line}` }) : uri);
				};
			}
			const fix = append(actions, $('button.fewstepsaway-composer-btn')) as HTMLButtonElement;
			fix.textContent = localize('fewstepsaway.review.fix', "Fix with AI");
			fix.onclick = () => {
				void this.commandService.executeCommand('fewstepsaway.review.fixFinding', { index });
			};
		}
	}
}

class ReviewPanelContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.fewstepsaway.reviewPanel';

	constructor() {
		const container = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).get(FewStepsAwayChatContainerId);
		if (!container) {
			return;
		}
		Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
			id: ReviewFindingsViewId,
			name: localize2('fewstepsaway.review.view', "Review Findings"),
			ctorDescriptor: new SyncDescriptor(ReviewFindingsViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			order: 3,
			weight: 20,
		}], container);
	}
}

registerWorkbenchContribution2(ReviewPanelContribution.ID, ReviewPanelContribution, WorkbenchPhase.BlockStartup);

registerAction2(class FixReviewFindingAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.review.fixFinding',
			title: localize2('fewstepsaway.review.fixFinding', "Fix Review Finding"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
		});
	}

	async run(accessor: ServicesAccessor, args?: { index: number }): Promise<void> {
		const reviewFindings = accessor.get(IReviewFindingsService);
		const finding = reviewFindings.getFindings()[args?.index ?? 0];
		if (!finding) {
			return;
		}
		const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ''}` : 'the codebase';
		await sendFewStepsAwayMessage(accessor, `Fix this review finding in ${location}:\n\n${finding.message}`);
	}
});

registerAction2(class ShowReviewFindingsAction extends Action2 {
	constructor() {
		super({
			id: 'fewstepsaway.review.showPanel',
			title: localize2('fewstepsaway.review.showPanel', "Show Review Findings"),
			category: localize2('fewstepsaway.category', "FewStepsAway"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView(ReviewFindingsViewId, true);
	}
});
