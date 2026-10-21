import { describe, expect, it, vi } from 'vitest';

const replies: string[] = [];
vi.mock('@/lib/llm-providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm-providers')>()),
  callLLM: async () => {
    const content = replies.shift();
    return content === undefined ? null : { content };
  },
}));

import { acceptThumbnails, generatePackaging } from './ai/packager';
import { emptyBrief } from './brief';
import { blankThumbnail, emptyPackaging, type VideoPackaging } from './packaging';
import { emptyScript } from './script';

const brief = { ...emptyBrief('Deep sea creatures', 'English'), corePromise: 'Meet the animals that make their own light', keyPoints: ['Pressure is extreme'], updatedAt: '2026-10-20T10:00:00.000Z' };
const script = emptyScript(brief, 2);
const thumb = (mainSubject: string) => ({ mainSubject, composition: 'Close up, left third', text: 'Living light' });
const titles = [
  { title: 'Why do deep sea animals glow?', mechanism: 'question' },
  { title: 'The animals that make their own light', mechanism: 'curiosity' },
];

const previous = (): VideoPackaging => ({
  ...emptyPackaging('English', script.updatedAt),
  titles: [
    { title: 'My chosen title', mechanism: 'question', audience: '', risk: 'low', rationale: '', source: 'manual' },
    { title: 'Another title', mechanism: 'question', audience: '', risk: 'low', rationale: '', source: 'ai' },
  ],
  selectedTitle: 0,
  thumbnails: [{ ...blankThumbnail(), mainSubject: 'Old idea' }],
  selectedThumbnail: null,
});

describe('acceptThumbnails', () => {
  it('tidies long or listed fields instead of dropping the idea', () => {
    const out = acceptThumbnails(
      [{ mainSubject: 'An anglerfish', composition: 'word '.repeat(80), hierarchy: ['the fish', 'then the light'], text: 'Bold YELLOW text' }],
      new Set()
    );
    expect(out).toHaveLength(1);
    expect(out[0].composition.length).toBeLessThanOrEqual(240);
    expect(out[0].hierarchy).toBe('the fish, then the light');
    expect(out[0].text).toBe('Bold YELLOW text');
  });

  it('still drops hype words and items that aren’t objects', () => {
    expect(acceptThumbnails([{ mainSubject: 'A viral fish' }, 'just text', null], new Set())).toEqual([]);
  });
});

describe('generatePackaging', () => {
  it('asks again when the first answer has titles but no usable thumbnails', async () => {
    replies.push(JSON.stringify({ titles, thumbnails: [] }), JSON.stringify({ titles: [], thumbnails: [thumb('An anglerfish')] }));
    const out = await generatePackaging(brief, script, { models: ['m'] });
    expect(out?.titles).toHaveLength(2);
    expect(out?.thumbnails.map((t) => t.mainSubject)).toEqual(['An anglerfish']);
  });

  it('with only thumbnails, keeps every title and the title choice as they were', async () => {
    replies.push(JSON.stringify({ titles, thumbnails: [thumb('An anglerfish'), thumb('A glowing squid')] }));
    const out = await generatePackaging(brief, script, { models: ['m'], previous: previous(), only: 'thumbnails' });
    expect(out?.titles.map((t) => t.title)).toEqual(['My chosen title', 'Another title']);
    expect(out?.selectedTitle).toBe(0);
    expect(out?.thumbnails.map((t) => t.mainSubject)).toEqual(['An anglerfish', 'A glowing squid']);
  });

  it('with only titles, keeps the thumbnails as they were', async () => {
    replies.push(JSON.stringify({ titles, thumbnails: [thumb('Something new')] }));
    const out = await generatePackaging(brief, script, { models: ['m'], previous: previous(), only: 'titles' });
    expect(out?.thumbnails.map((t) => t.mainSubject)).toEqual(['Old idea']);
    expect(out?.titles[0].title).toBe('My chosen title');
    expect(out?.titles).toHaveLength(3);
  });

  it('gives nothing back (so the run is refunded) when no thumbnail ideas come for a thumbnails-only run', async () => {
    replies.push(JSON.stringify({ titles, thumbnails: [] }), JSON.stringify({ titles, thumbnails: [] }));
    expect(await generatePackaging(brief, script, { models: ['m'], previous: previous(), only: 'thumbnails' })).toBeNull();
  });
});
