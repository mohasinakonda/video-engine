#!/bin/bash
#
# Downloads FFmpeg static build for Windows and sets it up as a Tauri sidecar.
# Works on macOS, Linux, and Windows (Git Bash/WSL).
#
# Output: src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe
#
# Usage: bash scripts/download-ffmpeg.sh

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────────

FFMPEG_VERSION="7.1.1"
DOWNLOAD_URL="https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-${FFMPEG_VERSION}-essentials_build.zip"
FALLBACK_URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BINARIES_DIR="$PROJECT_ROOT/src-tauri/binaries"
TEMP_DIR="$PROJECT_ROOT/.ffmpeg-temp"

TARGET_TRIPLE="x86_64-pc-windows-msvc"
OUTPUT_FILE="$BINARIES_DIR/ffmpeg-${TARGET_TRIPLE}.exe"

# ─── Pre-flight Check ─────────────────────────────────────────────────────────

if [ -f "$OUTPUT_FILE" ]; then
    echo "✅ FFmpeg sidecar already exists: $OUTPUT_FILE"
    echo "   Delete it first if you want to re-download."
    exit 0
fi

# ─── Create Directories ───────────────────────────────────────────────────────

mkdir -p "$BINARIES_DIR"
mkdir -p "$TEMP_DIR"

ZIP_FILE="$TEMP_DIR/ffmpeg.zip"

# ─── Download ──────────────────────────────────────────────────────────────────

echo "📦 Downloading FFmpeg ${FFMPEG_VERSION} essentials build..."
echo "   URL: $DOWNLOAD_URL"

if curl -fSL --progress-bar -o "$ZIP_FILE" "$DOWNLOAD_URL" 2>/dev/null; then
    echo "✅ Download complete."
else
    echo "⚠️  Primary download failed. Trying fallback..."
    echo "   URL: $FALLBACK_URL"
    curl -fSL --progress-bar -o "$ZIP_FILE" "$FALLBACK_URL"
    echo "✅ Fallback download complete."
fi

# ─── Extract ───────────────────────────────────────────────────────────────────

echo "📂 Extracting ffmpeg.exe..."

EXTRACT_DIR="$TEMP_DIR/extracted"
mkdir -p "$EXTRACT_DIR"
unzip -qo "$ZIP_FILE" -d "$EXTRACT_DIR"

# Find ffmpeg.exe in the extracted directory
FFMPEG_EXE=$(find "$EXTRACT_DIR" -name "ffmpeg.exe" -type f | head -n 1)

if [ -z "$FFMPEG_EXE" ]; then
    echo "❌ Could not find ffmpeg.exe in the extracted archive!"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# ─── Copy & Rename ─────────────────────────────────────────────────────────────

cp "$FFMPEG_EXE" "$OUTPUT_FILE"
echo "✅ FFmpeg sidecar ready: $OUTPUT_FILE"

# ─── File Size ─────────────────────────────────────────────────────────────────

if [ "$(uname)" = "Darwin" ]; then
    SIZE_MB=$(du -m "$OUTPUT_FILE" | cut -f1)
else
    SIZE_MB=$(du --block-size=1M "$OUTPUT_FILE" | cut -f1)
fi
echo "   Size: ${SIZE_MB} MB"

# ─── Cleanup ───────────────────────────────────────────────────────────────────

echo "🧹 Cleaning up temp files..."
rm -rf "$TEMP_DIR"

# ─── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "🎉 Done! FFmpeg is ready for Tauri sidecar bundling."
echo "   Binary: $OUTPUT_FILE"
echo "   Target: $TARGET_TRIPLE"
echo ""
echo "   Next step: Run 'npx tauri build' to bundle the app with FFmpeg."
