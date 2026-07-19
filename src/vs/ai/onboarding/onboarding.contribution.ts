/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { IOnboardingService, OnboardingStep } from './onboardingTypes.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';

export class OnboardingService extends Disposable implements IOnboardingService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService
	) {
		super();
	}

	async generateOrientation(role?: string): Promise<OnboardingStep[]> {
		const folders = this.workspaceService.getWorkspace().folders;
		const root = folders[0]?.name ?? 'workspace';
		return [
			{
				id: 'welcome',
				title: 'Welcome',
				description: `Orientation for ${role ?? 'developer'} in ${root}. Explore architecture, key modules, and workflows.`,
			},
			{
				id: 'architecture',
				title: 'Architecture overview',
				description: 'Review top-level folders, package boundaries, and how services connect.',
			},
			{
				id: 'workflows',
				title: 'Common workflows',
				description: 'Build, test, and deploy commands used by this team.',
			},
		];
	}

	async answerWhy(question: string, filePath?: string): Promise<string> {
		const scope = filePath ? ` for ${filePath}` : '';
		return `Historical context${scope}: ${question}\n\nUse git log, PR discussions, and ADRs to ground this answer. Org-Brain will enrich this when connected to the platform index.`;
	}
}

registerSingleton(IOnboardingService, OnboardingService, InstantiationType.Delayed);
