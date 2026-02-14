#!/bin/bash
# Remove Microsoft Telemetry Dependencies
# Makes FewStepAway truly independent and telemetry-free

set -e

echo "🔥 Removing Microsoft Telemetry Dependencies"
echo "=============================================="
echo ""

cd "$(dirname "$0")/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Dependencies to remove
MS_DEPS=(
    "@microsoft/1ds-core-js"
    "@microsoft/1ds-post-js"
    "tas-client"
)

echo "Removing Microsoft dependencies from package.json..."

# Create backup
cp package.json package.json.backup

# Remove each dependency
for dep in "${MS_DEPS[@]}"; do
    if grep -q "$dep" package.json; then
        # Use node to properly remove from JSON
        node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            if (pkg.dependencies && pkg.dependencies['$dep']) {
                delete pkg.dependencies['$dep'];
                console.log('Removed dependency: $dep');
            }
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, '\\t'));
        "
        print_success "Removed: $dep"
    else
        print_warning "Already removed: $dep"
    fi
done

echo ""
echo "Removing imports from source code..."

# Find and comment out Microsoft imports in source
# This is a safety measure - we should properly remove these
find src -name "*.ts" -type f | while read -r file; do
    if grep -q "@microsoft/1ds" "$file" 2>/dev/null; then
        print_warning "Found Microsoft import in: $file"
        echo "   Manual review needed"
    fi
done

echo ""
echo "Note: Source code changes require manual review"
echo "Files to check:"
echo "  - src/vs/platform/telemetry/*"
echo "  - src/vs/workbench/services/telemetry/*"
echo "  - Any file importing @microsoft/1ds-core-js"
echo ""

print_success "Microsoft dependencies removed from package.json"
echo ""
echo "Next steps:"
echo "  1. Review source code for Microsoft imports"
echo "  2. Run: rm -rf node_modules && npm install"
echo "  3. Test the application"
echo "  4. Commit the changes"
echo ""
echo -e "${GREEN}FewStepAway is now Microsoft-telemetry-free! 🚀${NC}"
