import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nameKey, scriptIssues, videoTagFor } from './checks';
import { agentInstructions, clipsBlock, editingSteps, imagesBlock } from './flow';
import type { ProductFacts, VideoPack, VideoScript } from './types';
import { writeSeo, writeVideoPack } from './writer';

const llm = vi.hoisted(() => ({ answers: [] as string[], calls: 0 }));
vi.mock('@/lib/llm-providers', async (orig) => ({
  ...(await orig<typeof import('@/lib/llm-providers')>()),
  callLLM: async () => {
    llm.calls++;
    const content = llm.answers.shift();
    return content ? { content, model: 'test' } : null;
  },
}));

const products: ProductFacts[] = [
  { asin: 'B0AAAAAAA1', title: 'AstroAI Windshield Cleaner Tool', brand: 'AstroAI', bullets: ['Extendable handle reaches the whole windshield'], imageUrl: null },
  { asin: 'B0AAAAAAA2', title: 'Invisible Glass Foaming Cleaner', brand: 'Invisible Glass', bullets: ['Streak-free formula'], imageUrl: null },
];

const vo = (name: string) =>
  `${name} reaches every corner of the windshield with its long handle, so you clean the glass without stretching and the result stays clear and bright.`;
const clip = (asin: string, productName: string, over: Partial<VideoScript['clips'][number]> = {}) => ({
  asin,
  productName,
  startImage: 'The product in a gloved hand inside a car, morning light',
  subject: 'A gloved hand holding the cleaner',
  action: 'The pad glides across the inside of the windshield',
  camera: { position: 'Close-up from the passenger seat', movement: 'none' as const },
  setting: 'Inside a clean sedan',
  lighting: 'Soft morning light through the glass',
  voiceover: vo(productName),
  onScreenText: productName,
  ...over,
});
const good: VideoScript = {
  hook: 'Two glass tools worth it.',
  look: 'Bright, clean car interiors, warm daylight',
  voice: 'energetic, friendly American narrator',
  clips: [
    clip('B0AAAAAAA1', 'Windshield Cleaner Tool', { voiceover: `Two glass tools worth it. ${vo('Windshield Cleaner Tool')}`.split(' ').slice(0, 28).join(' ') }),
    clip('B0AAAAAAA2', 'Foaming Glass Cleaner'),
  ],
};

describe('scriptIssues', () => {
  it('passes a script that keeps the rules', () => {
    expect(scriptIssues(good, products)).toEqual([]);
  });

  it('flags order, length, a missing name, price claims, two actions and the hook', () => {
    const bad: VideoScript = {
      ...good,
      clips: [
        clip('B0AAAAAAA2', 'Foaming Glass Cleaner', { voiceover: 'Only $9.99, the best ever spray.', action: 'The hand sprays the glass, then wipes it' }),
        clip('B0AAAAAAA1', 'Windshield Cleaner Tool', {
          voiceover: 'It reaches every corner of the glass with its long handle, so you clean without stretching and the result stays clear and bright all day.',
        }),
      ],
    };
    const issues = scriptIssues(bad, products).join('\n');
    expect(issues).toMatch(/one clip per product, in this order: B0AAAAAAA1, B0AAAAAAA2/);
    expect(issues).toMatch(/clip-1: the voiceover has 6 words/);
    expect(issues).toMatch(/clip-1: no prices/);
    expect(issues).toMatch(/clip-1: one action only/);
    expect(issues).toMatch(/clip-2: say the product’s name/);
    expect(issues).toMatch(/clip-1: the voiceover must start with the hook/);
  });

  it('names products by their first meaningful words and tags videos by niche and date', () => {
    expect(nameKey('The Mini Car Vacuum Set')).toEqual(['mini', 'car']);
    expect(videoTagFor('Kitchen & Dining', new Date('2026-11-13T10:00:00Z'))).toBe('kitchen-and-dining-1113');
    expect(videoTagFor('!!!', new Date('2026-01-02T00:00:00Z'))).toBe('picks-0102');
  });
});

const pack: VideoPack = {
  version: 1,
  model: 'veo_lite',
  domain: 'US',
  label: 'Car Care',
  videoTag: 'car-care-1113',
  products,
  script: good,
  issues: [],
  createdAt: '2026-11-13T00:00:00Z',
};

describe('flow text', () => {
  it('writes the Agent Instructions for a fast, honest review on the creator’s photos', () => {
    const t = agentInstructions(pack);
    expect(t).toMatch(/16 seconds, 2 products, 8 seconds each.*Veo 3\.1 Lite/);
    expect(t).toContain('Keep each product exactly as in its photo');
    expect(t).toContain('Generate right away');
    expect(t).not.toMatch(/wait for my OK/);
  });

  it('lists the photos, then a start image per clip, then clip-1: [Product name] blocks', () => {
    expect(imagesBlock(pack)).toMatch(/IMAGE P1 \(upload your own photo\): AstroAI[\s\S]*START IMAGE S2 \(edit of IMAGE P2, keep the product identical\)/);
    const clips = clipsBlock(pack);
    expect(clips).toMatch(/^Make these 2 clips, 8 seconds each/);
    expect(clips).toContain('clip-1: [Windshield Cleaner Tool]\nStart frame: START IMAGE S1. Product reference: IMAGE P1.');
    expect(clips).toContain('clip-2: [Foaming Glass Cleaner]');
    expect(clips).toContain('CAMERA: Close-up from the passenger seat. Static camera, no movement.');
    expect(editingSteps(pack)[0]).toBe('Join the clips in order in Scenebuilder: 1. Windshield Cleaner Tool · 2. Foaming Glass Cleaner. Cut straight, no fades.');
  });
});

describe('writers', () => {
  beforeEach(() => {
    llm.answers = [];
    llm.calls = 0;
  });

  it('writes the pack, rewrites once when a rule breaks, and keeps the products’ order', async () => {
    const broken = { ...good, clips: [good.clips[1], good.clips[0]] };
    llm.answers = [JSON.stringify(broken), JSON.stringify(good)];
    const p = await writeVideoPack(
      {
        domain: 'US',
        model: 'omni',
        label: 'Car Care',
        products: products.map((x) => ({ asin: x.asin, title: x.title, brand: x.brand, featureBullets: x.bullets, imageUrl: null })),
      },
      products,
      ['m'],
    );
    expect(llm.calls).toBe(2);
    expect(p?.issues).toEqual([]);
    expect(p?.script.clips.map((c) => c.asin)).toEqual(['B0AAAAAAA1', 'B0AAAAAAA2']);
    expect(p?.videoTag).toMatch(/^car-care-\d{4}$/);
  });

  it('writes SEO with the bio link, the disclosure, 3 hashtags and only good titles', async () => {
    llm.answers = [
      JSON.stringify({
        titles: [
          { title: 'Car glass tools that actually work', angle: 'result' },
          { title: 'Clean windshield in seconds', angle: 'speed' },
        ],
        thumbnail: { concept: 'Both tools on a dashboard', imagePrompt: 'Two glass cleaning tools', text: 'Streak-free' },
        description: 'Clear glass without streaks.\n1. Windshield Cleaner Tool\n2. Foaming Glass Cleaner\nLinks: {BIO_LINK}',
        keywords: ['car glass cleaner', 'windshield tool'],
        hashtags: ['carcare', '#shorts', '#cleaning', '#glass', '#detailing'],
      }),
    ];
    const seo = await writeSeo({ label: 'Car Care', hook: 'h', productNames: ['A'], productTitles: ['A'] }, 'https://bio.rendoza.com/@dd?q=car-care-1113', ['m']);
    expect(seo?.titles.map((t) => t.title)).toEqual(['Car glass tools that actually work']);
    expect(seo?.description).toContain('Links: https://bio.rendoza.com/@dd?q=car-care-1113');
    expect(seo?.description).toContain('As an Amazon Associate I earn from qualifying purchases.');
    expect(seo?.hashtags).toEqual(['#carcare', '#cleaning', '#glass']);
  });
});
