/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export const IOnboardingService = createDecorator<IOnboardingService>('ai.onboardingService');

export interface OnboardingStep {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly fileUri?: string;
}

export interface IOnboardingService {
	readonly _serviceBrand: undefined;

	/**
	 * Generate role-based onboarding steps for "I'm New Here" mode.
	 */
	generateOrientation(role?: string): Promise<OnboardingStep[]>;

	/**
	 * Answer a "why" question about code using git history context.
	 */
	answerWhy(question: string, filePath?: string): Promise<string>;
}
