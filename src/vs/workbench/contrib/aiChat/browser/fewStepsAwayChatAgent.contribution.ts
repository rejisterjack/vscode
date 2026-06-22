/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IChatAgentService } from '../../chat/common/participants/chatAgents.js';
import { ChatAgentLocation, ChatModeKind } from '../../chat/common/constants.js';
import { FewStepsAwayChatAgent } from './fewStepsAwayChatAgent.js';

const AGENT_DEFINITIONS: ReadonlyArray<{ id: string; mode: ChatModeKind; description: string }> = [
	{
		id: 'fewstepsaway.chat',
		mode: ChatModeKind.Ask,
		description: localize2('fewstepsawayChatAgentAsk', "Ask questions about your code").value,
	},
	{
		id: 'fewstepsaway.edits',
		mode: ChatModeKind.Edit,
		description: localize2('fewstepsawayChatAgentEdit', "Edit code in your workspace").value,
	},
	{
		id: 'fewstepsaway.agent',
		mode: ChatModeKind.Agent,
		description: localize2('fewstepsawayChatAgentAgent', "Run an AI agent in your workspace").value,
	},
];

export class FewStepsAwayChatAgentContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fewStepsAwayChatAgent';

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		const chatAgentService = instantiationService.invokeFunction(accessor => accessor.get(IChatAgentService));
		const agentImpl = instantiationService.createInstance(FewStepsAwayChatAgent);
		this._register(agentImpl);

		for (const { id, mode, description } of AGENT_DEFINITIONS) {
			const store = new DisposableStore();
			store.add(chatAgentService.registerAgent(id, {
				id,
				name: 'FewStepsAway',
				fullName: 'FewStepsAway',
				isDefault: true,
				isCore: true,
				modes: [mode],
				slashCommands: [],
				disambiguation: [],
				locations: [ChatAgentLocation.Chat],
				description,
				extensionId: nullExtensionDescription.identifier,
				extensionVersion: undefined,
				extensionDisplayName: nullExtensionDescription.name,
				extensionPublisherId: nullExtensionDescription.publisher,
				metadata: {},
			}));
			store.add(chatAgentService.registerAgentImplementation(id, agentImpl));
			this._register(store);
		}
	}
}

registerWorkbenchContribution2(
	FewStepsAwayChatAgentContribution.ID,
	FewStepsAwayChatAgentContribution,
	WorkbenchPhase.BlockStartup,
);
