/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * FewStepAway Build Configuration
 * Optimized for minimal bloat and maximum performance
 */

// Extensions to exclude from build (bloatware)
const EXCLUDED_EXTENSIONS = [
	// Language support (installable from marketplace)
	'bat',
	'clojure',
	'coffeescript',
	'dart',
	'fsharp',
	'go',
	'groovy',
	'handlebars',
	'hlsl',
	'ini',
	'java',
	'julia',
	'lua',
	'objective-c',
	'perl',
	'php',
	'powershell',
	'pug',
	'r',
	'ruby',
	'rust',
	'scala',
	'shaderlab',
	'swift',
	'vb',

	// Test extensions
	'vscode-api-tests',
	'vscode-colorize-tests',
	'vscode-colorize-perf-tests',
	'vscode-test-resolver',

	// Heavy features (optional)
	'ipynb',
	'mermaid-chat-features',
	'microsoft-authentication',
	'simple-browser',
	'notebook-renderers',
	'tunnel-forwarding',

	// Task runners (optional)
	'grunt',
	'gulp',
	'jake',

	// Other bloat
	'debug-auto-launch',
	'debug-server-ready',
	'extension-editing',
	'references-view',
	'timeline',
	'remotehub',
	'azure-repos',
	'editSessions',
];

// Workbench contributions to disable
const DISABLED_CONTRIBUTIONS = [
	'bracketPairColorizer2Telemetry',
	'editTelemetry',
	'surveys',
	'editSessions',
	'emergencyAlert',
	'limitIndicator',
	'localHistory',
];

// Features to disable
const DISABLED_FEATURES = {
	// Telemetry
	'telemetry.enableCrashReporter': false,
	'telemetry.enableTelemetry': false,
	'telemetry.telemetryLevel': 'off',

	// Experiments
	'workbench.enableExperiments': false,

	// Performance optimizations
	'workbench.tree.indent': 12,
	'workbench.list.smoothScrolling': false,
	'editor.smoothScrolling': false,
	'editor.cursorSmoothCaretAnimation': 'off',

	// Disable unnecessary features
	'git.enableSmartCommit': false,
	'git.confirmSync': false,
	'git.showInlineOpenFileAction': false,
	'explorer.confirmDragAndDrop': false,
	'explorer.confirmDelete': false,
	'search.quickOpen.delay': 0,

	// AI-specific optimizations
	'ai.completion.enabled': true,
	'ai.completion.delay': 50,
	'ai.completion.maxTokens': 100,
	'ai.context.maxTokens': 4000,
};

// Minimal extension list for AI coding
const ESSENTIAL_EXTENSIONS = [
	'js-debug',           // JavaScript debugging
	'git',                // Git integration
	'git-base',           // Git basics
	'github',             // GitHub integration
	'github-authentication',
	'css',                // CSS support
	'css-language-features',
	'html',               // HTML support
	'html-language-features',
	'json',               // JSON support
	'json-language-features',
	'typescript',         // TypeScript support
	'typescript-language-features',
	'javascript',         // JavaScript support
	'markdown',           // Markdown support
	'markdown-language-features',
	'markdown-math',
	'emmet',              // Emmet for HTML/CSS
	'configuration-editing',
	'debug-auto-launch',
	'git-base',
	'merge-conflict',
];

module.exports = {
	EXCLUDED_EXTENSIONS,
	DISABLED_CONTRIBUTIONS,
	DISABLED_FEATURES,
	ESSENTIAL_EXTENSIONS,
};
