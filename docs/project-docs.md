# Technical Project Documentation: AI Video Studio Desktop

---

## 1. Project Overview & System Architecture

**AI Video Studio Desktop** is a local-first, cross-platform desktop application designed to convert long-form narration scripts into fully produced, long-duration (up to 30 minutes) videos. It eliminates server-side encoding costs and user queuing by running compute-heavy operations directly on the user's host machine using **Tauri v2**, **Next.js**, and an embedded **FFmpeg sidecar**.

The application uses a **Bring Your Own Key (BYOK)** model for Google Gemini Multimodal APIs, preventing API cost liabilities on the host infrastructure while delegating resource exhaustion to client-side throttling queues.

```
+-----------------------------------------------------------------------------------+
|                            Next.js Client Application                             |
|                                                                                   |
|  +-----------------------+  +------------------------+  +----------------------+  |
|  |     Script Input      |  |  Voice Studio Manager  |  |  Base Style Presets  |  |
|  |  - Full script paste  |  |  - Character, Pace     |  |  - Visual Consistency|  |
|  |  - Word/Time metrics  |  |  - Scene/SampleContext |  |  - Aspect Ratio      |  |
|  +-----------+-----------+  +-----------+------------+  +----------+-----------+  |
|              |                          |                          |              |
|              +--------------------------+--------------------------+              |
|                                         |                                         |
|                                         v                                         |
|                       +-----------------------------------+                       |
|                       |   Orchestration & Queue Manager   |                       |
|                       |   - Semantic chunking (3 min)     |                       |
|                       |   - Scene prompt parser (~3.5s)   |                       |
|                       |   - Rate limiters & Checkpoints   |                       |
|                       +-----------------+-----------------+                       |
+-----------------------------------------|-----------------------------------------+
                                          | Tauri IPC Bridge (Invoke / Events)
+-----------------------------------------v-----------------------------------------+
|                               Tauri Core Runtime                                  |
|                                                                                   |
|  +-----------------------+  +------------------------+  +----------------------+  |
|  |     Plugin Store      |  |       Plugin FS        |  |    Notification &    |  |
|  |  - AES-256 Key Vault  |  |  - Disk Cache Manager  |  |     Native Dialog    |  |
|  |  - Preset configs     |  |  - Project chunk paths |  |  - OS alerts / Pickers| |
|  +-----------------------+  +-----------+------------+  +----------------------+  |
|                                         |                                         |
|                                         v                                         |
|                       +-----------------------------------+                       |
|                       |       FFmpeg Sidecar Manager      |                       |
|                       |   - Ken Burns motion engine       |                       |
|                       |   - Audio concat & auto-ducking   |                       |
|                       |   - Hardware-accelerated encoding |                       |
|                       +-----------------+-----------------+                       |
+-----------------------------------------|-----------------------------------------+
                                          v
                              +-----------------------+
                              |   Local File System   |
                              |   - Target Output MP4 |
                              +-----------------------+

```

---

## 2. Technical Stack Specifications

| Layer | Technology | Role & Configuration |
| --- | --- | --- |
| **Shell Framework** | Tauri v2 | Native OS windowing, file-system bridge, sidecar process isolation |
| **UI Framework** | Next.js (SSG mode) | Static single-page application loaded via native WebViews |
| **Styling & Icons** | Tailwind CSS / Lucide React | Dark-mode native dashboard interface |
| **Media Processing** | Bundled FFmpeg (Sidecar) | Video stitching, audio mixing, Ken Burns motion filters, HW acceleration |
| **Local Persistence** | `@tauri-apps/plugin-store` | Local encrypted storage for API keys and JSON preset configurations |
| **File Operations** | `@tauri-apps/plugin-fs` | Local directory asset streaming and project cleanup |
| **AI Integration** | Google Gemini Multimodal APIs | Text parsing, audio/speech generation, image prompt orchestration |

---

## 3. Directory & File Structure

```text
ai-video-studio/
├── src/                               # Next.js Source Code
│   ├── app/
│   │   ├── layout.tsx                 # Root layout, theme providers
│   │   ├── page.tsx                   # Main studio project dashboard
│   │   ├── settings/
│   │   │   └── page.tsx               # BYOK vault & connection validator
│   │   └── voice-studio/
│   │       └── page.tsx               # Voice presets, Scene/Context editor
│   ├── components/
│   │   ├── audio-timeline.tsx         # Chunk playback and status cards
│   │   ├── export-modal.tsx           # Quality presets, BGM, export progress
│   │   ├── script-input.tsx           # Text input with live word metrics
│   │   └── storyboard-grid.tsx        # Scene preview and prompt regenerator
│   ├── lib/
│   │   ├── ffmpeg.ts                  # Tauri sidecar IPC execution wrappers
│   │   ├── gemini.ts                  # Gemini Multimodal Audio & Text client
│   │   ├── queue.ts                   # Throttling worker for batch API requests
│   │   └── store.ts                   # Tauri plugin store accessors
│   └── types/
│       └── index.d.ts                 # Project, Preset, and Scene interfaces
├── src-tauri/                         # Tauri Core Runtime
│   ├── binaries/
│   │   ├── ffmpeg-x86_64-pc-windows-msvc.exe
│   │   └── ffmpeg-x86_64-apple-darwin
│   ├── capabilities/
│   │   └── default.json               # Security policies and FS permissions
│   ├── src/
│   │   ├── lib.rs                     # Plugin registration & command handlers
│   │   └── main.rs                    # Entrypoint
│   ├── Cargo.toml                     # Rust dependencies
│   └── tauri.conf.json                # Sidecar, window, and security declarations
├── next.config.mjs                    # Next.js SSG output configuration
├── package.json
└── tsconfig.json

```

---

## 4. Data Models & Schemas

### 4.1 Voice Preset

```typescript
export interface VoicePreset {
  id: string;
  name: string;
  voiceCharacter: "Aoede" | "Charon" | "Fenrir" | "Kore" | "Puck" | string;
  scene: string;          // Environmental baseline
  sampleContext: string;  // Stylistic entry point
  pace: number;           // 0.75 - 1.50 (Step: 0.05)
  accent: string;
  isDefault: boolean;
  createdAt: number;
}

```

### 4.2 Base Visual Style Preset

```typescript
export interface BaseStylePreset {
  id: string;
  name: string;
  stylePrompt: string;       // Enforced suffix for all scene prompts
  negativePrompt: string;
  aspectRatio: "16:9" | "9:16";
  isDefault: boolean;
}

```

### 4.3 Scene & Project Manifest

```typescript
export interface SceneItem {
  id: string;
  index: number;
  audioChunkIndex: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  narrationSnippet: string;
  visualPrompt: string;
  imagePath?: string;
  motionClipPath?: string;
  motionType: "ZOOM_IN" | "ZOOM_OUT" | "PAN_LEFT" | "PAN_RIGHT";
  status: "PENDING" | "GENERATING" | "COMPLETED" | "FAILED";
}

export interface ProjectManifest {
  projectId: string;
  title: string;
  rawScript: string;
  voicePresetId: string;
  baseStyleId: string;
  audioChunks: {
    index: number;
    filePath: string;
    durationMs: number;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  }[];
  scenes: SceneItem[];
  bgmPath?: string;
  bgmVolume: number;
  enableDucking: boolean;
  outputResolution: "1080p" | "4k";
  finalOutputPath?: string;
  updatedAt: number;
}

```

---

## 5. Implementation Phases & Workflows

### Phase 1: Engine Initialization & Audio Generation

```
[Full Script Input] 
         │
         ▼
[Gemini Semantic Chunking] (Target: ~400-450 words / 3 mins per block)
         │
         ▼
[Sequential Queue Dispatch] ──> Inject Scene & SampleContext
         │
         ▼
[Gemini Multimodal Audio Generation] 
         │
         ▼
[Tauri FS Cache Write] ──> `{AppLocalDataDir}/projects/{id}/audio/chunk_{n}.wav`
         │
         ▼
[Metadata Extractor] ──> Compute and record exact millisecond durations

```

#### Audio Prompt Construction

```text
Role: Professional Voice Actor
Directorial Guidance:
- Scene Environment: {preset.scene}
- Contextual Delivery: {preset.sampleContext}
- Persona: {preset.voiceCharacter}
- Speaking Pace: {preset.pace}x
- Dialect/Accent: {preset.accent}

Instructions:
Deliver the narrative entering naturally using the scene and context anchors.
Do not insert conversational meta-filler, introductions, or conversational closings.
Read ONLY the exact script provided below:

[SCRIPT]
{chunkText}

```

---

### Phase 2: Scene Generation & Motion Engine

#### 1. Audio-Synced Scene Partitioning

For each audio chunk $k$ with duration $D_k$, the total number of scenes $S_k$ is computed using a random window of $3.0\text{s} \le \Delta t \le 4.0\text{s}$:


$$\sum_{i=1}^{S_k} \Delta t_i = D_k$$

Gemini partitions the text corresponding to these time slices and constructs visual prompts appended with the active `BaseStylePreset.stylePrompt`.

#### 2. Throttled Image Generation Pipeline

* Max concurrency: 3 concurrent requests.
* Rate Limit Backoff: On HTTP 429, pause worker for 10 seconds, retry with exponential backoff ($2^n \times 1000\text{ms}$).
* Destination: `{AppLocalDataDir}/projects/{id}/scenes/scene_{index}.jpg`.

#### 3. Ken Burns Motion Parameters (FFmpeg Sidecar)

Each static image is encoded into an individual intermediate motion clip based on its assigned motion profile.

* **Zoom In (Center):**
```bash
-loop 1 -i scene_{i}.jpg -vf "zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps=30" -c:v libx264 -t {duration} -pix_fmt yuv420p clip_{i}.mp4

```


* **Zoom Out:**
```bash
-loop 1 -i scene_{i}.jpg -vf "zoompan=z='if(lte(zoom,1.0),1.15,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps=30" -c:v libx264 -t {duration} -pix_fmt yuv420p clip_{i}.mp4

```


* **Pan Left to Right:**
```bash
-loop 1 -i scene_{i}.jpg -vf "zoompan=z=1.1:x='if(lte(on,-1),(it/duration)*(iw-iw/zoom),x)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps=30" -c:v libx264 -t {duration} -pix_fmt yuv420p clip_{i}.mp4

```



---

### Phase 3: Final Timeline Assembly & Audio Ducking

```
[Audio Chunks 1..N] ────> [FFmpeg Concat] ──> [Master Voice Track]
                                                        │
[Motion Clips 1..M] ───> [FFmpeg Concat Demuxer]        │
                                   │                    │
[Optional BGM] ────────────────────┼────────────────────┼──> [amix / sidechaincompress]
                                   │                    │        (Auto-Ducking: -18dB)
                                   ▼                    ▼
                        +------------------------------------+
                        |       Final Hardware Encoder       |
                        |   (h264_nvenc / qsv / libx264)     |
                        +-----------------+------------------+
                                          │
                                          ▼
                             [Exported 30-min MP4]

```

#### FFmpeg Sidechain Ducking Filter

When background music (Input 1) is present alongside the master audio (Input 0):

```bash
-i master_voice.wav -stream_loop -1 -i bgm.mp3 -filter_complex "[1:a]volume=0.15[bgm];[bgm][0:a]sidechaincompress=threshold=0.08:ratio=4:attack=200:release=1000[ducked_bgm];[0:a][ducked_bgm]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k final_output.mp4

```

---

## 6. Tauri Configuration Files

### 6.1 `next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

```

### 6.2 `src-tauri/tauri.conf.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/tooling/cli/schema.json",
  "productName": "AI Video Studio",
  "version": "0.1.0",
  "identifier": "com.aivideostudio.desktop",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:3000",
    "frontendDist": "../out"
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": [
      "binaries/ffmpeg"
    ]
  },
  "plugins": {
    "store": {},
    "fs": {
      "scope": ["$APPLOCALDATA/*", "$DOWNLOAD/*"]
    },
    "dialog": {},
    "notification": {}
  }
}

```

---

## 7. Error Handling Matrix

| Failure Mode | Detection Point | Automated Recovery Policy | User Escalation |
| --- | --- | --- | --- |
| **Invalid Gemini API Key** | Pre-flight validation | Reject project generation initiation | Highlight API input box in Settings view |
| **API Throttling (429)** | Audio/Image HTTP response | Exponential backoff: Pause queue for 10s, retry chunk | Display warning badge on affected card with retry countdown |
| **FFmpeg Out of Memory (OOM)** | Sidecar process exit code | Fall back to slower CPU profile (`-preset veryfast` instead of `-preset medium`) | Suggest reducing resolution to 1080p if attempting 4K |
| **Audio-Video Drift** | Assembly stage verification | Calculate duration delta; adjust video timeline via `-vf tpad` | Log adjustment silently in render timeline |
| **Disk Space Exhaustion** | Phase 2 image batch write | Halt active queue; prevent corruption of existing chunks | Alert user to clear drive space or run temp purge |

---

## 8. Development Setup & Build Instructions

### Prerequisites

* **Node.js**: `v20.x` or higher
* **Rust Toolchain**: `rustup` with stable MSVC (Windows) or Clang (macOS)
* **Visual Studio Build Tools**: C++ build tools installed (Windows)

### Installation Steps

1. **Clone and Install Dependencies:**
```bash
git clone <repo-url>
cd ai-video-studio
npm install

```


2. **Place FFmpeg Sidecar Binaries:**
Place platform-specific binaries into `src-tauri/binaries/`:
* Windows: `ffmpeg-x86_64-pc-windows-msvc.exe`
* macOS (Apple Silicon): `ffmpeg-aarch64-apple-darwin`


3. **Run Application in Local Development Mode:**
```bash
npm run tauri dev

```


4. **Compile Distribution Release:**
```bash
npm run tauri build

```


Compiled installers will be placed in `src-tauri/target/release/bundle/`.