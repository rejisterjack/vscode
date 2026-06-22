/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { EnablementState } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';

/** Legacy webview-based chat UI — replaced by native aiChat in the auxiliary bar. */
const LEGACY_EXTENSION_ID = 'fewstepsaway.fewstepsaway-ai';

/**
 * Disables the legacy FewStepsAway extension so it does not register
 * editor TabPanels, activity-bar views, or the steps/candle branding icons.
 * The CLI binary under extensions/fewstepsaway-ai/bin/ remains available
 * to the native AIServerMainService.
 */
class DisableLegacyExtensionContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewstepsaway.disableLegacyExtension';

	constructor(
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
	) {
		super();
		void this.disableLegacyExtension();
	}

	private async disableLegacyExtension(): Promise<void> {
		const extensions = await this.extensionsWorkbenchService.queryLocal();
		const legacy = extensions.find(e => ExtensionIdentifier.equals(e.identifier.id, LEGACY_EXTENSION_ID));
		if (!legacy || legacy.enablementState === EnablementState.DisabledGlobally) {
			return;
		}
		await this.extensionsWorkbenchService.setEnablement(legacy, EnablementState.DisabledGlobally);
	}
}

registerWorkbenchContribution2(DisableLegacyExtensionContribution.ID, DisableLegacyExtensionContribution, WorkbenchPhase.AfterRestored);
