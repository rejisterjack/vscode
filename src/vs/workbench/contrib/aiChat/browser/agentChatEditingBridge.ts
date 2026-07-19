/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IChatService } from '../../chat/common/chatService/chatService.js';
import { ChatModel } from '../../chat/common/model/chatModel.js';
import { IChatEditingService } from '../../chat/common/editing/chatEditingService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ComposerHunk } from '../../../../ai/composer/composerTypes.js';
import { buildHunkTextEdits } from '../../../../ai/composer/composerHunkUtils.js';

/**
 * Bridges FewStepsAway agent file edits into VS Code chat editing sessions
 * for inline diff overlays and checkpoint timeline support.
 */
export class FewStepsAwayChatEditingBridge extends Disposable {
	constructor(
		@IChatService private readonly chatService: IChatService,
		@IChatEditingService private readonly chatEditingService: IChatEditingService,
	) {
		super();
	}

	notifyFileEdit(
		sessionResource: URI,
		fileUri: URI,
		original: string,
		modified: string,
		hunks?: readonly ComposerHunk[],
	): void {
		const session = this.chatService.getSession(sessionResource);
		if (!session || !(session instanceof ChatModel)) {
			return;
		}
		const model = session as ChatModel;
		const editingSession = this.chatEditingService.startOrContinueGlobalEditingSession(model);
		if (!editingSession) {
			return;
		}
		const request = model.getRequests().at(-1);
		if (!request) {
			return;
		}
		const edits = hunks && hunks.length > 0
			? buildHunkTextEdits(hunks)
			: buildFullFileTextEdit(original, modified);
		model.acceptResponseProgress(request, {
			kind: 'textEdit',
			uri: fileUri,
			edits,
			done: true,
		});
	}
}

function buildFullFileTextEdit(original: string, modified: string): import('../../../../editor/common/languages.js').TextEdit[] {
	const originalLines = original.split('\n');
	const lineCount = Math.max(originalLines.length, 1);
	return [{
		range: new Range(1, 1, lineCount, (originalLines[lineCount - 1]?.length ?? 0) + 1),
		text: modified,
	}];
}

class FewStepsAwayChatEditingBridgeContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.fewstepsaway.chatEditingBridge';

	private static _instance: FewStepsAwayChatEditingBridge | undefined;

	constructor(
		@IChatService chatService: IChatService,
		@IChatEditingService chatEditingService: IChatEditingService,
	) {
		super();
		FewStepsAwayChatEditingBridgeContribution._instance = new FewStepsAwayChatEditingBridge(chatService, chatEditingService);
	}

	static getInstance(): FewStepsAwayChatEditingBridge | undefined {
		return FewStepsAwayChatEditingBridgeContribution._instance;
	}
}

registerWorkbenchContribution2(
	FewStepsAwayChatEditingBridgeContribution.ID,
	FewStepsAwayChatEditingBridgeContribution,
	WorkbenchPhase.AfterRestored,
);

export function getChatEditingBridge(): FewStepsAwayChatEditingBridge | undefined {
	return FewStepsAwayChatEditingBridgeContribution.getInstance();
}
