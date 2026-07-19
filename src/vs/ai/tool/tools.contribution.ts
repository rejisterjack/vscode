/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { IToolRegistry, ToolRegistry } from './toolRegistry.js';
import { ReadFileTool } from './tools/readTool.js';
import { WriteFileTool } from './tools/writeTool.js';
import { EditFileTool } from './tools/editTool.js';
import { GlobTool } from './tools/globTool.js';
import { GrepTool } from './tools/grepTool.js';
import { BashTool } from './tools/bashTool.js';
import { WebFetchTool } from './tools/webfetchTool.js';
import { WebSearchTool } from './tools/websearchTool.js';
import { TodoWriteTool } from './tools/todoTool.js';
import { QuestionTool } from './tools/questionTool.js';
import { ApplyPatchTool } from './tools/applyPatchTool.js';
import { CodebaseSearchTool } from './tools/codebaseSearchTool.js';

registerSingleton(IToolRegistry, ToolRegistry, InstantiationType.Delayed);

/**
 * Register all built-in tools. Called once at startup. Each tool is created
 * via the instantiation service so its DI dependencies are resolved.
 */
export function registerBuiltinTools(instantiationService: IInstantiationService): void {
	const registry = instantiationService.invokeFunction(accessor => accessor.get(IToolRegistry));
	const tools = [
		instantiationService.createInstance(ReadFileTool),
		instantiationService.createInstance(WriteFileTool),
		instantiationService.createInstance(EditFileTool),
		instantiationService.createInstance(ApplyPatchTool),
		instantiationService.createInstance(GlobTool),
		instantiationService.createInstance(GrepTool),
		instantiationService.createInstance(BashTool),
		instantiationService.createInstance(WebFetchTool),
		instantiationService.createInstance(WebSearchTool),
		instantiationService.createInstance(TodoWriteTool),
		instantiationService.createInstance(QuestionTool),
		instantiationService.createInstance(CodebaseSearchTool),
	];
	for (const tool of tools) {
		registry.register(tool);
	}
}
