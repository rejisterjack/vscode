/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { ILanguageFeaturesService } from '../../editor/common/services/languageFeatures.js';
import { CommandsRegistry } from '../../platform/commands/common/commands.js';
import { renderSupportPrompt, SupportPromptType } from './supportPrompts.js';
import { FewStepsAwayCodeActionProvider } from './codeActionProvider.js';

/**
 * Register the code-action provider and the commands it invokes.
 */
export function registerCodeActions(instantiationService: IInstantiationService): void {
	const languageFeaturesService = instantiationService.invokeFunction(accessor => accessor.get(ILanguageFeaturesService));

	const provider = instantiationService.createInstance(FewStepsAwayCodeActionProvider);
	languageFeaturesService.codeActionProvider.register('*', provider);

	const types: SupportPromptType[] = ['EXPLAIN', 'FIX', 'IMPROVE', 'ADD_TO_CONTEXT'];
	for (const type of types) {
		const commandId = `fewstepsaway.codeAction.${type.toLowerCase()}`;
		CommandsRegistry.registerCommand(commandId, (_accessor, ...args: [string, number, number, string?]) => {
			const [filePath, startLine, endLine] = args;
			return renderSupportPrompt(type, {
				filePath,
				startLine,
				endLine,
				selectedText: '',
				diagnostics: args[3]
			});
		});
	}
}
