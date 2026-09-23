<#
.SYNOPSIS
    Downloads FFmpeg static build for Windows and sets it up as a Tauri sidecar.

.DESCRIPTION
    This script downloads the latest FFmpeg release essentials build from gyan.dev,
    extracts ffmpeg.exe, and renames it to match Tauri's sidecar naming convention.

    Output: src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe

.EXAMPLE
    pwsh scripts/download-ffmpeg.ps1
#>

param(
    [string]$Arch = "x86_64"
)

$ErrorActionPreference = "Stop"

# ─── Configuration ─────────────────────────────────────────────────────────────

$FFMPEG_VERSION = "7.1.1"
$DOWNLOAD_URL = "https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-${FFMPEG_VERSION}-essentials_build.zip"
$TARGET_TRIPLE = "${Arch}-pc-windows-msvc"
$BINARIES_DIR = Join-Path $PSScriptRoot ".." "src-tauri" "binaries"
$TEMP_DIR = Join-Path $PSScriptRoot ".." ".ffmpeg-temp"
$OUTPUT_FILE = Join-Path $BINARIES_DIR "ffmpeg-${TARGET_TRIPLE}.exe"

# ─── Pre-flight Checks ────────────────────────────────────────────────────────

if (Test-Path $OUTPUT_FILE) {
    Write-Host "✅ FFmpeg sidecar already exists: $OUTPUT_FILE" -ForegroundColor Green
    Write-Host "   Delete it first if you want to re-download."
    exit 0
}

# ─── Create Directories ───────────────────────────────────────────────────────

New-Item -ItemType Directory -Force -Path $BINARIES_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $TEMP_DIR | Out-Null

# ─── Download ──────────────────────────────────────────────────────────────────

$zipFile = Join-Path $TEMP_DIR "ffmpeg.zip"

Write-Host "📦 Downloading FFmpeg ${FFMPEG_VERSION} essentials build..." -ForegroundColor Cyan
Write-Host "   URL: $DOWNLOAD_URL"

try {
    Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $zipFile -UseBasicParsing
} catch {
    Write-Host "❌ Download failed. Trying alternative source..." -ForegroundColor Red
    
    # Fallback: BtbN GitHub releases
    $FALLBACK_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    Write-Host "   Fallback URL: $FALLBACK_URL"
    Invoke-WebRequest -Uri $FALLBACK_URL -OutFile $zipFile -UseBasicParsing
}

Write-Host "✅ Download complete." -ForegroundColor Green

# ─── Extract ───────────────────────────────────────────────────────────────────

Write-Host "📂 Extracting ffmpeg.exe..." -ForegroundColor Cyan

$extractDir = Join-Path $TEMP_DIR "extracted"
Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

# Find ffmpeg.exe in the extracted directory (it's inside a subfolder)
$ffmpegExe = Get-ChildItem -Path $extractDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1

if (-not $ffmpegExe) {
    Write-Host "❌ Could not find ffmpeg.exe in the extracted archive!" -ForegroundColor Red
    exit 1
}

# ─── Copy & Rename ─────────────────────────────────────────────────────────────

Copy-Item -Path $ffmpegExe.FullName -Destination $OUTPUT_FILE -Force

Write-Host "✅ FFmpeg sidecar ready: $OUTPUT_FILE" -ForegroundColor Green

# ─── Get file size ─────────────────────────────────────────────────────────────

$sizeMB = [math]::Round((Get-Item $OUTPUT_FILE).Length / 1MB, 1)
Write-Host "   Size: ${sizeMB} MB" -ForegroundColor Gray

# ─── Cleanup ───────────────────────────────────────────────────────────────────

Write-Host "🧹 Cleaning up temp files..." -ForegroundColor Cyan
Remove-Item -Path $TEMP_DIR -Recurse -Force

# ─── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "🎉 Done! FFmpeg is ready for Tauri sidecar bundling." -ForegroundColor Green
Write-Host "   Binary: $OUTPUT_FILE"
Write-Host "   Target: $TARGET_TRIPLE"
Write-Host ""
Write-Host "   Next step: Run 'npx tauri build' to bundle the app with FFmpeg." -ForegroundColor Yellow
