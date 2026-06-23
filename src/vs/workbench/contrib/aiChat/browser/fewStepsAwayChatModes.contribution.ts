/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../base/common/resources.js';
import { IAIService } from '../../../../ai/common/types/provider.types.js';
import { AIMode } from '../../../../ai/common/types/ai.types.js';
import { getBuiltinModes } from '../../../../ai/mode/modes.contribution.js';
import { IModeRegistry } from '../../../../ai/mode/modeRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { IPromptsService } from '../../chat/common/promptSyntax/service/promptsService.js';
import { PromptsType } from '../../chat/common/promptSyntax/promptTypes.js';

/** Bump when bundled agent definitions change to refresh user-data copies. */
const AGENTS_BUNDLE_VERSION = 1;

function escapeYamlSingleQuoted(value: string): string {
	return value.replace(/'/g, '\'\'');
}

function buildAgentMarkdown(mode: { id: AIMode; displayName: string; description: string; systemPrompt: string }): string {
	return [
		'---',
		`name: '${escapeYamlSingleQuoted(mode.displayName)}'`,
		`description: '${escapeYamlSingleQuoted(mode.description)}'`,
		'advancedOptions:',
		`  fewstepsawayMode: ${mode.id}`,
		'---',
		mode.systemPrompt.trim(),
		'',
	].join('\n');
}

/**
 * Registers Kilocode-style chat modes (Code, Ask, Architect, Debug, Plan, Learning)
 * as custom agents in VS Code's native mode picker.
 */
export class FewStepsAwayChatModesContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewStepsAwayChatModes';

	private readonly registrations = this._register(new DisposableStore());

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IPromptsService private readonly promptsService: IPromptsService,
		@IModeRegistry private readonly modeRegistry: IModeRegistry,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IAIService _aiService: IAIService,
	) {
		super();
		void this.registerKilocodeModes();
	}

	private async registerKilocodeModes(): Promise<void> {
		const agentsDir = joinPath(this.environmentService.userRoamingDataHome, 'fewstepsaway', 'agents');
		const versionUri = joinPath(agentsDir, '.bundle-version');

		try {
			await this.fileService.createFolder(agentsDir);
		} catch {
			// Folder may already exist.
		}

		let needsRewrite = true;
		try {
			const versionContent = await this.fileService.readFile(versionUri);
			needsRewrite = versionContent.value.toString() !== String(AGENTS_BUNDLE_VERSION);
		} catch {
			needsRewrite = true;
		}

		const modes = getBuiltinModes();
		if (needsRewrite) {
			for (const mode of modes) {
				const uri = joinPath(agentsDir, `${mode.id}.agent.md`);
				await this.fileService.writeFile(uri, VSBuffer.fromString(buildAgentMarkdown(mode)));
			}
			await this.fileService.writeFile(versionUri, VSBuffer.fromString(String(AGENTS_BUNDLE_VERSION)));
		}

		this.registrations.clear();
		for (const mode of modes) {
			const uri = joinPath(agentsDir, `${mode.id}.agent.md`);
			this.registrations.add(this.promptsService.registerContributedFile(
				PromptsType.agent,
				uri,
				nullExtensionDescription,
				mode.displayName,
				mode.description,
			));
		}

		// Default to Code mode when unset.
		const current = this.configurationService.getValue<AIMode>('ai.chat.mode');
		if (!current || !modes.some(m => m.id === current)) {
			await this.configurationService.updateValue('ai.chat.mode', 'coding');
		}
		if (this.modeRegistry.getMode('coding')) {
			this.modeRegistry.setActiveMode('coding');
		}
	}
}

registerWorkbenchContribution2(
	FewStepsAwayChatModesContribution.ID,
	FewStepsAwayChatModesContribution,
	WorkbenchPhase.AfterRestored,
);
