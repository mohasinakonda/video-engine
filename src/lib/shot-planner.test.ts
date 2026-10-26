import { describe, expect, it } from 'vitest';
import { maxZoomFor, planShots, shotIndexAt, type PlannerScene, type SpokenWord } from './shot-planner';

/** Words every 0.4 s; a sentence ends (with a 0.5 s pause) after every 8th word. */
function words(from: number, to: number): SpokenWord[] {
  const out: SpokenWord[] = [];
  let t = from;
  let i = 0;
  while (t < to - 0.3) {
    const endOfSentence = i % 8 === 7;
    out.push({ word: endOfSentence ? 'end.' : 'word', start: t, end: t + 0.3 });
    t += endOfSentence ? 0.8 : 0.4;
    i++;
  }
  return out;
}

const scenes: PlannerScene[] = [
  { sceneId: 1, audioStartSec: 0, audioEndSec: 10, cutPace: 'NORMAL', narrationLine: 'a' },
  { sceneId: 2, audioStartSec: 10, audioEndSec: 16, cutPace: 'FAST_CUT', narrationLine: 'b' },
  { sceneId: 3, audioStartSec: 16, audioEndSec: 30, cutPace: 'ATMOSPHERIC_HOLD', narrationLine: 'c' },
];
const base = { totalDurationSec: 30, maxZoom: 1.6, transitionType: 'auto' as const, words: words(0, 30), anglesPerImage: 'several' as const };

describe('planShots: one continuous take per image (default)', () => {
  const focus = new Map([[1, { x: 0.7, y: 0.4 }]]);
  const takes = planShots(scenes, { totalDurationSec: 30, maxZoom: 1.6, transitionType: 'auto', focus });

  it('shows every image exactly once, covering the timeline', () => {
    expect(takes.map((s) => s.sceneId)).toEqual([1, 2, 3]);
    expect(takes[0].start).toBe(0);
    expect(takes[2].end).toBe(30);
    expect(takes[1].start).toBe(takes[0].end);
  });

  it('moves smoothly within the sharp limit, never repeating a move back to back', () => {
    for (const s of takes) for (const f of [s.from, s.to]) expect(f.zoom).toBeGreaterThanOrEqual(1), expect(f.zoom).toBeLessThanOrEqual(1.6);
    for (let i = 1; i < takes.length; i++) expect(takes[i].move).not.toBe(takes[i - 1].move);
  });

  it('always moves the view on screen, even for a subject near the edge', () => {
    const edge = planShots(
      [1, 2, 3, 4, 5, 6].map((id) => ({ sceneId: id, audioStartSec: (id - 1) * 8, audioEndSec: id * 8, cutPace: 'NORMAL' as const })),
      { totalDurationSec: 48, maxZoom: 1.6, transitionType: 'cut', focus: new Map([1, 2, 3, 4, 5, 6].map((id) => [id, { x: 0.92, y: 0.1 }])) }
    );
    for (const s of edge) {
      // Where the view centre really lands after keeping the view inside the image.
      const seen = (f: { zoom: number; x: number; y: number }) => {
        const half = 0.5 / f.zoom;
        return { zoom: f.zoom, x: Math.min(1 - half, Math.max(half, f.x)), y: Math.min(1 - half, Math.max(half, f.y)) };
      };
      const a = seen(s.from);
      const b = seen(s.to);
      const moved = Math.abs(a.zoom - b.zoom) > 0.02 || Math.abs(a.x - b.x) > 0.01 || Math.abs(a.y - b.y) > 0.01;
      expect(moved, `${s.move} on scene ${s.sceneId}`).toBe(true);
    }
  });

  it('pushes in toward the subject (or pulls out from it)', () => {
    const first = takes[0];
    const deep = first.from.zoom > first.to.zoom ? first.from : first.to;
    const wide = deep === first.from ? first.to : first.from;
    if (first.move === 'push_in' || first.move === 'pull_out') {
      expect(deep.x).toBeGreaterThan(wide.x); // toward x = 0.7
      expect(deep.zoom).toBeGreaterThan(wide.zoom);
    }
  });
});

describe('planShots: several angles per image', () => {
  const shots = planShots(scenes, base);

  it('covers the whole timeline without gaps or overlaps', () => {
    expect(shots[0].start).toBe(0);
    expect(shots[shots.length - 1].end).toBe(30);
    for (let i = 1; i < shots.length; i++) expect(shots[i].start).toBeCloseTo(shots[i - 1].end, 6);
  });

  it('splits scenes into several shots by pace, never too short', () => {
    const per = (id: number) => shots.filter((s) => s.sceneId === id);
    expect(per(1).length).toBe(3); // 10 s at ~3.4 s
    expect(per(2).length).toBeGreaterThanOrEqual(2); // fast
    expect(per(3).length).toBeLessThanOrEqual(3); // slow holds
    for (const s of shots) expect(s.end - s.start).toBeGreaterThanOrEqual(1.2 - 1e-9);
  });

  it('cuts just before a word, preferring sentence ends', () => {
    const cuts = shots.slice(1).filter((s, i) => s.sceneId === shots[i].sceneId).map((s) => s.start);
    const wordStarts = base.words.map((w) => w.start - 0.04);
    for (const c of cuts) expect(wordStarts.some((w) => Math.abs(w - c) < 1e-9)).toBe(true);
    // Scene 1's cuts land after "end." words (sentence boundaries) when one is near.
    const scene1Cuts = shots.filter((s) => s.sceneId === 1).slice(1).map((s) => s.start);
    const afterSentence = scene1Cuts.filter((c) => base.words.some((w, i) => w.word === 'end.' && Math.abs(base.words[i + 1]?.start - 0.04 - c) < 1e-9));
    expect(afterSentence.length).toBeGreaterThan(0);
  });

  it('opens each scene wide and changes framing clearly between shots of one image', () => {
    for (let i = 0; i < shots.length; i++) {
      if (i === 0 || shots[i].sceneId !== shots[i - 1].sceneId) {
        expect(shots[i].size).toBe('wide');
        continue;
      }
      const a = shots[i - 1].to.zoom;
      const b = shots[i].from.zoom;
      const sameFocus = Math.abs(shots[i - 1].to.x - shots[i].from.x) < 0.05 && Math.abs(shots[i - 1].to.y - shots[i].from.y) < 0.05;
      expect(Math.max(a, b) / Math.min(a, b) >= 1.15 - 1e-9 || !sameFocus).toBe(true);
    }
  });

  it('never zooms deeper than the sharp limit or wider than the image', () => {
    for (const s of shots) {
      for (const f of [s.from, s.to]) {
        expect(f.zoom).toBeLessThanOrEqual(1.6 + 1e-9);
        expect(f.zoom).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('never repeats a camera move twice in a row', () => {
    for (let i = 1; i < shots.length; i++) expect(shots[i].move).not.toBe(shots[i - 1].move);
  });

  it('cuts within a scene and picks scene transitions by mood', () => {
    for (let i = 1; i < shots.length; i++) {
      if (shots[i].sceneId === shots[i - 1].sceneId) expect(shots[i].transitionIn).toBe('cut');
    }
    const into = (id: number) => shots.find((s) => s.sceneId === id)!.transitionIn;
    expect(into(2)).toBe('zoom_through'); // into a fast scene
    expect(into(3)).toBe('crossfade'); // into a slow, moody scene
  });

  it('follows a fixed transition choice', () => {
    const cut = planShots(scenes, { ...base, transitionType: 'cut' });
    expect(cut.every((s) => s.transitionIn === 'cut')).toBe(true);
    const dip = planShots(scenes, { ...base, transitionType: 'fade_black' });
    expect(dip.filter((s) => s.transitionIn === 'dip').length).toBe(2);
  });

  it('uses only wide and medium when there is no room for a sharp close-up', () => {
    const two = planShots(scenes, { ...base, maxZoom: 1.4 });
    expect(two.some((s) => s.size === 'close')).toBe(false);
    for (let i = 1; i < two.length; i++) {
      if (two[i].sceneId === two[i - 1].sceneId) expect(two[i].size).not.toBe(two[i - 1].size);
    }
  });

  it('keeps one shot per scene when the image cannot be cropped sharply', () => {
    const flat = planShots(scenes, { ...base, maxZoom: 1.15 });
    expect(flat.length).toBe(3);
  });

  it('estimates cuts from punctuation when there are no word timings', () => {
    const plain = planShots(
      [{ sceneId: 1, audioStartSec: 0, audioEndSec: 9, cutPace: 'NORMAL', narrationLine: 'One two three four. Five six seven eight, nine ten eleven twelve.' }],
      { ...base, words: undefined, totalDurationSec: 9 }
    );
    expect(plain.length).toBeGreaterThan(1);
  });

  it('is deterministic', () => {
    expect(planShots(scenes, base)).toEqual(shots);
  });
});

describe('shotIndexAt', () => {
  it('finds the shot on screen', () => {
    const shots = planShots(scenes, base);
    for (const t of [0, 5, 9.99, 10, 15, 29.9]) {
      const s = shots[shotIndexAt(shots, t)];
      expect(t >= s.start && t < s.end).toBe(true);
    }
  });
});

describe('maxZoomFor', () => {
  it('allows deeper crops at lower output resolutions', () => {
    expect(maxZoomFor(576, 1080)).toBeCloseTo(1.6);
    expect(maxZoomFor(576, 720)).toBeCloseTo(2.2);
    expect(maxZoomFor(576, 2160)).toBeCloseTo(1.1);
  });
});
