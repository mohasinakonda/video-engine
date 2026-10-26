/**
 * export-frame.ts — draws one frame of the edited video from the shot plan.
 *
 * Shared by the main-thread exporter (HTMLCanvasElement) and the export worker
 * (OffscreenCanvas), so both draw exactly the same frames. Also finds each image's
 * subject (for close-ups) and paints the film look (grade, vignette, grain).
 */

import type { VideoLook } from '@/types';
import { shotIndexAt, type Framing, type ImageFocus, type Shot } from './shot-planner';

export type FrameContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type FrameImage = CanvasImageSource & { width: number; height: number };

/** Deepest zoom the planner can ask for (see maxZoomFor), so images are never prepared smaller than that. */
export const MAX_SHOT_ZOOM = 2.2;

// ─── Camera ────────────────────────────────────────────────────────────────

/** Slow in, slow out (used for transitions). */
const easeInOut = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, p)));

/**
 * Camera progress: nearly constant speed with only a slight softening at the ends, so motion
 * flows on through every cut instead of stopping and restarting at each one.
 */
const cameraProgress = (p: number) => {
  const c = Math.max(0, Math.min(1, p));
  return 0.8 * c + 0.2 * easeInOut(c);
};

function framingAt(shot: Shot, t: number): Framing {
  const p = cameraProgress((t - shot.start) / Math.max(0.001, shot.end - shot.start));
  return {
    // Zoom is interpolated geometrically so a push-in feels like constant speed to the eye.
    zoom: shot.from.zoom * Math.pow(shot.to.zoom / shot.from.zoom, p),
    x: shot.from.x + (shot.to.x - shot.from.x) * p,
    y: shot.from.y + (shot.to.y - shot.from.y) * p,
  };
}

/** Draws the part of `img` that the framing sees, filling the canvas (cover fit × zoom). */
function drawFraming(
  ctx: FrameContext,
  img: FrameImage,
  width: number,
  height: number,
  f: Framing,
  options: { extraZoom?: number; offsetX?: number; offsetY?: number } = {}
) {
  const iw = img.width;
  const ih = img.height;
  const scale = Math.max(width / iw, height / ih) * f.zoom * (options.extraZoom ?? 1);
  const vw = Math.min(iw, width / scale);
  const vh = Math.min(ih, height / scale);
  // Keep the view inside the image: a framing near an edge slides inward instead of showing black.
  const cx = Math.max(vw / 2, Math.min(iw - vw / 2, f.x * iw));
  const cy = Math.max(vh / 2, Math.min(ih - vh / 2, f.y * ih));
  ctx.drawImage(img, cx - vw / 2, cy - vh / 2, vw, vh, options.offsetX ?? 0, options.offsetY ?? 0, width, height);
}

function drawShot(ctx: FrameContext, img: FrameImage, shot: Shot, t: number, width: number, height: number, extraZoom = 1, offsetX = 0) {
  drawFraming(ctx, img, width, height, framingAt(shot, t), { extraZoom, offsetX });
}

// ─── Look ──────────────────────────────────────────────────────────────────

interface LookSpec {
  filter: string;
  tint: string | null;
  tintAlpha: number;
  vignette: number;
  grain: number;
}

const LOOKS: Record<VideoLook, LookSpec> = {
  natural: { filter: 'none', tint: null, tintAlpha: 0, vignette: 0, grain: 0 },
  film: { filter: 'contrast(1.08) saturate(1.05)', tint: '#ffb070', tintAlpha: 0.1, vignette: 0.38, grain: 0.07 },
  warm: { filter: 'contrast(1.04) saturate(1.08)', tint: '#ff9a3c', tintAlpha: 0.16, vignette: 0.26, grain: 0.04 },
  cool: { filter: 'contrast(1.05) saturate(0.94)', tint: '#4f8dff', tintAlpha: 0.14, vignette: 0.26, grain: 0.04 },
};

/**
 * Grades every frame the same way, so AI images with different colours and lighting read as one
 * film: a colour filter while drawing, a soft-light tint, a vignette and moving film grain.
 */
export class LookPainter {
  private spec: LookSpec;
  private vignette: CanvasGradient | null = null;
  private grain: CanvasPattern | null = null;
  private grainSize = 256;

  constructor(look: VideoLook | undefined, private width: number, private height: number) {
    this.spec = LOOKS[look ?? 'natural'] ?? LOOKS.natural;
  }

  /** Colour filter for drawing the images ('none' when the browser can't filter a 2D canvas). */
  filterFor(ctx: FrameContext): string {
    return 'filter' in ctx ? this.spec.filter : 'none';
  }

  paintOverlay(ctx: FrameContext, frameIndex: number) {
    const { width, height, spec } = this;
    if (spec.tint && spec.tintAlpha > 0) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = spec.tintAlpha;
      ctx.fillStyle = spec.tint;
      ctx.fillRect(0, 0, width, height);
    }
    if (spec.vignette > 0) {
      if (!this.vignette) {
        const r = Math.hypot(width, height) / 2;
        this.vignette = ctx.createRadialGradient(width / 2, height / 2, r * 0.45, width / 2, height / 2, r);
        this.vignette.addColorStop(0, 'rgba(0,0,0,0)');
        this.vignette.addColorStop(1, 'rgba(0,0,0,1)');
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = spec.vignette;
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, width, height);
    }
    if (spec.grain > 0) {
      if (!this.grain) this.grain = this.makeGrain(ctx);
      if (this.grain) {
        // A different offset each frame makes the grain dance like real film.
        const ox = (frameIndex * 97) % this.grainSize;
        const oy = (frameIndex * 61) % this.grainSize;
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = spec.grain;
        ctx.fillStyle = this.grain;
        ctx.translate(-ox, -oy);
        ctx.fillRect(ox, oy, width, height);
        ctx.translate(ox, oy);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private makeGrain(ctx: FrameContext): CanvasPattern | null {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const tile = new OffscreenCanvas(this.grainSize, this.grainSize);
    const tctx = tile.getContext('2d');
    if (!tctx) return null;
    const img = tctx.createImageData(this.grainSize, this.grainSize);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    return ctx.createPattern(tile, 'repeat');
  }
}

// ─── Frame ─────────────────────────────────────────────────────────────────

/**
 * Draws the frame at time `t`: the shot on screen, blended with the next shot during its
 * transition window (the last `transitionSec` before the next shot starts), then the look.
 */
export function renderShotFrame(
  ctx: FrameContext,
  images: Map<number, FrameImage>,
  shots: Shot[],
  width: number,
  height: number,
  t: number,
  look: LookPainter,
  frameIndex: number
) {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  if (shots.length === 0) return;

  const i = shotIndexAt(shots, t);
  const cur = shots[i];
  const next = shots[i + 1];
  const curImg = images.get(cur.sceneId);
  const nextImg = next ? images.get(next.sceneId) : undefined;
  const windowStart = next ? next.start - next.transitionSec : Infinity;
  const inTransition = !!next && !!nextImg && next.transitionIn !== 'cut' && next.transitionSec > 0 && t >= windowStart;
  const p = inTransition ? Math.min(1, (t - windowStart) / next.transitionSec) : 0;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = look.filterFor(ctx);

  if (!inTransition) {
    if (curImg) drawShot(ctx, curImg, cur, t, width, height);
  } else {
    // The incoming shot is shown at its opening framing until it takes over.
    const nextT = next.start;
    switch (next.transitionIn) {
      case 'crossfade':
        if (curImg) drawShot(ctx, curImg, cur, t, width, height);
        ctx.globalAlpha = easeInOut(p);
        drawShot(ctx, nextImg!, next, nextT, width, height);
        break;
      case 'dip':
        // Out to black over the first half, in from black over the second.
        if (p < 0.5) {
          if (curImg) drawShot(ctx, curImg, cur, t, width, height);
          ctx.globalAlpha = p * 2;
        } else {
          drawShot(ctx, nextImg!, next, nextT, width, height);
          ctx.globalAlpha = (1 - p) * 2;
        }
        ctx.filter = 'none';
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        break;
      case 'zoom_through':
        // Rush into the outgoing image, and land on the incoming one as it settles back.
        if (curImg) drawShot(ctx, curImg, cur, t, width, height, 1 + 0.45 * p * p);
        ctx.globalAlpha = easeInOut((p - 0.45) / 0.55);
        drawShot(ctx, nextImg!, next, nextT, width, height, 1 + 0.25 * (1 - p));
        break;
      case 'whip': {
        // A fast pan: the outgoing image slides out as the incoming one slides in.
        const e = easeInOut(p);
        if (curImg) drawShot(ctx, curImg, cur, t, width, height, 1, -width * e);
        drawShot(ctx, nextImg!, next, nextT, width, height, 1, width * (1 - e));
        break;
      }
      default:
        if (curImg) drawShot(ctx, curImg, cur, t, width, height);
    }
    ctx.globalAlpha = 1;
  }

  ctx.filter = 'none';
  look.paintOverlay(ctx, frameIndex);
}

// ─── Subject detection ─────────────────────────────────────────────────────

const FOCUS_GRID = 48;

/**
 * Finds where an image's detail is concentrated: in AI art the subject is usually sharp and
 * colourful while the background is soft. Returns the strongest point and, when the image has
 * a second distinct area of interest, that too (for a second close-up).
 */
export function measureFocus(img: FrameImage): ImageFocus {
  const centre: ImageFocus = { x: 0.5, y: 0.5 };
  if (typeof OffscreenCanvas === 'undefined' || !img.width || !img.height) return centre;
  const w = FOCUS_GRID;
  const h = Math.max(8, Math.round((FOCUS_GRID * img.height) / img.width));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return centre;
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return centre; // a cross-origin image without CORS can't be read
  }

  const lum = new Float32Array(w * h);
  const sat = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  const energy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = Math.abs(lum[i + 1] - lum[i - 1]);
      const gy = Math.abs(lum[i + w] - lum[i - w]);
      // Detail plus a little colour, gently favouring the middle (composition rule of thumb).
      const dx = x / w - 0.5;
      const dy = y / h - 0.5;
      energy[i] = (gx + gy + sat[i] * 0.25) * (1 - 0.8 * (dx * dx + dy * dy));
    }
  }
  // Smooth so a region of detail wins over a single noisy pixel.
  const smooth = new Float32Array(w * h);
  const R = 3;
  for (let y = R; y < h - R; y++) {
    for (let x = R; x < w - R; x++) {
      let sum = 0;
      for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) sum += energy[(y + yy) * w + x + xx];
      smooth[y * w + x] = sum;
    }
  }

  let best = -1;
  let bestValue = 0;
  for (let i = 0; i < smooth.length; i++) {
    if (smooth[i] > bestValue) {
      bestValue = smooth[i];
      best = i;
    }
  }
  if (best < 0 || bestValue === 0) return centre;
  // Keep close-ups away from the very edge, where a crop has nothing around the subject.
  const clamp = (v: number) => Math.min(0.8, Math.max(0.2, v));
  const at = (i: number) => ({ x: clamp(((i % w) + 0.5) / w), y: clamp((Math.floor(i / w) + 0.5) / h) });
  const primary = at(best);

  let alt = -1;
  let altValue = bestValue * 0.6;
  for (let i = 0; i < smooth.length; i++) {
    const p = at(i);
    if (Math.hypot(p.x - primary.x, p.y - primary.y) < 0.3) continue;
    if (smooth[i] > altValue) {
      altValue = smooth[i];
      alt = i;
    }
  }
  return alt >= 0 ? { ...primary, alt: at(alt) } : primary;
}

/**
 * The size an image is drawn at when it fills the canvas at the deepest shot zoom (cover fit).
 * Preparing images at this size once means no frame has to scale a bigger source.
 */
export function coverSize(imgWidth: number, imgHeight: number, canvasWidth: number, canvasHeight: number): { width: number; height: number } {
  const imgAspect = imgWidth / imgHeight;
  let w = canvasWidth * MAX_SHOT_ZOOM;
  let h = canvasHeight * MAX_SHOT_ZOOM;
  if (imgAspect > canvasWidth / canvasHeight) w = h * imgAspect;
  else h = w / imgAspect;
  return { width: Math.ceil(w), height: Math.ceil(h) };
}
