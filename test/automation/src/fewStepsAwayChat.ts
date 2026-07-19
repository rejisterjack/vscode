/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from './code';

const FEWSTEPSAWAY_CHAT_VIEW = 'div[id="fewstepsaway.panel.chat"]';
const FEWSTEPSAWAY_CHAT_INPUT = `${FEWSTEPSAWAY_CHAT_VIEW} .interactive-input-part .monaco-editor[role="code"]`;

export class FewStepsAwayChat {

	constructor(private readonly code: Code) { }

	async waitForChatView(): Promise<void> {
		await this.code.waitForElement(FEWSTEPSAWAY_CHAT_VIEW);
	}

	async waitForInput(): Promise<void> {
		await this.code.waitForElement(FEWSTEPSAWAY_CHAT_INPUT);
	}
}
