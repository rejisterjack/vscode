/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Stable identifiers for the native FewStepsAway chat view and its container.
 *
 * Kept in a side-effect-free leaf module so that action/command registrations
 * can import these constants without forming an import cycle with
 * `aiChat.contribution.ts` (which registers view descriptors at module load
 * and would otherwise hit a temporal-dead-zone error).
 */
export const FewStepsAwayChatViewId = 'fewstepsaway.chat.nativeView';
export const FewStepsAwayChatContainerId = 'fewstepsaway.panel.chat';
