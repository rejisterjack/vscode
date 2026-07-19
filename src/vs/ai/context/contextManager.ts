/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
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
	CodeContext,
	ContextOptions,
	ContextChange,
	FileContext,
	EditContext
} from '../common/types/ai.types.js';

import {
	IContextManager,
	ProjectStructure
} from '../common/types/context.types.js';
import { ParsedMention } from '../common/mentionParser.js';
import { IIndexManager } from '../indexing/indexTypes.js';
import { WorkspaceUriResolver } from '../integrity/workspaceUriResolver.js';
import { CancellationToken } from '../../base/common/cancellation.js';
import { WorkspaceSymbolProviderRegistry } from '../../workbench/contrib/search/common/search.js';
import { ISCMService } from '../../workbench/contrib/scm/common/scm.js';
import { ITerminalService } from '../../workbench/contrib/terminal/browser/terminal.js';
import { IRequestService } from '../../platform/request/common/request.js';
import { fetchWebSearchResults } from '../tool/tools/websearchUtils.js';

/**
 * Context Manager implementation for FewStepsAway
 * 
 * Responsible for gathering and managing code context for AI requests.
 * Tracks file changes, open editors, and recent edits to provide
 * relevant context to AI providers.
 */
export class ContextManager extends Disposable implements IContextManager {
	declare readonly _serviceBrand: undefined;

	private readonly _onContextChanged = this._register(new Emitter<ContextChange>());
	readonly onContextChanged: Event<ContextChange> = this._onContextChanged.event;

	private recentEdits: EditContext[] = [];
	private readonly maxRecentEdits = 10;
	private readonly defaultMaxTokens = 4000;

	private readonly uriResolver: WorkspaceUriResolver;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IIndexManager private readonly indexManager: IIndexManager,
		@ISCMService private readonly scmService: ISCMService,
		@ITerminalService private readonly terminalService: ITerminalService,
		@IRequestService private readonly requestService: IRequestService,
	) {
		super();
		this.uriResolver = new WorkspaceUriResolver(workspaceService, fileService);
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
				changes: {
					added: e.rawAdded,
					updated: e.rawUpdated,
					deleted: e.rawDeleted
				}
			});
		}));

		// Track text model changes for recent edits
		this._register(this.textFileService.files.onDidSave(e => {
			this.addRecentEdit({
				filePath: e.model.resource.fsPath,
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
			openFiles: openFiles.filter((f: FileContext) => f.path !== currentFile?.path),
			recentEdits,
			projectStructure: projectStructure ? {
				rootPath: projectStructure.rootPath,
				files: projectStructure.sourceFiles,
				dependencies: projectStructure.dependencies?.map(d => d.name),
				framework: projectStructure.framework?.name
			} : undefined
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
		const activeEditor = this.editorService.activeTextEditorControl;
		if (!activeEditor) {
			return undefined;
		}
		const model = activeEditor.getModel();
		if (!model || !('uri' in model)) {
			return undefined;
		}
		const selection = activeEditor.getSelection();
		if (!selection || selection.isEmpty()) {
			return undefined;
		}
		const text = model.getValueInRange(selection);
		return {
			text,
			filePath: model.uri.fsPath,
			startLine: selection.startLineNumber,
			endLine: selection.endLineNumber,
			surroundingContext: this.truncateContent(model.getValue(), 20),
		};
	}

	/**
	 * Resolve @-mentions into additional context snippets for chat.
	 */
	async resolveMentions(mentions: readonly ParsedMention[]): Promise<string[]> {
		const snippets: string[] = [];
		for (const mention of mentions) {
			switch (mention.kind) {
				case 'codebase': {
					const results = await this.indexManager.search(mention.value || 'overview', 5);
					for (const r of results) {
						snippets.push(`[@codebase] ${r.chunk.uri.fsPath}:${r.chunk.startLine}-${r.chunk.endLine}\n${r.chunk.content}`);
					}
					break;
				}
				case 'file': {
					const uri = await this.resolveWorkspacePathAsync(mention.value);
					if (uri) {
						try {
							const content = await this.fileService.readFile(uri);
							snippets.push(`[@file] ${mention.value}\n${this.truncateContent(content.value.toString(), 200)}`);
						} catch { /* skip */ }
					}
					break;
				}
				case 'folder': {
					const uri = await this.resolveWorkspacePathAsync(mention.value);
					if (uri) {
						try {
							const stat = await this.fileService.resolve(uri);
							if (stat.isDirectory) {
								const listing = (stat.children ?? [])
									.slice(0, 50)
									.map(child => child.isDirectory ? `${child.name}/` : child.name)
									.join('\n');
								snippets.push(`[@folder] ${mention.value}\n${listing || '(empty directory)'}`);
							} else {
								const content = await this.fileService.readFile(uri);
								snippets.push(`[@file] ${mention.value}\n${this.truncateContent(content.value.toString(), 200)}`);
							}
						} catch { /* skip */ }
					}
					break;
				}
				case 'symbol': {
					const resolved = await this.resolveSymbolMention(mention.value);
					if (resolved) {
						snippets.push(resolved);
					}
					break;
				}
				case 'git':
				case 'diff': {
					const gitOutput = await this.resolveGitMention(mention.kind, mention.value);
					if (gitOutput) {
						snippets.push(gitOutput);
					}
					break;
				}
				case 'commit': {
					const output = await this.execGit(`show --stat ${mention.value}`);
					snippets.push(`[@commit] ${mention.value}\n${this.truncateContent(output, 120)}`);
					break;
				}
				case 'branch': {
					const output = await this.execGit(`branch -a --list '*${mention.value}*'`);
					snippets.push(`[@branch] ${mention.value}\n${output.trim() || '(no matching branches)'}`);
					break;
				}
				case 'web': {
					const query = mention.value || 'search';
					try {
						const results = await fetchWebSearchResults(this.requestService, query, 8);
						snippets.push(`[@web] Query: "${query}"\n${this.truncateContent(results, 200)}`);
					} catch (error) {
						snippets.push(`[@web] Query: "${query}"\nSearch failed: ${error instanceof Error ? error.message : String(error)}`);
					}
					break;
				}
				case 'terminal': {
					const buffer = this.captureTerminalOutput(mention.value);
					snippets.push(`[@terminal] ${mention.value || 'active'}\n${buffer}`);
					break;
				}
				case 'selection': {
					const sel = await this.getSelectionContext();
					if (sel) {
						snippets.push(`[@selection] ${sel.filePath}:${sel.startLine}-${sel.endLine}\n${sel.text}`);
					}
					break;
				}
				default:
					snippets.push(`[@${mention.kind}] ${mention.value}`);
			}
		}
		return snippets;
	}

	private async resolveGitMention(kind: 'git' | 'diff', value: string): Promise<string | undefined> {
		const subcommand = kind === 'diff' || value === 'diff' ? 'diff' : value || 'status';
		const scmDiff = await this.resolveScmDiff(subcommand);
		if (scmDiff) {
			return scmDiff;
		}
		const output = await this.execGit(subcommand === 'status' ? 'status --short' : subcommand === 'diff' ? 'diff' : subcommand);
		return `[@git] ${subcommand}\n${this.truncateContent(output, 200)}`;
	}

	private async resolveScmDiff(subcommand: string): Promise<string | undefined> {
		const repo = this.scmService.repositories[0];
		if (!repo?.provider) {
			return undefined;
		}
		try {
			if (subcommand === 'status' || subcommand === 'status --short') {
				const lines = repo.provider.groups.flatMap(group =>
					group.resources.map(resource => `${group.label}: ${resource.sourceUri.fsPath}`),
				);
				if (lines.length > 0) {
					return `[@git] status\n${this.truncateContent(lines.join('\n'), 200)}`;
				}
			}
		} catch {
			// fall through to git exec
		}
		return undefined;
	}

	private captureTerminalOutput(label: string | undefined): string {
		const instance = this.terminalService.activeInstance;
		if (!instance) {
			return '(no active terminal)';
		}
		try {
			const buffer = instance.xterm?.raw.buffer.active;
			if (!buffer) {
				return '(terminal buffer unavailable)';
			}
			const lines: string[] = [];
			const start = Math.max(0, buffer.length - 80);
			for (let i = start; i < buffer.length; i++) {
				lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
			}
			const text = lines.join('\n').trim();
			return this.truncateContent(text || '(empty terminal)', 120) + (label ? ` (${label})` : '');
		} catch {
			return '(failed to read terminal buffer)';
		}
	}

	private async resolveSymbolMention(value: string): Promise<string | undefined> {
		const hashIdx = value.indexOf('#');
		const filePath = hashIdx >= 0 ? value.slice(0, hashIdx) : undefined;
		const symbolName = hashIdx >= 0 ? value.slice(hashIdx + 1) : value;
		if (!symbolName) {
			return undefined;
		}

		const workspaceSymbols = await this.lookupWorkspaceSymbols(symbolName);
		if (workspaceSymbols) {
			return `[@symbol] ${symbolName}\n${workspaceSymbols}`;
		}

		if (filePath) {
			const uri = await this.resolveWorkspacePathAsync(filePath);
			if (uri) {
				try {
					const content = await this.fileService.readFile(uri);
					const matches = this.grepSymbolInContent(content.value.toString(), symbolName);
					return `[@symbol] ${value}\n${matches || '(symbol not found in file)'}`;
				} catch { /* skip */ }
			}
		}

		const workspace = this.workspaceService.getWorkspace();
		if (!workspace.folders.length) {
			return `[@symbol] ${symbolName} (no workspace open)`;
		}
		const rootUri = workspace.folders[0].uri;
		const sourceFiles = (await this.listSourceFiles(rootUri)).slice(0, 30);
		const hits: string[] = [];
		for (const fsPath of sourceFiles) {
			try {
				const content = await this.fileService.readFile(URI.file(fsPath));
				const matches = this.grepSymbolInContent(content.value.toString(), symbolName, 3);
				if (matches) {
					hits.push(`${fsPath}\n${matches}`);
				}
			} catch { /* skip */ }
			if (hits.length >= 5) {
				break;
			}
		}
		return `[@symbol] ${symbolName}\n${hits.join('\n---\n') || '(no matches in workspace)'}`;
	}

	private async lookupWorkspaceSymbols(query: string): Promise<string | undefined> {
		const providers = WorkspaceSymbolProviderRegistry.all();
		const results: string[] = [];
		for (const provider of providers) {
			try {
				const symbols = await provider.provideWorkspaceSymbols(query, CancellationToken.None);
				if (!symbols) {
					continue;
				}
				for (const symbol of symbols.slice(0, 8)) {
					const path = symbol.location.uri.fsPath;
					const line = symbol.location.range.startLineNumber;
					results.push(`${symbol.name} (${symbol.kind}) — ${path}:${line}`);
				}
			} catch {
				// skip provider errors
			}
		}
		return results.length > 0 ? results.join('\n') : undefined;
	}

	private grepSymbolInContent(content: string, symbolName: string, maxLines = 8): string {
		const pattern = new RegExp(`\\b${symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
		const lines = content.split('\n');
		const matched: string[] = [];
		for (let i = 0; i < lines.length; i++) {
			if (pattern.test(lines[i]!)) {
				const start = Math.max(0, i - 1);
				const end = Math.min(lines.length, i + 2);
				matched.push(...lines.slice(start, end).map((line, idx) => `${start + idx + 1}: ${line}`));
				if (matched.length >= maxLines) {
					break;
				}
			}
		}
		return matched.join('\n');
	}

	private async execGit(args: string): Promise<string> {
		const cwd = this.workspaceService.getWorkspace().folders[0]?.uri.fsPath;
		if (!cwd) {
			return '(no workspace folder)';
		}
		try {
			const cp = await import('child_process');
			return await new Promise<string>((resolve) => {
				cp.exec(`git ${args}`, { cwd, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
					if (err && !stdout && !stderr) {
						resolve(err.message);
						return;
					}
					resolve((stdout || stderr || '').trim());
				});
			});
		} catch (err) {
			return err instanceof Error ? err.message : String(err);
		}
	}

	private async resolveWorkspacePathAsync(relativePath: string): Promise<URI | undefined> {
		try {
			return await this.uriResolver.resolve(relativePath);
		} catch {
			return undefined;
		}
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
