/**
 * timeline-exporter.ts
 *
 * Universal Timeline Exporter supporting:
 *  - Apple Final Cut Pro 7 XML (xmeml v4) — native to Premiere Pro, DaVinci Resolve, Final Cut Pro
 *  - CMX 3600 EDL (Edit Decision List) — universal standard
 *  - SubRip SRT Subtitles — 1-click captions for CapCut, Premiere, Resolve
 *  - High-Fidelity Master Audio (WAV 44.1kHz 16-bit)
 *  - All-in-one ZIP bundle containing all sequentially numbered media & guides
 *  - Optionally every shot of the edit as its own MP4 clip (camera move and look included),
 *    numbered in order, so the timeline arrives already cut in any editor, CapCut included
 */

import JSZip from 'jszip';
import type { ExportSettings, ProjectManifest, SceneItem } from '@/types';
import { getMediaBlob } from '@/lib/media-storage';
import type { ExportEngine } from '@/lib/export-engine';
import type { Shot } from '@/lib/shot-planner';

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

// ─── 3b. Shot Clip Timeline (XML / EDL / CSV) ─────────────────────────────────

/** A rendered shot clip and where it sits on the timeline, in frames. */
export interface ShotClipEntry {
  fileName: string;
  shot: Shot;
  startFrame: number;
  endFrame: number;
}

export function shotClipName(index: number, count: number): string {
  return `shot_${pad(index + 1, Math.max(3, String(count).length))}.mp4`;
}

export function generateShotFcpXml(
  projectTitle: string,
  clips: ShotClipEntry[],
  totalFrames: number,
  fps: number,
  width: number,
  height: number
): string {
  const rate = `<rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>`;
  const items = clips
    .map((c, i) => {
      const dur = c.endFrame - c.startFrame;
      return `
          <clipitem id="clipitem-shot-${i + 1}">
            <name>${c.fileName}</name>
            <duration>${dur}</duration>
            ${rate}
            <start>${c.startFrame}</start>
            <end>${c.endFrame}</end>
            <in>0</in>
            <out>${dur}</out>
            <file id="file-shot-${i + 1}">
              <name>${c.fileName}</name>
              <pathurl>media/shots/${c.fileName}</pathurl>
              ${rate}
              <duration>${dur}</duration>
              <media>
                <video>
                  <samplecharacteristics>
                    <width>${width}</width>
                    <height>${height}</height>
                  </samplecharacteristics>
                </video>
              </media>
            </file>
          </clipitem>`;
    })
    .join('');
  const audio = `
          <clipitem id="clipitem-audio-master">
            <name>master_voice.wav</name>
            <duration>${totalFrames}</duration>
            ${rate}
            <start>0</start>
            <end>${totalFrames}</end>
            <in>0</in>
            <out>${totalFrames}</out>
            <file id="file-audio-master">
              <name>master_voice.wav</name>
              <pathurl>media/audio/master_voice.wav</pathurl>
              ${rate}
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
    <name>${escapeXml(projectTitle || 'AI Video Project')}</name>
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
            ${rate}
          </samplecharacteristics>
        </format>
        <track>${items}
        </track>
      </video>
      <audio>
        <track>${audio}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`;
}

export function generateShotEdl(projectTitle: string, clips: ShotClipEntry[], fps: number): string {
  const lines = [`TITLE: ${projectTitle.replace(/[^a-zA-Z0-9_\- ]/g, '_').substring(0, 40) || 'PROJECT'}`, 'FCM: NON-DROP FRAME', ''];
  clips.forEach((c, i) => {
    const dur = (c.endFrame - c.startFrame) / fps;
    lines.push(
      `${pad(i + 1, 3)}  AX       V     C        ${secToSmpteTimecode(0, fps)} ${secToSmpteTimecode(dur, fps)} ${secToSmpteTimecode(c.startFrame / fps, fps)} ${secToSmpteTimecode(c.endFrame / fps, fps)}`
    );
    lines.push(`* FROM CLIP NAME: ${c.fileName}`);
    lines.push('');
  });
  return lines.join('\n');
}

export function generateShotCueSheetCsv(clips: ShotClipEntry[], scenes: SceneItem[], fps: number): string {
  const narration = new Map(scenes.map((s) => [s.sceneId, s.narrationLine || '']));
  const rows = ['Shot,Clip File,Scene,Shot Size,Camera Move,Start (s),End (s),Duration (s),SMPTE In,SMPTE Out,Scene Narration'];
  clips.forEach((c, i) => {
    const start = c.startFrame / fps;
    const end = c.endFrame / fps;
    const text = `"${(narration.get(c.shot.sceneId) || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    rows.push(
      `${i + 1},${c.fileName},${c.shot.sceneId},${c.shot.size},${c.shot.move},${start.toFixed(3)},${end.toFixed(3)},${(end - start).toFixed(3)},${secToSmpteTimecode(start, fps)},${secToSmpteTimecode(end, fps)},${text}`
    );
  });
  return rows.join('\n');
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

function generateReadmeGuide(
  projectTitle: string,
  sceneCount: number,
  durationSec: number,
  format: { width: number; height: number; fps: number; shotCount: number | null }
): string {
  const shotGuide =
    format.shotCount === null
      ? ''
      : `
--------------------------------------------------------------------------------
0. SHOT CLIPS — THE EDIT, ALREADY CUT (${format.shotCount} clips)
--------------------------------------------------------------------------------
'media/shots/' holds every shot of the edit as its own MP4 (camera move and look
included, no sound): shot_001.mp4, shot_002.mp4 ... in order.
Placed back to back they are exactly as long as the narration, frame for frame.

CapCut / any editor: select ALL files in 'media/shots/' (sorted by name), drag them
onto the timeline in one go, then drag 'media/audio/master_voice.wav' under them,
both starting at 0:00. Add your own transitions, captions, music and sound effects.
Premiere / Resolve / Final Cut: import 'timeline.xml' — it already uses the shot clips.
`;
  return `================================================================================
   UNIVERSAL TIMELINE PACKAGE — ${projectTitle.toUpperCase()}
================================================================================
Total Scenes: ${sceneCount}
Total Duration: ~${Math.round(durationSec)} seconds
Resolution: ${format.width}x${format.height}
Framerate: ${format.fps} FPS
${shotGuide}
This package allows you to import and edit this project in ANY video editor:
CapCut, Adobe Premiere Pro, DaVinci Resolve, Final Cut Pro, Filmora, VN, etc.

--------------------------------------------------------------------------------
1. HOW TO USE IN CAPCUT (DESKTOP OR MOBILE)
--------------------------------------------------------------------------------
Step 1: Open CapCut and create a "New Project".
${
    format.shotCount === null
      ? `Step 2: Drag and drop all images from 'media/images/' into your timeline.
        (They are numbered sequentially scene_001.jpg, scene_002.jpg in order).`
      : `Step 2: Drag and drop all clips from 'media/shots/' into your timeline.
        (They are numbered in order: shot_001.mp4, shot_002.mp4 ...).`
  }
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
- media/shots/           -> Every shot of the edit as an MP4 clip, in order (when included)
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

export interface TimelineExportOptions {
  /** The export page's resolution, frame rate, transitions and look (1080p/30 when missing). */
  settings?: ExportSettings;
  /** Renders every shot as an MP4 clip with this engine (skipped when it can't render here). */
  shotClipsEngine?: ExportEngine;
  /** Writes the ZIP straight to this file instead of building it in memory; the result is then null. */
  saveTo?: FileSystemFileHandle | null;
}

export async function exportUniversalTimelineZip(
  project: ProjectManifest,
  onProgress?: (progress: TimelineExportProgress) => void,
  options: TimelineExportOptions = {}
): Promise<Blob | null> {
  const updateProgress = (message: string, percentage: number) => {
    if (onProgress) onProgress({ message, percentage });
  };

  updateProgress('Initializing universal timeline package...', 5);

  const zip = new JSZip();
  const imagesFolder = zip.folder('media/images')!;
  const audioFolder = zip.folder('media/audio')!;

  const scenes = project.scenes || [];
  const audioChunks = project.audioChunks || [];
  const settings: ExportSettings = options.settings ?? { resolution: '1080p', encoder: 'auto', outputPath: '' };
  let fps: number = settings.fps ?? 30;
  let width = 1920;
  let height = 1080;
  // Media files are already compressed; deflating them again only costs time.
  const STORE = { compression: 'STORE' as const };

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

    if (imageBlob) imagesFolder.file(fileName, imageBlob, STORE);

    const pct = 10 + Math.round(((i + 1) / Math.max(1, sortedScenes.length)) * 5);
    updateProgress(`Packing scene image ${i + 1}/${sortedScenes.length}...`, pct);
  }

  // ─── Step A2: Render Every Shot as a Clip ───────────────────────────────────
  let shotClips: ShotClipEntry[] | null = null;
  if (options.shotClipsEngine) {
    updateProgress('Rendering shot clips...', 15);
    const rendered = await options.shotClipsEngine.renderShotClips({
      projectId: project.projectId,
      scenes,
      settings,
      words: project.spokenWords,
      durationSec: totalDurationSec,
      onProgress: (done, total) => updateProgress(`Rendering shot clips: ${Math.round((done / total) * 100)}%`, 15 + Math.round((done / total) * 50)),
    });
    if (rendered) {
      fps = rendered.fps;
      width = rendered.width;
      height = rendered.height;
      const shotsFolder = zip.folder('media/shots')!;
      shotClips = [];
      rendered.shots.forEach((shot, i) => {
        const clip = rendered.clips[i];
        if (!clip) return; // shorter than one frame
        const fileName = shotClipName(shotClips!.length, rendered.shots.length);
        shotsFolder.file(fileName, clip, STORE);
        shotClips!.push({ fileName, shot, startFrame: Math.round(shot.start * fps), endFrame: Math.round(shot.end * fps) });
      });
    }
  }

  // ─── Step B: Collect & Mix Audio into Master WAV ────────────────────────────
  updateProgress('Processing and stitching audio timeline...', 66);

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

  if (masterWavBlob) audioFolder.file('master_voice.wav', masterWavBlob, STORE);

  if (audioContext) {
    audioContext.close().catch(() => {});
  }

  // ─── Step C: Generate Timeline Files ────────────────────────────────────────
  updateProgress('Generating FCP XML, EDL, and SRT captions...', 75);

  const cleanTitle = (project.title || 'Untitled_Project').trim();

  // 1–2. FCP 7 XML and CMX 3600 EDL: the shot clips when rendered, else the scene images
  const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));
  if (shotClips) {
    zip.file('timeline.xml', generateShotFcpXml(cleanTitle, shotClips, totalFrames, fps, width, height));
    zip.file('timeline.edl', generateShotEdl(cleanTitle, shotClips, fps));
    zip.file('shots_cuesheet.csv', generateShotCueSheetCsv(shotClips, scenes, fps));
  } else {
    zip.file('timeline.xml', generateFcpXml(cleanTitle, scenes, totalDurationSec, fps, width, height));
    zip.file('timeline.edl', generateEdl(cleanTitle, scenes, fps));
  }

  // 3. SubRip SRT Subtitles
  const srt = generateSrt(scenes);
  zip.file('subtitles.srt', srt);

  // 4. Cue Sheet CSV
  const csv = generateCueSheetCsv(scenes, fps);
  zip.file('timeline_cuesheet.csv', csv);

  // 5. README Guide
  const readme = generateReadmeGuide(cleanTitle, scenes.length, totalDurationSec, { width, height, fps, shotCount: shotClips?.length ?? null });
  zip.file('README_HOW_TO_IMPORT.txt', readme);

  // ─── Step D: Compress and Finalize ZIP ──────────────────────────────────────
  updateProgress('Compressing timeline package ZIP...', 85);

  if (options.saveTo) {
    // Streamed to disk piece by piece, so a long video's clips never sit in memory as one ZIP.
    const writable = await options.saveTo.createWritable();
    try {
      await new Promise<void>((resolve, reject) => {
        let writes = Promise.resolve();
        zip
          .generateInternalStream({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, streamFiles: true })
          .on('data', (data, metadata) => {
            writes = writes.then(() => writable.write(data as Uint8Array<ArrayBuffer>));
            updateProgress(`Writing ZIP: ${Math.round(metadata.percent)}%`, 85 + Math.round((metadata.percent / 100) * 14));
          })
          .on('error', reject)
          .on('end', () => writes.then(resolve, reject))
          .resume();
      });
      await writable.close();
    } catch (err) {
      await writable.abort().catch(() => {});
      throw err;
    }
    updateProgress('Timeline package saved!', 100);
    return null;
  }

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
