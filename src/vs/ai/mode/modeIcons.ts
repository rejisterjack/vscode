/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../base/common/codicons.js';
import { ThemeIcon } from '../../base/common/themables.js';
import { AIMode } from '../common/types/ai.types.js';

export const AI_CHAT_HIDE_BUILTIN_MODES_KEY = 'ai.chat.hideBuiltinModes';
export const FEWSTEPSAWAY_OPEN_PROVIDER_SETTINGS_COMMAND_ID = 'fewstepsaway.openProviderSettings';
export const FEWSTEPSAWAY_SIGN_IN_COMMAND_ID = 'fewstepsaway.auth.signIn';
export const FEWSTEPSAWAY_SIGN_OUT_COMMAND_ID = 'fewstepsaway.auth.signOut';

/** Preferred display order for FewStepsAway modes in the mode picker. */
export const FEWSTEPSAWAY_MODE_ORDER: readonly AIMode[] = ['coding', 'ask', 'architect', 'debug', 'plan', 'learning'];

const MODE_ICONS: Record<AIMode, ThemeIcon> = {
	coding: Codicon.code,
	ask: Codicon.commentDiscussion,
	architect: Codicon.symbolStructure,
	debug: Codicon.debugAlt,
	plan: Codicon.tasklist,
	learning: Codicon.mortarBoard,
};

export function isFewStepsAwayModeId(value: string): value is AIMode {
	return value in MODE_ICONS;
}

export function getFewStepsAwayModeIcon(modeId: string): ThemeIcon | undefined {
	return isFewStepsAwayModeId(modeId) ? MODE_ICONS[modeId] : undefined;
}

export function getFewStepsAwayModeSortIndex(modeId: string): number {
	const index = FEWSTEPSAWAY_MODE_ORDER.indexOf(modeId as AIMode);
	return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}
