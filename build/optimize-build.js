/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Build Optimization Script for FewStepAway
 * 
 * This script optimizes the build by:
 * 1. Removing unused code paths
 * 2. Tree-shaking bloat
 * 3. Minifying aggressively
 * 4. Creating optimized bundles
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Optimizations to apply
const OPTIMIZATIONS = {
	// Remove telemetry code
	removeTelemetry: true,
	
	// Remove experiment code
	removeExperiments: true,
	
	// Remove edit sessions
	removeEditSessions: true,
	
	// Remove surveys
	removeSurveys: true,
	
	// Aggressive minification
	aggressiveMinify: true,
	
	// Disable source maps for production
	skipSourceMaps: true,
};

// Files/patterns to exclude from build
const EXCLUDE_PATTERNS = [
	'**/telemetry/**',
	'**/experiments/**',
	'**/surveys/**',
	'**/editSessions/**',
	'**/bracketPairColorizer2Telemetry/**',
	'**/editTelemetry/**',
	'**/emergencyAlert/**',
];

// Extensions to exclude
const EXCLUDE_EXTENSIONS = require('./fewstepaway-config').EXCLUDED_EXTENSIONS;

console.log('🔧 FewStepAway Build Optimizer');
console.log('================================');
console.log();

function logStep(message) {
	console.log(`▶ ${message}`);
}

function logSuccess(message) {
	console.log(`  ✓ ${message}`);
}

function logWarning(message) {
	console.log(`  ⚠ ${message}`);
}

// Step 1: Clean previous builds
logStep('Cleaning previous builds...');
try {
	execSync('rm -rf out/ .build/', { stdio: 'inherit' });
	logSuccess('Build directories cleaned');
} catch (e) {
	logWarning('Some directories may not exist');
}

// Step 2: Optimize package.json
logStep('Optimizing package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Remove heavy dev dependencies
const heavyDeps = [
	'@vscode/telemetry-extractor',
	'@vscode/l10n-dev',
	'innosetup',
	'pseudo-localization',
];

heavyDeps.forEach(dep => {
	if (packageJson.devDependencies?.[dep]) {
		delete packageJson.devDependencies[dep];
		logSuccess(`Removed dev dependency: ${dep}`);
	}
});

// Remove telemetry scripts
delete packageJson.scripts['mixin-telemetry-docs'];

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, '\t'));
logSuccess('package.json optimized');

// Step 3: Remove unnecessary extensions
logStep('Removing unnecessary extensions...');
let removedCount = 0;
EXCLUDE_EXTENSIONS.forEach(ext => {
	const extPath = path.join('extensions', ext);
	if (fs.existsSync(extPath)) {
		execSync(`rm -rf ${extPath}`);
		removedCount++;
		logSuccess(`Removed extension: ${ext}`);
	}
});
logSuccess(`Removed ${removedCount} extensions`);

// Step 4: Generate optimized tsconfig
logStep('Generating optimized tsconfig...');
const tsconfig = {
	compilerOptions: {
		module: 'ES2022',
		target: 'ES2022',
		lib: ['ES2022'],
		strict: true,
		skipLibCheck: true,
		esModuleInterop: true,
		resolveJsonModule: true,
		moduleResolution: 'node',
		// Performance optimizations
		incremental: true,
		tsBuildInfoFile: '.build/tsbuildinfo',
		// Remove unused code
		noUnusedLocals: false, // Keep false for dev, enable for prod
		noUnusedParameters: false,
	},
	exclude: [
		'node_modules',
		'.build',
		'out',
		...EXCLUDE_PATTERNS,
	],
};

fs.writeFileSync('tsconfig.optimized.json', JSON.stringify(tsconfig, null, 2));
logSuccess('Optimized tsconfig generated');

// Step 5: Create webpack optimization config
logStep('Creating webpack optimizations...');
const webpackConfig = `
// FewStepAway Webpack Optimizations
const path = require('path');

module.exports = {
	mode: 'production',
	devtool: false, // No source maps for production
	optimization: {
		minimize: true,
		removeAvailableModules: true,
		removeEmptyChunks: true,
		mergeDuplicateChunks: true,
		flagIncludedChunks: true,
		sideEffects: false,
		usedExports: true,
		concatenateModules: true,
		splitChunks: {
			chunks: 'all',
			cacheGroups: {
				vendor: {
					test: /[\\\\/]node_modules[\\\\/]/,
					name: 'vendors',
					chunks: 'all',
				},
			},
		},
	},
	performance: {
		hints: 'warning',
		maxEntrypointSize: 250000,
		maxAssetSize: 250000,
	},
};
`;

fs.writeFileSync('webpack.optimized.config.js', webpackConfig);
logSuccess('Webpack optimization config created');

// Step 6: Summary
console.log();
console.log('================================');
console.log('✅ Build optimization complete!');
console.log();
console.log('Next steps:');
console.log('  1. npm install (to update dependencies)');
console.log('  2. npm run compile');
console.log('  3. npm run gulp vscode');
console.log();
console.log('🚀 FewStepAway is optimized for speed!');
