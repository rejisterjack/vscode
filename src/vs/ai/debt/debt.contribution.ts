/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { IFileService } from '../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { IDebtRadarService, DebtScore } from './debtTypes.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';

export class DebtRadarService extends Disposable implements IDebtRadarService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService
	) {
		super();
	}

	scoreFile(uri: URI, content: string): DebtScore {
		const lines = content.split(/\r?\n/);
		const factors: string[] = [];
		let score = 0;

		if (lines.length > 500) {
			score += 15;
			factors.push('Large file (>500 lines)');
		}
		const todoCount = (content.match(/TODO|FIXME|HACK/gi) ?? []).length;
		if (todoCount > 0) {
			score += Math.min(20, todoCount * 5);
			factors.push(`${todoCount} TODO/FIXME markers`);
		}
		const complexity = (content.match(/\b(if|for|while|switch|catch)\b/g) ?? []).length;
		if (complexity > 30) {
			score += 10;
			factors.push('High cyclomatic complexity proxy');
		}
		if (!content.includes('test') && uri.path.includes('/src/')) {
			score += 5;
			factors.push('No test references in file');
		}

		return { uri, score: Math.min(100, score), factors };
	}

	async getHotspots(limit = 20): Promise<DebtScore[]> {
		const scores: DebtScore[] = [];
		for (const folder of this.workspaceService.getWorkspace().folders) {
			await this.walk(folder.uri, scores, 200);
		}
		return scores.sort((a, b) => b.score - a.score).slice(0, limit);
	}

	private async walk(folder: URI, scores: DebtScore[], max: number): Promise<void> {
		if (scores.length >= max) {
			return;
		}
		try {
			const stat = await this.fileService.resolve(folder);
			for (const child of stat.children ?? []) {
				if (scores.length >= max) {
					return;
				}
				if (child.isDirectory) {
					if (['node_modules', '.git', 'dist', 'out'].includes(child.name)) {
						continue;
					}
					await this.walk(child.resource, scores, max);
				} else if (child.name.endsWith('.ts') || child.name.endsWith('.tsx') || child.name.endsWith('.js')) {
					const content = await this.fileService.readFile(child.resource);
					scores.push(this.scoreFile(child.resource, content.value.toString()));
				}
			}
		} catch {
			// skip
		}
	}
}

registerSingleton(IDebtRadarService, DebtRadarService, InstantiationType.Delayed);
