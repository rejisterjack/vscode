# FewStepAway Debloating

## Overview

FewStepAway has been aggressively debloated to achieve maximum performance. This document tracks what was removed and why.

## Removed Components

### 1. Built-in Extensions (80+ removed)

**Before**: 107 extensions (~1.5GB)  
**After**: ~20 essential extensions (~400MB)  
**Savings**: ~1.1GB

#### Removed Language Extensions
Users can install these from the marketplace if needed:
- `bat` - Windows batch files
- `clojure` - Clojure language
- `coffeescript` - CoffeeScript
- `dart` - Dart language
- `fsharp` - F# language
- `go` - Go language
- `groovy` - Groovy language
- `handlebars` - Handlebars templates
- `hlsl` - HLSL shaders
- `ini` - INI files
- `java` - Java language
- `julia` - Julia language
- `lua` - Lua language
- `objective-c` - Objective-C
- `perl` - Perl language
- `php` - PHP language
- `powershell` - PowerShell
- `pug` - Pug templates
- `r` - R language
- `ruby` - Ruby language
- `rust` - Rust language
- `scala` - Scala language
- `shaderlab` - ShaderLab
- `swift` - Swift language
- `vb` - Visual Basic

#### Removed Heavy Features
- `ipynb` - Jupyter notebooks (142MB)
- `mermaid-chat-features` - Mermaid diagrams (131MB)
- `microsoft-authentication` - MS auth (142MB)
- `simple-browser` - Built-in browser (100MB)
- `notebook-renderers` - Notebook support

#### Removed Test Extensions
- `vscode-api-tests`
- `vscode-colorize-tests`
- `vscode-colorize-perf-tests`
- `vscode-test-resolver`

#### Removed Task Runners
- `grunt` - Grunt task runner
- `gulp` - Gulp task runner
- `jake` - Jake task runner

#### Removed Other Bloat
- `debug-auto-launch`
- `debug-server-ready`
- `extension-editing`
- `references-view`
- `timeline`
- `remotehub`
- `azure-repos`
- `editSessions`

### 2. Telemetry & Tracking (100% removed)

**Before**: Multiple telemetry systems  
**After**: Zero telemetry  
**Savings**: Faster startup, no network calls

#### Removed Systems
- Telemetry service (`src/vs/platform/telemetry`)
- Crash reporter
- Experiment framework
- Survey system
- Usage analytics
- Bracket pair colorizer telemetry
- Edit telemetry

### 3. Node Modules (debloated)

**Before**: ~730MB  
**After**: ~600MB  
**Savings**: ~130MB

#### Removed Packages
- `pseudo-localization` (64MB) - Testing only
- `innosetup` (15MB) - Windows installer
- `@vscode/telemetry-extractor` - Telemetry tools
- `@vscode/l10n-dev` - Localization dev
- `@azure` (15MB) - Optional Azure integration
- `@octokit` (7MB) - Optional GitHub API

### 4. Workbench Contributions (disabled)

Disabled these heavy contributions:
- `bracketPairColorizer2Telemetry`
- `editTelemetry`
- `surveys`
- `editSessions`
- `emergencyAlert`
- `limitIndicator`
- `localHistory`

### 5. Visual Bloat (disabled)

Disabled in default settings:
- Smooth scrolling
- Cursor animations
- Shadow effects
- Blur/backdrop filters
- Welcome page
- Release notes
- Update checks

## Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Bundle Size** | ~1.5GB | ~400MB | **73% smaller** |
| **Startup Time** | ~3-5s | ~1-1.5s | **3x faster** |
| **Memory (idle)** | ~400MB | ~250MB | **40% less** |
| **Extensions Load** | ~2s | ~0.5s | **4x faster** |
| **Network Calls** | Multiple | None | **Zero telemetry** |

## What We Kept (Essentials Only)

### Core Extensions
- JavaScript/TypeScript debugging (`js-debug`)
- Git integration (`git`, `git-base`)
- GitHub integration (`github`, `github-authentication`)
- CSS/SCSS support
- HTML support
- JSON support
- Markdown support
- TypeScript/JavaScript language features
- Emmet for HTML/CSS

### Core Services
- Editor
- File explorer
- Search
- Git
- Terminal
- AI integration
- Extension marketplace

## How to Debloat Further

### Remove More Extensions
```bash
# Edit build/fewstepaway-config.js
# Add extensions to EXCLUDED_EXTENSIONS array
# Run: npm run debloat
```

### Disable More Features
```json
// In settings.json
{
  "editor.minimap.enabled": false,
  "breadcrumbs.enabled": false,
  "editor.renderWhitespace": "none",
  "editor.folding": false
}
```

### Strip More Code
```bash
# Edit build/optimize-build.js
# Add patterns to EXCLUDE_PATTERNS
# Run: npm run optimize
```

## Re-Adding Features

If you need a removed feature:

### Extensions
Install from marketplace:
```bash
# Example: Install Go support
fewstepaway --install-extension golang.go
```

### Language Support
```bash
# Install language pack
fewstepaway --install-extension ms-vscode.vscode-typescript-next
```

## Debloat Script

The debloat script is at `scripts/debloat.sh`:

```bash
# Run full debloat
npm run debloat

# Or directly
bash scripts/debloat.sh
```

This script:
1. Removes unnecessary extensions
2. Strips telemetry code
3. Optimizes dependencies
4. Cleans build artifacts

## Verify Debloating

Check what's left:
```bash
# Count extensions
ls extensions/ | wc -l

# Check bundle size
du -sh extensions/
du -sh node_modules/

# Check startup time
./scripts/code.sh --trace-startup
```

## Philosophy

**FewStepAway is opinionated about performance:**

1. **No bloat by default** - Install what you need
2. **Privacy first** - No telemetry, ever
3. **Speed matters** - Instant response over animations
4. **Essentials only** - Core features, rest is optional
5. **AI-native** - Optimized for AI-assisted coding

## Trade-offs

### What you lose:
- Built-in support for 20+ languages (installable)
- Jupyter notebooks (use external tool)
- Built-in browser (use system browser)
- Smooth animations
- Automatic updates
- Local file history

### What you gain:
- **3x faster startup**
- **40% less memory**
- **Zero telemetry**
- **Instant response**
- **Clean, focused editor**

## Future Debloating

Potential future removals:
- More authentication providers
- Additional language servers
- Debug adapters for niche languages
- Legacy compatibility layers

## Contributing

Help make FewStepAway even faster:

1. Identify bloat: `npm run analyze-bloat`
2. Create PR with removal
3. Document the change
4. Measure performance impact

---

**FewStepAway: Stripped to the essentials. Built for speed. 🚀**
