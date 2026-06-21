#!/bin/bash
# FewStepsAway icon build - rasterizes resources/icons/logo.svg and emits the
# full platform asset set into resources/. Requires librsvg (rsvg-convert).
#
#   brew install librsvg
#   ./build/icon-gen/build-icons.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SVG="resources/icons/logo.svg"
WORK="build/icon-gen/tmp"

if ! command -v rsvg-convert >/dev/null 2>&1; then
	echo "ERROR: rsvg-convert not found. Install with: brew install librsvg" >&2
	exit 1
fi

if [ ! -f "$SVG" ]; then
	echo "ERROR: $SVG not found" >&2
	exit 1
fi

echo "Rasterizing $SVG ..."
rm -rf "$WORK" && mkdir -p "$WORK"

# Every size needed across .icns, .ico, and the .png assets.
SIZES=(16 24 32 48 64 128 192 256 512 1024)
for s in "${SIZES[@]}"; do
	rsvg-convert -w "$s" -h "$s" "$SVG" -o "$WORK/$s.png"
done
echo "  generated ${#SIZES[@]} PNGs"

# --- macOS .icns via iconutil (16..512 + @2x, up to 1024) -----------------
ICONSET="$WORK/code.iconset"
rm -rf "$ICONSET" && mkdir -p "$ICONSET"
cp "$WORK/16.png"   "$ICONSET/icon_16x16.png"
cp "$WORK/32.png"   "$ICONSET/icon_16x16@2x.png"
cp "$WORK/32.png"   "$ICONSET/icon_32x32.png"
cp "$WORK/64.png"   "$ICONSET/icon_32x32@2x.png"
cp "$WORK/128.png"  "$ICONSET/icon_128x128.png"
cp "$WORK/256.png"  "$ICONSET/icon_128x128@2x.png"
cp "$WORK/256.png"  "$ICONSET/icon_256x256.png"
cp "$WORK/512.png"  "$ICONSET/icon_256x256@2x.png"
cp "$WORK/512.png"  "$ICONSET/icon_512x512.png"
cp "$WORK/1024.png" "$ICONSET/icon_512x512@2x.png"
iconutil -c icns -o "$WORK/code.icns" "$ICONSET"
echo "  built code.icns"

# --- Windows .ico via Node packer ----------------------------------------
node build/icon-gen/pack-ico.js "$WORK/code.ico" \
	"$WORK/16.png" "$WORK/24.png" "$WORK/32.png" \
	"$WORK/48.png" "$WORK/64.png" "$WORK/128.png" "$WORK/256.png"

# --- Linux + server .png assets ------------------------------------------
cp "$WORK/512.png" "$WORK/code.png"

# --- Place into resources/ ------------------------------------------------
install -m 0644 "$WORK/code.icns"      "resources/darwin/code.icns"
install -m 0644 "$WORK/code.ico"       "resources/win32/code.ico"
install -m 0644 "$WORK/code.png"       "resources/linux/code.png"
install -m 0644 "$WORK/192.png"        "resources/server/code-192.png"
install -m 0644 "$WORK/512.png"        "resources/server/code-512.png"

echo "Done. Assets written to resources/{darwin,win32,linux,server}/."
