#!/bin/bash
# FewStepAway Debloating Script
# Removes bloatware to make the editor blazing fast

set -e

echo "🔥 FewStepAway Debloating Script"
echo "================================"
echo ""

cd "$(dirname "$0")/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_section() {
    echo ""
    echo -e "${GREEN}▶ $1${NC}"
    echo "----------------------------------------"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# ============================================================================
# PHASE 1: Remove Unnecessary Built-in Extensions
# ============================================================================
print_section "Phase 1: Removing Unnecessary Extensions"

# Extensions to remove (non-essential for AI coding)
REMOVE_EXTENSIONS=(
    # Language extensions (keep only essential - users can install others)
    "bat"
    "clojure"
    "coffeescript"
    "cpp"
    "csharp"
    "dart"
    "fsharp"
    "go"
    "groovy"
    "handlebars"
    "hlsl"
    "ini"
    "java"
    "julia"
    "lua"
    "objective-c"
    "perl"
    "php"
    "powershell"
    "pug"
    "r"
    "ruby"
    "rust"
    "scala"
    "shaderlab"
    "shellscript"
    "sql"
    "swift"
    "vb"
    
    # Test extensions
    "vscode-api-tests"
    "vscode-colorize-tests"
    "vscode-colorize-perf-tests"
    "vscode-test-resolver"
    
    # Heavy feature extensions we can make optional
    "ipynb"              # Jupyter notebooks (heavy)
    "mermaid-chat-features"  # Heavy chat features
    "microsoft-authentication"  # Use built-in auth instead
    "simple-browser"     # Built-in browser (heavy)
    "notebook-renderers" # Notebook support
    
    # Task runners (users can install if needed)
    "grunt"
    "gulp"
    "jake"
    
    # Other bloat
    "debug-auto-launch"
    "debug-server-ready"
    "extension-editing"
    "tunnel-forwarding"
    "references-view"
    "timeline"
    "remotehub"
    "azure-repos"
)

EXTENSIONS_DIR="extensions"
REMOVED_COUNT=0
REMOVED_SIZE=0

for ext in "${REMOVE_EXTENSIONS[@]}"; do
    if [ -d "$EXTENSIONS_DIR/$ext" ]; then
        size=$(du -sk "$EXTENSIONS_DIR/$ext" 2>/dev/null | cut -f1)
        rm -rf "$EXTENSIONS_DIR/$ext"
        REMOVED_COUNT=$((REMOVED_COUNT + 1))
        REMOVED_SIZE=$((REMOVED_SIZE + size))
        print_success "Removed: $ext (${size}KB)"
    fi
done

print_success "Removed $REMOVED_COUNT extensions ($(echo "scale=2; $REMOVED_SIZE/1024" | bc)MB)"

# ============================================================================
# PHASE 2: Remove Telemetry and Tracking Code
# ============================================================================
print_section "Phase 2: Removing Telemetry & Tracking"

# Remove telemetry-related files
TELEMETRY_FILES=(
    "src/vs/platform/telemetry"
    "src/vs/workbench/contrib/bracketPairColorizer2Telemetry"
    "src/vs/workbench/contrib/editTelemetry"
    "src/vs/workbench/services/telemetry"
    "src/vs/workbench/contrib/surveys"
)

for file in "${TELEMETRY_FILES[@]}"; do
    if [ -e "$file" ]; then
        rm -rf "$file"
        print_success "Removed: $file"
    fi
done

# Remove telemetry from product.json
if [ -f "product.json" ]; then
    # Backup original
    cp product.json product.json.backup
    
    # Create minimal product.json without telemetry
    cat > product.json << 'EOF'
{
	"nameShort": "FewStepAway",
	"nameLong": "FewStepAway - AI Native Code Editor",
	"applicationName": "fewstepaway",
	"dataFolderName": ".fewstepaway",
	"win32MutexName": "fewstepaway",
	"licenseName": "Apache-2.0",
	"licenseUrl": "https://github.com/rejisterjack/fewstepaway/blob/main/LICENSE.txt",
	"serverLicenseUrl": "https://github.com/rejisterjack/fewstepaway/blob/main/LICENSE.txt",
	"serverGreeting": [],
	"serverLicense": [],
	"serverLicensePrompt": "",
	"serverApplicationName": "fewstepaway-server",
	"serverDataFolderName": ".fewstepaway-server",
	"tunnelApplicationName": "fewstepaway-tunnel",
	"win32DirName": "FewStepAway",
	"win32NameVersion": "FewStepAway",
	"win32RegValueName": "FewStepAway",
	"win32x64AppId": "{{D77B7E06-80BA-4137-BCF4-654B95CCEBC5}",
	"win32arm64AppId": "{{D1ACE434-89C5-48D1-88D3-E2991DF85475}",
	"win32x64UserAppId": "{{CC6B787D-37A0-49E8-AE24-8559A032BE0C}",
	"win32arm64UserAppId": "{{3AEBF0C8-F733-4AD4-BADE-FDB816D53D7B}",
	"win32AppUserModelId": "FewStepAway.Editor",
	"win32ShellNameShort": "F&ewStepAway",
	"win32TunnelServiceMutex": "fewstepaway-tunnelservice",
	"win32TunnelMutex": "fewstepaway-tunnel",
	"darwinBundleIdentifier": "ai.fewstepaway.editor",
	"darwinProfileUUID": "47827DD9-4734-49A0-AF80-7E19B11495CC",
	"darwinProfilePayloadUUID": "CF808BE7-53F3-46C6-A7E2-7EDB98A5E959",
	"linuxIconName": "fewstepaway",
	"licenseFileName": "LICENSE.txt",
	"reportIssueUrl": "https://github.com/rejisterjack/fewstepaway/issues/new",
	"nodejsRepository": "https://nodejs.org",
	"urlProtocol": "fewstepaway",
	"webviewContentExternalBaseUrlTemplate": "https://{{uuid}}.vscode-cdn.net/insider/ef65ac1ba57f57f2a3961bfe94aa20481caca4c6/out/vs/workbench/contrib/webview/browser/pre/",
	"builtInExtensions": [
		{
			"name": "ms-vscode.js-debug",
			"version": "1.105.0",
			"sha256": "0c45b90342e8aafd4ff2963b4006de64208ca58c2fd01fea7a710fe61dcfd12a",
			"repo": "https://github.com/microsoft/vscode-js-debug"
		}
	],
	"enableTelemetry": false,
	"enableExperiments": false
}
EOF
    print_success "Stripped telemetry from product.json"
fi

# ============================================================================
# PHASE 3: Remove Unnecessary Node Modules (dev dependencies)
# ============================================================================
print_section "Phase 3: Optimizing Dependencies"

# Remove heavy dev dependencies we don't need for runtime
REMOVE_NODE_MODULES=(
    "pseudo-localization"      # 64MB - localization testing
    "innosetup"                # 15MB - Windows installer
    "@vscode/l10n-dev"         # Localization dev tools
    "@vscode/telemetry-extractor"  # Telemetry tools
    "playwright-core"          # 8.5MB - browser testing (keep for tests)
    "@azure"                   # Azure integration (optional)
    "@octokit"                 # GitHub API (optional)
)

for mod in "${REMOVE_NODE_MODULES[@]}"; do
    if [ -d "node_modules/$mod" ]; then
        rm -rf "node_modules/$mod"
        print_success "Removed: node_modules/$mod"
    fi
done

# ============================================================================
# PHASE 4: Clean Build Artifacts
# ============================================================================
print_section "Phase 4: Cleaning Build Artifacts"

rm -rf .build/
rm -rf out/
rm -rf extensions/node_modules/

print_success "Cleaned build artifacts"

# ============================================================================
# PHASE 5: Summary
# ============================================================================
print_section "Debloating Complete!"

echo ""
echo "Summary:"
echo "--------"
echo "✓ Removed unnecessary extensions"
echo "✓ Stripped telemetry and tracking"
echo "✓ Optimized dependencies"
echo "✓ Cleaned build artifacts"
echo ""
echo "Next steps:"
echo "  1. Run: npm install"
echo "  2. Run: npm run compile"
echo "  3. Test with: ./scripts/code.sh"
echo ""
echo -e "${GREEN}FewStepAway is now leaner and faster! 🚀${NC}"
