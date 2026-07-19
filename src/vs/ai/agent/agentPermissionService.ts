/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';

export const IAgentPermissionService = createDecorator<IAgentPermissionService>('ai.agentPermissionService');

export interface IAgentPermissionService {
	readonly _serviceBrand: undefined;
	ask(prompt: string): Promise<boolean>;
}

export class AgentPermissionService implements IAgentPermissionService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IDialogService private readonly dialogService: IDialogService,
	) { }

	async ask(prompt: string): Promise<boolean> {
		const result = await this.dialogService.confirm({
			message: prompt,
			primaryButton: 'Allow',
			cancelButton: 'Deny',
		});
		return result.confirmed;
	}
}
