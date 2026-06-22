/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

export interface IConnectionErrorInfo {
	readonly friendly: string;
	readonly technical?: string;
}

export function humanizeConnectionError(raw: string): IConnectionErrorInfo {
	if (raw.includes('ENOENT') || raw.includes('not found')) {
		return {
			friendly: localize(
				'fewstepsaway.chat.error.backendMissing',
				"The AI backend is not installed yet. Build the CLI in extensions/fewstepsaway-ai, then retry."
			),
			technical: raw,
		};
	}
	if (raw.includes('spawn') || raw.includes('ECONNREFUSED')) {
		return {
			friendly: localize(
				'fewstepsaway.chat.error.backendStart',
				"Could not start the AI backend. Check that the CLI is built and try again."
			),
			technical: raw,
		};
	}
	if (raw.includes('timeout') || raw.includes('Timeout')) {
		return {
			friendly: localize(
				'fewstepsaway.chat.error.backendTimeout',
				"The AI backend took too long to respond. Try again in a moment."
			),
			technical: raw,
		};
	}
	return {
		friendly: localize('fewstepsaway.chat.error.generic', "Something went wrong connecting to the AI backend."),
		technical: raw,
	};
}
