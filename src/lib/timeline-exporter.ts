/**
 * timeline-exporter.ts
 *
 * Universal Timeline Exporter supporting:
 *  - Apple Final Cut Pro 7 XML (xmeml v4) — native to Premiere Pro, DaVinci Resolve, Final Cut Pro
 *  - CMX 3600 EDL (Edit Decision List) — universal standard
 *  - SubRip SRT Subtitles — 1-click captions for CapCut, Premiere, Resolve
 *  - High-Fidelity Master Audio (WAV 44.1kHz 16-bit)
 *  - All-in-one ZIP bundle containing all sequentially numbered media & guides
 */

import JSZip from 'jszip';
import { ProjectManifest, SceneItem } from '@/types';
import { getMediaBlob } from '@/lib/media-storage';

// ─── Helpers: Timecode Formatting ─────────────────────────────────────────────

function pad(num: number, size: number = 2): string {
  let s = String(Math.floor(num));
  while (s.length < size) s = '0' + s;
  return s;
}

/** Converts seconds into standard SMPTE timecode HH:MM:SS:FF at given FPS */
export function secToSmpteTimecode(seconds: number, fps: number = 30): string {
  const totalFrames = Math.max(0, Math.round(seconds * fps));
  const f = totalFrames % fps;
  const totalS = Math.floor(totalFrames / fps);
  const s = totalS % 60;
  const totalM = Math.floor(totalS / 60);
  const m = totalM % 60;
  const h = Math.floor(totalM / 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

/** Converts seconds into SubRip SRT format HH:MM:SS,mmm */
export function secToSrtTimecode(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const totalM = Math.floor(totalS / 60);
  const m = totalM % 60;
  const h = Math.floor(totalM / 60);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── 1. SubRip Subtitles (.srt) Generator ─────────────────────────────────────

export function generateSrt(scenes: SceneItem[]): string {
  const sorted = [...scenes].sort((a, b) => a.audioStartSec - b.audioStartSec);
  const lines: string[] = [];

  sorted.forEach((scene, index) => {
    const text = (scene.narrationLine || scene.visualPrompt || '').trim();
    if (!text) return;

    const start = secToSrtTimecode(scene.audioStartSec || 0);
    const end = secToSrtTimecode(Math.max(scene.audioEndSec || 0, (scene.audioStartSec || 0) + 1));

    lines.push(String(index + 1));
    lines.push(`${start} --> ${end}`);
    lines.push(text);
    lines.push('');
  });

  return lines.join('\n');
}

// ─── 2. CMX 3600 EDL Generator ────────────────────────────────────────────────

export function generateEdl(projectTitle: string, scenes: SceneItem[], fps: number = 30): string {
  const sorted = [...scenes].sort((a, b) => a.audioStartSec - b.audioStartSec);
  const lines: string[] = [];

  lines.push(`TITLE: ${projectTitle.replace(/[^a-zA-Z0-9_\- ]/g, '_').substring(0, 40) || 'PROJECT'}`);
  lines.push('FCM: NON-DROP FRAME\n');

  sorted.forEach((scene, idx) => {
    const eventNum = pad(idx + 1, 3);
    const clipName = `scene_${pad(scene.sceneId, 3)}.jpg`;

    const sceneDurationSec = Math.max(0.5, (scene.audioEndSec || 0) - (scene.audioStartSec || 0));
    const srcIn = secToSmpteTimecode(0, fps);
    const srcOut = secToSmpteTimecode(sceneDurationSec, fps);

    const recIn = secToSmpteTimecode(scene.audioStartSec || 0, fps);
    const recOut = secToSmpteTimecode(scene.audioEndSec || (scene.audioStartSec || 0) + sceneDurationSec, fps);

    // Format: 001  AX       V     C        00:00:00:00 00:00:05:00 00:00:00:00 00:00:05:00
    lines.push(`${eventNum}  AX       V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`);
    lines.push(`* FROM CLIP NAME: ${clipName}`);
    if (scene.narrationLine) {
      lines.push(`* COMMENT: ${scene.narrationLine.replace(/\n/g, ' ').substring(0, 70)}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

// ─── 3. FCP 7 XML (xmeml v4) Generator ────────────────────────────────────────

export function generateFcpXml(
  projectTitle: string,
  scenes: SceneItem[],
  totalDurationSec: number,
  fps: number = 30,
  width: number = 1920,
  height: number = 1080
): string {
  const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));
  const safeTitle = escapeXml(projectTitle || 'AI Video Project');

  let videoClipItems = '';
  const sorted = [...scenes].sort((a, b) => a.audioStartSec - b.audioStartSec);

  sorted.forEach((scene) => {
    const startFrame = Math.round((scene.audioStartSec || 0) * fps);
    const rawEnd = scene.audioEndSec || (scene.audioStartSec || 0) + 3;
    const endFrame = Math.max(startFrame + 1, Math.round(rawEnd * fps));
    const clipDuration = endFrame - startFrame;

    const clipName = `scene_${pad(scene.sceneId, 3)}.jpg`;
    const clipId = `clipitem-scene-${scene.sceneId}`;
    const fileId = `file-scene-${scene.sceneId}`;

    // Calculate motion keyframes based on scene motion profile
    const motionProfile = scene.motionProfile || (scene.sceneId % 4 === 0 ? 'zoom_in' : scene.sceneId % 4 === 1 ? 'zoom_out' : scene.sceneId % 4 === 2 ? 'pan_left' : 'pan_right');
    let startScale = 100;
    let endScale = 100;
    let startHoriz = 0;
    let endHoriz = 0;

    if (motionProfile === 'zoom_in') {
      startScale = 100;
      endScale = 115;
    } else if (motionProfile === 'zoom_out') {
      startScale = 115;
      endScale = 100;
    } else if (motionProfile === 'pan_left') {
      startScale = 110;
      endScale = 110;
      startHoriz = 0.05;
      endHoriz = -0.05;
    } else if (motionProfile === 'pan_right') {
      startScale = 110;
      endScale = 110;
      startHoriz = -0.05;
      endHoriz = 0.05;
    }

    videoClipItems += `
          <clipitem id="${clipId}">
            <name>${clipName}</name>
            <duration>${clipDuration}</duration>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>0</in>
            <out>${clipDuration}</out>
            <file id="${fileId}">
              <name>${clipName}</name>
              <pathurl>media/images/${clipName}</pathurl>
              <rate>
                <timebase>${fps}</timebase>
                <ntsc>FALSE</ntsc>
              </rate>
              <duration>${clipDuration}</duration>
              <media>
                <video>
                  <samplecharacteristics>
                    <width>${width}</width>
                    <height>${height}</height>
                  </samplecharacteristics>
                </video>
              </media>
            </file>
            <!-- Editable Motion Keyframe Layer (Basic Motion: Zoom & Pan) -->
            <filter>
              <effect>
                <name>Basic Motion</name>
                <effectid>basic</effectid>
                <effectcategory>motion</effectcategory>
                <effecttype>motion</effecttype>
                <mediatype>video</mediatype>
                <parameter authoringApp="PremierePro">
                  <parameterid>scale</parameterid>
                  <name>Scale</name>
                  <valuemin>0</valuemin>
                  <valuemax>1000</valuemax>
                  <valuelist>
                    <value>100</value>
                  </valuelist>
                  <keyframe>
                    <when>0</when>
                    <value>${startScale}</value>
                  </keyframe>
                  <keyframe>
                    <when>${clipDuration}</when>
                    <value>${endScale}</value>
                  </keyframe>
                </parameter>
                <parameter authoringApp="PremierePro">
                  <parameterid>center</parameterid>
                  <name>Center</name>
                  <keyframe>
                    <when>0</when>
                    <value>
                      <horiz>${startHoriz}</horiz>
                      <vert>0</vert>
                    </value>
                  </keyframe>
                  <keyframe>
                    <when>${clipDuration}</when>
                    <value>
                      <horiz>${endHoriz}</horiz>
                      <vert>0</vert>
                    </value>
                  </keyframe>
                </parameter>
              </effect>
            </filter>
          </clipitem>`;
  });

  // Audio track referencing the master voice audio file
  const audioClipItem = `
          <clipitem id="clipitem-audio-master">
            <name>master_voice.wav</name>
            <duration>${totalFrames}</duration>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <start>0</start>
            <end>${totalFrames}</end>
            <in>0</in>
            <out>${totalFrames}</out>
            <file id="file-audio-master">
              <name>master_voice.wav</name>
              <pathurl>media/audio/master_voice.wav</pathurl>
              <rate>
                <timebase>${fps}</timebase>
                <ntsc>FALSE</ntsc>
              </rate>
              <duration>${totalFrames}</duration>
              <media>
                <audio>
                  <samplecharacteristics>
                    <samplerate>44100</samplerate>
                    <depth>16</depth>
                  </samplecharacteristics>
                  <channelcount>2</channelcount>
                </audio>
              </media>
            </file>
          </clipitem>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${safeTitle}</name>
    <duration>${totalFrames}</duration>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${width}</width>
            <height>${height}</height>
            <pixelaspectratio>square</pixelaspectratio>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
          </samplecharacteristics>
        </format>
        <track>${videoClipItems}
        </track>
      </video>
      <audio>
        <track>${audioClipItem}
        </track>
        <track>${audioClipItem}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`;
}

// ─── 4. Timing Cue Sheet & CSV ────────────────────────────────────────────────

export function generateCueSheetCsv(scenes: SceneItem[], fps: number = 30): string {
  const sorted = [...scenes].sort((a, b) => a.audioStartSec - b.audioStartSec);
  const rows: string[] = [
    'Scene Number,Image File,Start Time (s),End Time (s),Duration (s),SMPTE Timecode In,SMPTE Timecode Out,Narration Script,Visual Motif',
  ];

  sorted.forEach((s) => {
    const dur = Math.max(0, (s.audioEndSec || 0) - (s.audioStartSec || 0));
    const tcIn = secToSmpteTimecode(s.audioStartSec || 0, fps);
    const tcOut = secToSmpteTimecode(s.audioEndSec || 0, fps);
    const narration = `"${(s.narrationLine || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    const visual = `"${(s.visualPrompt || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

    rows.push(
      `${s.sceneId},scene_${pad(s.sceneId, 3)}.jpg,${(s.audioStartSec || 0).toFixed(2)},${(s.audioEndSec || 0).toFixed(2)},${dur.toFixed(2)},${tcIn},${tcOut},${narration},${visual}`
    );
  });

  return rows.join('\n');
}

// ─── 5. Web Audio Buffer to WAV Converter ─────────────────────────────────────

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const byteLength = 44 + numSamples * blockAlign;
  const arrayBuffer = new ArrayBuffer(byteLength);
  const view = new DataView(arrayBuffer);

  // Write ASCII string helper
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + numSamples * blockAlign, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, numSamples * blockAlign, true);

  // Interleave and clamp 16-bit PCM samples
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp between -1.0 and 1.0
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer (-32768 to 32767)
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// ─── 6. README Guide Generation ───────────────────────────────────────────────

function generateReadmeGuide(projectTitle: string, sceneCount: number, durationSec: number): string {
  return `================================================================================
   UNIVERSAL TIMELINE PACKAGE — ${projectTitle.toUpperCase()}
================================================================================
Total Scenes: ${sceneCount}
Total Duration: ~${Math.round(durationSec)} seconds
Resolution: Standard 1080p (1920x1080)
Framerate: 30 FPS

This package allows you to import and edit this project in ANY video editor:
CapCut, Adobe Premiere Pro, DaVinci Resolve, Final Cut Pro, Filmora, VN, etc.

--------------------------------------------------------------------------------
1. HOW TO USE IN CAPCUT (DESKTOP OR MOBILE)
--------------------------------------------------------------------------------
Step 1: Open CapCut and create a "New Project".
Step 2: Drag and drop all images from 'media/images/' into your timeline.
        (They are numbered sequentially scene_001.jpg, scene_002.jpg in order).
Step 3: Drag 'media/audio/master_voice.wav' onto the audio track.
Step 4: AUTOMATIC CAPTIONS:
        In CapCut, click 'Text' (top left) -> 'Local captions' / 'Import captions'
        Select 'subtitles.srt' from this folder!
        CapCut will automatically create perfectly timed animated subtitle cards
        for every single scene synchronized with the voiceover!

--------------------------------------------------------------------------------
2. HOW TO USE IN ADOBE PREMIERE PRO
--------------------------------------------------------------------------------
Step 1: Open Adobe Premiere Pro.
Step 2: Go to Menu: File -> Import... (or press Ctrl+I / Cmd+I).
Step 3: Select 'timeline.xml' from this folder.
Step 4: Premiere will instantly create a timeline sequence with all scene images
        and master audio synced frame-for-frame!

--------------------------------------------------------------------------------
3. HOW TO USE IN DAVINCI RESOLVE
--------------------------------------------------------------------------------
Step 1: Open DaVinci Resolve and open your project.
Step 2: Go to Menu: File -> Import Timeline -> Import AAF, EDL, XML...
Step 3: Select 'timeline.xml'.
Step 4: Resolve will automatically create the complete multi-track sequence.

--------------------------------------------------------------------------------
4. HOW TO USE IN FINAL CUT PRO
--------------------------------------------------------------------------------
Step 1: Open Final Cut Pro.
Step 2: Go to Menu: File -> Import -> XML...
Step 3: Select 'timeline.xml'.

--------------------------------------------------------------------------------
PACKAGE CONTENTS:
--------------------------------------------------------------------------------
- timeline.xml           -> FCP 7 XML timeline (Premiere Pro, DaVinci Resolve, FCP)
- timeline.edl           -> CMX 3600 standard Edit Decision List
- subtitles.srt          -> Auto-timed captions for CapCut / Premiere / Resolve
- timeline_cuesheet.csv  -> Detailed spreadsheet of scene timings and narration
- media/images/          -> High-resolution scene artwork in sequence
- media/audio/           -> Master synchronized voiceover (WAV) & chunk audio

================================================================================
Generated by AI Video Studio Engine
================================================================================
`;
}

// ─── 7. Main Export Function: Create Universal Timeline ZIP ───────────────────

export interface TimelineExportProgress {
  message: string;
  percentage: number;
}

export async function exportUniversalTimelineZip(
  project: ProjectManifest,
  onProgress?: (progress: TimelineExportProgress) => void
): Promise<Blob> {
  const updateProgress = (message: string, percentage: number) => {
    if (onProgress) onProgress({ message, percentage });
  };

  updateProgress('Initializing universal timeline package...', 5);

  const zip = new JSZip();
  const imagesFolder = zip.folder('media/images')!;
  const audioFolder = zip.folder('media/audio')!;

  const scenes = project.scenes || [];
  const audioChunks = project.audioChunks || [];
  const fps = 30;
  const width = 1920;
  const height = 1080;

  // Calculate duration
  const sceneMaxSec = scenes.length > 0 ? Math.max(...scenes.map((s) => s.audioEndSec || 0)) : 0;
  const projectDurationSec = project.totalDurationMs ? project.totalDurationMs / 1000 : sceneMaxSec;
  const totalDurationSec = Math.max(1, projectDurationSec || sceneMaxSec || 30);

  // ─── Step A: Collect & Package Scene Images ─────────────────────────────────
  updateProgress('Collecting scene images...', 15);
  const sortedScenes = [...scenes].sort((a, b) => a.sceneId - b.sceneId);

  for (let i = 0; i < sortedScenes.length; i++) {
    const scene = sortedScenes[i];
    const fileName = `scene_${pad(scene.sceneId, 3)}.jpg`;

    let imageBlob: Blob | null = null;

    // Try in-memory / state imageUrl
    if (scene.imageUrl) {
      try {
        const res = await fetch(scene.imageUrl);
        if (res.ok) imageBlob = await res.blob();
      } catch {
        // Continue to IndexedDB
      }
    }

    // Try IndexedDB
    if (!imageBlob) {
      imageBlob = await getMediaBlob(`scene_${project.projectId}_${scene.sceneId}`);
    }

    if (imageBlob) {
      const arrayBuf = await imageBlob.arrayBuffer();
      imagesFolder.file(fileName, arrayBuf);
    }

    const pct = 15 + Math.round(((i + 1) / Math.max(1, sortedScenes.length)) * 30);
    updateProgress(`Packing scene image ${i + 1}/${sortedScenes.length}...`, pct);
  }

  // ─── Step B: Collect & Mix Audio into Master WAV ────────────────────────────
  updateProgress('Processing and stitching audio timeline...', 50);

  let masterWavBlob: Blob | null = null;
  const audioContext = typeof window !== 'undefined'
    ? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    : null;

  const sortedChunks = [...audioChunks].sort((a, b) => a.index - b.index);
  const decodedBuffers: AudioBuffer[] = [];

  if (audioContext) {
    for (let i = 0; i < sortedChunks.length; i++) {
      const chunk = sortedChunks[i];
      let arrayBuf: ArrayBuffer | null = null;

      if (chunk.audioUrl) {
        try {
          const res = await fetch(chunk.audioUrl);
          if (res.ok) arrayBuf = await res.arrayBuffer();
        } catch {
          // Fall back to IndexedDB
        }
      }

      if (!arrayBuf) {
        const storedBlob = await getMediaBlob(`audio_${project.projectId}_${chunk.index}`);
        if (storedBlob) arrayBuf = await storedBlob.arrayBuffer();
      }

      if (arrayBuf && arrayBuf.byteLength > 0) {
        try {
          // Also save individual chunk audio to zip
          audioFolder.file(`chunk_${pad(chunk.index, 3)}.mp3`, arrayBuf.slice(0));

          const decoded = await audioContext.decodeAudioData(arrayBuf.slice(0));
          decodedBuffers.push(decoded);
        } catch (decErr) {
          console.warn(`Could not decode chunk ${chunk.index}:`, decErr);
        }
      }
    }

    const totalAudioSeconds = decodedBuffers.reduce((acc, b) => acc + b.duration, 0);

    if (totalAudioSeconds > 0) {
      const sampleRate = 44100;
      const totalSamples = Math.ceil(totalAudioSeconds * sampleRate);
      const offlineCtx = new OfflineAudioContext(2, Math.max(1, totalSamples), sampleRate);

      let playhead = 0;
      for (const buf of decodedBuffers) {
        const src = offlineCtx.createBufferSource();
        src.buffer = buf;
        src.connect(offlineCtx.destination);
        src.start(playhead);
        playhead += buf.duration;
      }

      const stitchedBuffer = await offlineCtx.startRendering();
      masterWavBlob = audioBufferToWavBlob(stitchedBuffer);
    }
  }

  if (masterWavBlob) {
    const wavBuffer = await masterWavBlob.arrayBuffer();
    audioFolder.file('master_voice.wav', wavBuffer);
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
  }

  // ─── Step C: Generate Timeline Files ────────────────────────────────────────
  updateProgress('Generating FCP XML, EDL, and SRT captions...', 75);

  const cleanTitle = (project.title || 'Untitled_Project').trim();

  // 1. FCP 7 XML
  const fcpXml = generateFcpXml(cleanTitle, scenes, totalDurationSec, fps, width, height);
  zip.file('timeline.xml', fcpXml);

  // 2. CMX 3600 EDL
  const edl = generateEdl(cleanTitle, scenes, fps);
  zip.file('timeline.edl', edl);

  // 3. SubRip SRT Subtitles
  const srt = generateSrt(scenes);
  zip.file('subtitles.srt', srt);

  // 4. Cue Sheet CSV
  const csv = generateCueSheetCsv(scenes, fps);
  zip.file('timeline_cuesheet.csv', csv);

  // 5. README Guide
  const readme = generateReadmeGuide(cleanTitle, scenes.length, totalDurationSec);
  zip.file('README_HOW_TO_IMPORT.txt', readme);

  // ─── Step D: Compress and Finalize ZIP ──────────────────────────────────────
  updateProgress('Compressing timeline package ZIP...', 85);

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      const pct = 85 + Math.round((metadata.percent / 100) * 14);
      updateProgress(`Compressing ZIP: ${Math.round(metadata.percent)}%`, pct);
    }
  );

  updateProgress('Timeline package ready!', 100);
  return zipBlob;
}
