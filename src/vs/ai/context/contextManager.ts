/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { IEditorService } from '../../workbench/services/editor/common/editorService.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { IFileService } from '../../platform/files/common/files.js';
import { ITextFileService } from '../../workbench/services/textfile/common/textfiles.js';
import { URI } from '../../base/common/uri.js';

import {
	IContextManager,
	CodeContext,
	ContextOptions,
	ContextChange,
	FileContext,
	EditContext,
	ProjectStructure
} from '../common/types/context.types.js';

/**
 * Context Manager implementation for FewStepAway
 * 
 * Responsible for gathering and managing code context for AI requests.
 * Tracks file changes, open editors, and recent edits to provide
 * relevant context to AI providers.
 */
export class ContextManager extends Disposable implements IContextManager {
	private readonly _onContextChanged = this._register(new Emitter<ContextChange>());
	readonly onContextChanged: Event<ContextChange> = this._onContextChanged.event;

	private recentEdits: EditContext[] = [];
	private readonly maxRecentEdits = 10;
	private readonly defaultMaxTokens = 4000;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@ITextFileService private readonly textFileService: ITextFileService
	) {
		super();
		this.registerListeners();
	}

	private registerListeners(): void {
		// Track active editor changes
		this._register(this.editorService.onDidActiveEditorChange(() => {
			this._onContextChanged.fire({ type: 'activeEditorChanged' });
		}));

		// Track file changes
		this._register(this.fileService.onDidFilesChange(e => {
			this._onContextChanged.fire({
				type: 'filesChanged',
				changes: e.changes
			});
		}));

		// Track text model changes for recent edits
		this._register(this.textFileService.files.onDidSave(e => {
			this.addRecentEdit({
				filePath: e.resource.fsPath,
				change: 'File saved',
				timestamp: Date.now()
			});
		}));
	}

	async gatherContext(options: ContextOptions = {}): Promise<CodeContext> {
		const maxTokens = options.maxTokens || this.defaultMaxTokens;

		const [currentFile, openFiles, recentEdits, projectStructure] = await Promise.all([
			this.getCurrentFileContext(),
			options.includeOpenFiles !== false ? this.getOpenFilesContext() : [],
			options.includeRecentEdits !== false ? this.getRecentEdits() : [],
			options.includeProjectStructure ? this.getProjectStructure() : undefined
		]);

		let context: CodeContext = {
			currentFile,
			openFiles: openFiles.filter(f => f.path !== currentFile?.path),
			recentEdits,
			projectStructure
		};

		// Apply token budget if needed
		const estimatedTokens = this.estimateContextTokens(context);
		if (estimatedTokens > maxTokens) {
			context = this.prioritizeContext(context, maxTokens);
		}

		return context;
	}

	async getCurrentFileContext(): Promise<FileContext | undefined> {
		const activeEditor = this.editorService.activeTextEditorControl;
		if (!activeEditor) {
			return undefined;
		}

		const model = activeEditor.getModel();
		if (!model || !('uri' in model)) {
			return undefined;
		}

		const uri = model.uri;
		const content = model.getValue();
		const position = activeEditor.getPosition();

		return {
			path: uri.fsPath,
			content,
			language: model.getLanguageId?.() || this.detectLanguage(uri.fsPath),
			cursorPosition: position || undefined
		};
	}

	async getOpenFilesContext(): Promise<FileContext[]> {
		const editors = this.editorService.visibleTextEditorControls;
		const files: FileContext[] = [];

		for (const editor of editors) {
			const model = editor.getModel();
			if (!model || !('uri' in model)) {
				continue;
			}

			// Skip if same as active editor
			if (editor === this.editorService.activeTextEditorControl) {
				continue;
			}

			const content = model.getValue();
			// Limit content to first 100 lines to save tokens
			const truncatedContent = this.truncateContent(content, 100);

			files.push({
				path: model.uri.fsPath,
				content: truncatedContent,
				language: model.getLanguageId?.() || this.detectLanguage(model.uri.fsPath)
			});
		}

		return files;
	}

	async getRecentEdits(): Promise<EditContext[]> {
		return this.recentEdits.slice();
	}

	async getProjectStructure(): Promise<ProjectStructure | undefined> {
		const workspace = this.workspaceService.getWorkspace();
		if (!workspace.folders.length) {
			return undefined;
		}

		const rootUri = workspace.folders[0].uri;
		const rootPath = rootUri.fsPath;

		// List source files
		const sourceFiles = await this.listSourceFiles(rootUri);

		return {
			rootPath,
			name: workspace.folders[0].name,
			sourceFiles: sourceFiles.slice(0, 50), // Limit to 50 files
			dependencies: [], // TODO: Parse package.json, requirements.txt, etc.
			framework: undefined // TODO: Detect framework
		};
	}

	updateContext(change: ContextChange): void {
		this._onContextChanged.fire(change);
	}

	async getSelectionContext() {
		// TODO: Implement selection context
		return undefined;
	}

	estimateContextTokens(context: CodeContext): number {
		let total = 0;

		if (context.currentFile) {
			total += this.estimateTokens(context.currentFile.content);
		}

		if (context.openFiles) {
			for (const file of context.openFiles) {
				total += this.estimateTokens(file.content);
			}
		}

		if (context.recentEdits) {
			for (const edit of context.recentEdits) {
				total += this.estimateTokens(edit.change);
			}
		}

		return total;
	}

	prioritizeContext(context: CodeContext, maxTokens: number): CodeContext {
		let tokensUsed = 0;
		const prioritized: CodeContext = {};

		// Always include current file first
		if (context.currentFile) {
			const currentTokens = this.estimateTokens(context.currentFile.content);
			if (currentTokens <= maxTokens * 0.5) { // Reserve 50% for current file
				prioritized.currentFile = context.currentFile;
				tokensUsed += currentTokens;
			} else {
				// Truncate current file if too large
				prioritized.currentFile = {
					...context.currentFile,
					content: this.truncateToTokens(context.currentFile.content, Math.floor(maxTokens * 0.5))
				};
				tokensUsed += maxTokens * 0.5;
			}
		}

		// Add open files until budget is reached
		if (context.openFiles) {
			prioritized.openFiles = [];
			for (const file of context.openFiles) {
				const fileTokens = this.estimateTokens(file.content);
				if (tokensUsed + fileTokens > maxTokens * 0.8) { // Reserve 20% for other context
					break;
				}
				prioritized.openFiles.push(file);
				tokensUsed += fileTokens;
			}
		}

		// Add recent edits if there's room
		if (context.recentEdits && tokensUsed < maxTokens * 0.9) {
			prioritized.recentEdits = [];
			for (const edit of context.recentEdits) {
				const editTokens = this.estimateTokens(edit.change);
				if (tokensUsed + editTokens > maxTokens) {
					break;
				}
				prioritized.recentEdits.push(edit);
				tokensUsed += editTokens;
			}
		}

		return prioritized;
	}

	private addRecentEdit(edit: EditContext): void {
		this.recentEdits.unshift(edit);
		if (this.recentEdits.length > this.maxRecentEdits) {
			this.recentEdits.pop();
		}
	}

	private estimateTokens(text: string): number {
		// Rough estimation: 1 token ≈ 4 characters
		return Math.ceil(text.length / 4);
	}

	private truncateContent(content: string, maxLines: number): string {
		const lines = content.split('\n');
		if (lines.length <= maxLines) {
			return content;
		}
		return lines.slice(0, maxLines).join('\n') + '\n...';
	}

	private truncateToTokens(content: string, maxTokens: number): string {
		const maxChars = maxTokens * 4;
		if (content.length <= maxChars) {
			return content;
		}
		return content.substring(0, maxChars) + '\n... [truncated]';
	}

	private detectLanguage(filePath: string): string {
		const ext = filePath.split('.').pop()?.toLowerCase();
		const languageMap: Record<string, string> = {
			'ts': 'typescript',
			'tsx': 'typescriptreact',
			'js': 'javascript',
			'jsx': 'javascriptreact',
			'py': 'python',
			'java': 'java',
			'go': 'go',
			'rs': 'rust',
			'cpp': 'cpp',
			'c': 'c',
			'cs': 'csharp',
			'rb': 'ruby',
			'php': 'php',
			'swift': 'swift',
			'kt': 'kotlin',
			'scala': 'scala',
			'html': 'html',
			'css': 'css',
			'scss': 'scss',
			'json': 'json',
			'yaml': 'yaml',
			'yml': 'yaml',
			'md': 'markdown',
			'sql': 'sql',
			'sh': 'shellscript',
			'bash': 'shellscript'
		};
		return languageMap[ext || ''] || 'plaintext';
	}

	private async listSourceFiles(rootUri: URI): Promise<string[]> {
		try {
			const result = await this.fileService.resolve(rootUri, { resolveSingleChildDescendants: false });
			if (!result.children) {
				return [];
			}

			const sourceFiles: string[] = [];
			const excludedDirs = ['node_modules', '.git', 'dist', 'build', '.vscode', '.idea'];

			for (const child of result.children) {
				if (child.isDirectory) {
					if (!excludedDirs.includes(child.name)) {
						// Limit depth to avoid too many files
						const subFiles = await this.listSourceFiles(child.resource);
						sourceFiles.push(...subFiles);
					}
				} else {
					const ext = child.name.split('.').pop()?.toLowerCase();
					if (ext && ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c'].includes(ext)) {
						sourceFiles.push(child.resource.fsPath);
					}
				}
			}

			return sourceFiles;
		} catch {
			return [];
		}
	}
}
