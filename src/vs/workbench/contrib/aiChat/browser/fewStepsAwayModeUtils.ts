/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getFewStepsAwayModeSortIndex, isFewStepsAwayModeId } from '../../../../ai/mode/modeIcons.js';
import { IChatMode, IChatModeService } from '../../chat/common/chatModes.js';
import { ChatModeKind } from '../../chat/common/constants.js';

export function readPromptMetadataString(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value;
	}
	const nested = (value as { value?: unknown } | null | undefined)?.value;
	if (typeof nested === 'string') {
		return nested;
	}
	return undefined;
}

export function getFewStepsAwayModeId(mode: IChatMode): string | undefined {
	const value = readPromptMetadataString(mode.modeInstructions?.get()?.metadata?.fewstepsawayMode);
	return value && isFewStepsAwayModeId(value) ? value : undefined;
}

export function findFewStepsAwayMode(chatModeService: IChatModeService, modeId: string): IChatMode | undefined {
	return chatModeService.getModes().custom.find(mode => getFewStepsAwayModeId(mode) === modeId);
}

export function compareFewStepsAwayModes(a: IChatMode, b: IChatMode): number {
	const aId = getFewStepsAwayModeId(a);
	const bId = getFewStepsAwayModeId(b);
	if (aId && bId) {
		return getFewStepsAwayModeSortIndex(aId) - getFewStepsAwayModeSortIndex(bId);
	}
	if (aId) {
		return -1;
	}
	if (bId) {
		return 1;
	}
	return a.label.get().localeCompare(b.label.get());
}

export function isHiddenBuiltinMode(mode: IChatMode): boolean {
	return mode.isBuiltin && (mode.kind === ChatModeKind.Agent || mode.kind === ChatModeKind.Edit);
}
