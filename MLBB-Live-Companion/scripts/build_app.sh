#!/bin/bash
# Builds "MLBB Live Companion.app" into ./build — needs only Xcode or the Command Line Tools.
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG="${1:-release}"
APP="build/MLBB Live Companion.app"

echo "▶ swift build ($CONFIG)…"
swift build -c "$CONFIG"
BIN_DIR="$(swift build -c "$CONFIG" --show-bin-path)"

echo "▶ assembling $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/MLBBLiveCompanion" "$APP/Contents/MacOS/MLBBLiveCompanion"
cp scripts/Info.plist "$APP/Contents/Info.plist"
cp -R Resources/Data "$APP/Contents/Resources/Data"

echo "▶ ad-hoc code signing"
codesign --force --sign - --timestamp=none "$APP"
codesign --verify --verbose=1 "$APP"

echo "✅ Done: $APP"
echo "   Run with:  open \"$APP\""
