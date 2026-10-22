import { describe, expect, it } from 'vitest';
import type { ThumbnailFindings } from '../analysis/thumbnails';
import { compareVideos } from './compare';
import { compareCost } from './pricing';
import type { VideoAuditOutput } from './run-video';

const thumb = (over: Partial<ThumbnailFindings> = {}): ThumbnailFindings => ({
  subject: 's', subjectSizePct: 60, faceVisible: false, textOnImage: 'Hidden cost', wordCount: 2, contrast: 'high', background: 'simple', readableAtSmallSize: true, ...over,
});

const audit = (over: Partial<VideoAuditOutput> & { title?: string } = {}): VideoAuditOutput => ({
  language: 'English',
  format: 'video',
  ageDays: 30,
  performance: { label: 'typical', ratio: 1, baselineViews: 1000, baselineSample: 12, likeRate: 0.03, baselineLikeRate: 0.03, commentRate: 0.001, baselineCommentRate: 0.001 },
  findings: [],
  limitations: [],
  patterns: null,
  description: { lyrics: false, playlists: 0, videoLinks: 0, socialLinks: 0, otherLinks: 0, sponsor: false, chapters: 0, hashtags: 0 },
  tags: { all: [], shared: [], missing: [], boilerplate: [], from: null },
  madeForKids: null,
  video: { id: 'v', title: over.title ?? 'How I fixed my laptop', channelId: 'c', channelTitle: 'Ch', thumbnailUrl: null, publishedAt: '', durationSec: 600, views: 1000 },
  isOwn: false,
  thumbnail: thumb(),
  viewers: null,
  verdict: '',
  lessons: [],
  titleTemplate: null,
  myVersion: null,
  ...over,
});

describe('compareVideos', () => {
  it('states clear differences, each against its own channel', () => {
    const yours = audit({
      title: 'I tried fixing my old laptop and here is everything that happened along the way today',
      thumbnail: thumb({ readableAtSmallSize: false, contrast: 'low', background: 'busy', subjectSizePct: 20, textOnImage: 'old laptop fixed', wordCount: 3 }),
    });
    const theirs = audit({
      title: 'Why old laptops die?',
      performance: { ...yours.performance, label: 'standout', ratio: 4 },
      findings: [{ id: 'm', area: 'metadata', kind: 'strength', statement: 'It has chapters, which help viewers jump to what they want and show up in search.', evidence: null, confidence: 'high' }],
    });
    const { rows, differences } = compareVideos(yours, theirs);
    const said = differences.map((d) => d.statement).join('\n');
    expect(said).toContain('Theirs did far better for its channel');
    expect(said).toContain('cut off on phones');
    expect(said).toContain('reads at phone size');
    expect(said).toContain('higher contrast');
    expect(said).toContain('background is simpler');
    expect(said).toContain('fills much more of the frame');
    expect(said).toContain('repeats your title');
    expect(said).toContain('They have chapters');
    expect(said).toMatch(/Their title uses .*why/i);
    expect(rows.find((r) => r.label === 'Readable at phone size')).toMatchObject({ yours: 'No', theirs: 'Yes', differs: true });
  });

  it('stays quiet when the two are alike, and handles missing thumbnails', () => {
    expect(compareVideos(audit(), audit()).differences).toEqual([]);
    const rows = compareVideos(audit({ thumbnail: null }), audit()).rows;
    expect(rows.find((r) => r.label === 'Thumbnail')).toMatchObject({ yours: 'Not judged', theirs: 'Read' });
  });

  it('costs two video analyses', () => {
    expect(compareCost({ videoAuditCreditCost: 5 })).toBe(10);
  });
});
