import { describe, expect, it } from 'vitest';
import { descriptionParts, tagOverlap, traitsOf } from './patterns';

describe('traitsOf', () => {
  it('reads title traits, compilations and length', () => {
    expect(traitsOf({ title: '🔴LIVE | ABC Alphabet Song 🔤', durationSec: 1611 })).toEqual(expect.arrayContaining(['live', 'emoji', 'separator', 'compilation', 'len_long']));
    expect(traitsOf({ title: 'Why is the sky blue?', durationSec: 400 })).toEqual(expect.arrayContaining(['m_why', 'm_question', 'len_mid']));
    expect(traitsOf({ title: 'Delivery tips', durationSec: 40 })).not.toContain('len_short');
    expect(traitsOf({ title: 'Oliver lives here', durationSec: 400 })).not.toContain('live');
    expect(traitsOf({ title: 'NASA found WATER', durationSec: 400 })).toContain('caps');
    expect(traitsOf({ title: 'NASA and DIY', durationSec: 400 })).not.toContain('caps');
  });
});

describe('descriptionParts', () => {
  it('counts playlists, videos, socials and sponsors', () => {
    const d = 'Use code SAVE10 for 10% off\nhttps://youtube.com/playlist?list=PL1\nhttps://youtu.be/abc\nhttps://instagram.com/x\nhttps://shop.example';
    expect(descriptionParts(d, 0, 0)).toMatchObject({ playlists: 1, videoLinks: 1, socialLinks: 1, otherLinks: 1, sponsor: true, lyrics: false });
  });
});

describe('tagOverlap', () => {
  it('finds tags most of the best videos share', () => {
    const r = tagOverlap(['ABC Song', 'mine', 'brand'], [['abc song', 'kids', 'brand'], ['abc song', 'kids', 'brand'], ['abc song', 'other', 'brand']], [['brand'], ['brand', 'x']]);
    expect(r).toEqual({ shared: ['abc song'], missing: ['kids'], boilerplate: ['brand'] });
    expect(tagOverlap(['a'], [['a']], [])).toEqual({ shared: [], missing: [], boilerplate: [] });
  });
});
