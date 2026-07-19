/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../base/common/uri.js';
import { IFileService } from '../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';

export const IRulesLoader = createDecorator<IRulesLoader>('ai.rulesLoader');

export interface IRulesLoader {
	readonly _serviceBrand: undefined;
	loadWorkspaceRules(): Promise<string>;
}

const RULE_FILENAMES = [
	'AGENTS.md',
	'.cursor/rules',
	'.fewstepsaway/rules.md',
];

export class RulesLoader implements IRulesLoader {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
	) { }

	async loadWorkspaceRules(): Promise<string> {
		const folders = this.workspaceService.getWorkspace().folders;
		const parts: string[] = [];
		for (const folder of folders) {
			for (const name of RULE_FILENAMES) {
				const uri = URI.joinPath(folder.uri, name);
				try {
					const stat = await this.fileService.resolve(uri);
					if (stat.isDirectory) {
						const children = await this.fileService.resolve(uri, { resolveMetadata: true });
						for (const child of children.children ?? []) {
							if (!child.isDirectory && child.name.endsWith('.md')) {
								const content = await this.fileService.readFile(child.resource);
								parts.push(`## ${child.resource.path}\n${content.value.toString()}`);
							}
						}
					} else {
						const content = await this.fileService.readFile(uri);
						parts.push(`## ${name}\n${content.value.toString()}`);
					}
				} catch {
					// file not present
				}
			}
		}
		return parts.join('\n\n');
	}
}

registerSingleton(IRulesLoader, RulesLoader, InstantiationType.Delayed);
