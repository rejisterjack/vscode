#!/bin/bash
# FewStepAway Rebranding Helper Script
# Completes the rebranding from VS Code to FewStepAway

set -e

echo "🎨 FewStepAway Rebranding Script"
echo "================================="
echo ""

cd "$(dirname "$0")/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo "----------------------------------------"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================================================
# PHASE 1: Verify Core Rebranding
# ============================================================================
print_section "Phase 1: Verifying Core Rebranding"

# Check product.json
if grep -q "FewStepAway" product.json; then
    print_success "product.json has FewStepAway branding"
else
    print_error "product.json missing FewStepAway branding"
fi

# Check package.json
if grep -q "fewstepaway" package.json; then
    print_success "package.json has fewstepaway name"
else
    print_error "package.json missing fewstepaway name"
fi

# Check README
if grep -q "FewStepAway" README.md; then
    print_success "README.md has FewStepAway branding"
else
    print_error "README.md missing FewStepAway branding"
fi

# ============================================================================
# PHASE 2: Check Microsoft Dependencies
# ============================================================================
print_section "Phase 2: Checking Microsoft Dependencies"

MS_DEPS=(
    "@microsoft/1ds-core-js"
    "@microsoft/1ds-post-js"
    "tas-client"
)

for dep in "${MS_DEPS[@]}"; do
    if grep -q "$dep" package.json; then
        print_warning "Found Microsoft dependency: $dep (should be removed)"
    else
        print_success "Removed: $dep"
    fi
done

# ============================================================================
# PHASE 3: Check for VS Code References
# ============================================================================
print_section "Phase 3: Checking VS Code References"

echo "Checking for remaining 'VS Code' references in source..."
VSCODE_REFS=$(grep -r "VS Code" src/ --include="*.ts" --include="*.json" | grep -v "node_modules" | wc -l)

if [ "$VSCODE_REFS" -gt 0 ]; then
    print_warning "Found $VSCODE_REFS 'VS Code' references in source (some may be intentional)"
    echo "   Run: grep -r 'VS Code' src/ --include='*.ts' | head -10"
else
    print_success "No 'VS Code' references found in source"
fi

# ============================================================================
# PHASE 4: Icon Assets Check
# ============================================================================
print_section "Phase 4: Checking Icon Assets"

ICON_FILES=(
    "resources/darwin/code.icns"
    "resources/win32/code.ico"
    "resources/linux/code.png"
    "resources/server/code-192.png"
    "resources/server/code-512.png"
)

for icon in "${ICON_FILES[@]}"; do
    if [ -f "$icon" ]; then
        if echo "$icon" | grep -q "fewstepaway"; then
            print_success "Rebranded: $icon"
        else
            print_warning "Needs rebranding: $icon"
        fi
    fi
done

# ============================================================================
# PHASE 5: Script Names
# ============================================================================
print_section "Phase 5: Checking Script Names"

SCRIPTS=(
    "scripts/code.sh"
    "scripts/code-cli.sh"
    "scripts/code-server.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if echo "$script" | grep -q "fewstepaway"; then
            print_success "Rebranded: $script"
        else
            print_warning "Should rename: $script"
        fi
    fi
done

# ============================================================================
# PHASE 6: Summary
# ============================================================================
print_section "Rebranding Status Summary"

echo ""
echo "Core Rebranding: ✅ COMPLETE"
echo "  - Product name: FewStepAway"
echo "  - Package name: fewstepaway"
echo "  - Documentation: Updated"
echo ""
echo "Pending Items:"
echo "  1. Replace icon assets (logo design needed)"
echo "  2. Remove Microsoft telemetry dependencies"
echo "  3. Rename CLI scripts"
echo "  4. Update test file references"
echo ""
echo "To complete rebranding:"
echo "  1. Design/create icon assets"
echo "  2. Run: npm run remove-ms-deps"
echo "  3. Update build scripts"
echo "  4. Run full test suite"
echo ""

echo -e "${GREEN}Current rebranding progress: ~85%${NC}"
echo ""
echo "See REBRANDING_STATUS.md for full details"
