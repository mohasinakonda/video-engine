import { describe, expect, it } from 'vitest';
import type { ThumbnailFindings } from '../analysis/thumbnails';
import { buildThemes, cleanComments } from './ai/comments';
import { allowedNumbersOf, checkLessons, fallbackVerdict } from './ai/lessons';
import { thumbnailFindings, titleOverlap } from './thumbnail-audit';

const thumb = (over: Partial<ThumbnailFindings> = {}): ThumbnailFindings => ({
  subject: 'a hyena',
  subjectSizePct: 50,
  faceVisible: false,
  textOnImage: 'MISUNDERSTOOD',
  wordCount: 1,
  contrast: 'high',
  background: 'simple',
  readableAtSmallSize: true,
  ...over,
});

describe('thumbnail findings', () => {
  it('flags what hurts at phone size, and never rates vision above medium', () => {
    const bad = thumbnailFindings(thumb({ readableAtSmallSize: false, wordCount: 7, subjectSizePct: 10, contrast: 'low', background: 'busy' }), 'Hyenas');
    expect(bad.filter((f) => f.kind === 'weakness')).toHaveLength(5);
    expect(bad.every((f) => f.confidence === 'medium')).toBe(true);
    const good = thumbnailFindings(thumb(), 'The hyena story');
    expect(good.map((f) => f.kind)).toEqual(['strength', 'strength']);
    // Vision mistakes animal faces for human ones, so faces aren't reported.
    expect(thumbnailFindings(thumb({ faceVisible: true }), 'x').some((f) => /face/i.test(f.statement))).toBe(false);
  });

  it('catches thumbnail text that repeats the title', () => {
    expect(titleOverlap('Most Misunderstood Animal', 'HYENA: The Most Misunderstood Animal in History')).toBe(1);
    expect(titleOverlap(null, 'x')).toBe(0);
    expect(thumbnailFindings(thumb({ textOnImage: 'Misunderstood animal' }), 'The most misunderstood animal').some((f) => f.statement.includes('repeats the title'))).toBe(true);
    expect(titleOverlap('ভুল বোঝা প্রাণী', 'সবচেয়ে ভুল বোঝা প্রাণী হায়েনা')).toBe(1);
  });
});

describe('viewer themes', () => {
  const comments = cleanComments(['Great video!', 'Great video!', 'see https://spam.example', 'ok', 'Audio is too quiet', 'Sound was low', 'Could barely hear him', 'What about lions?', 'Do lions do this too?', 'Lions next please', 'Loved the animation']);

  it('drops spam, repeats and one-word lines', () => {
    expect(comments).toHaveLength(8);
    expect(comments.some((c) => c.includes('http'))).toBe(false);
  });

  it('takes counts and examples from the real comments, never from the model', () => {
    const themes = buildThemes(
      {
        themes: [
          { kind: 'complaint', theme: 'Audio too quiet', ids: [2, 3, 4, 4, 99] },
          { kind: 'question', theme: 'Wants a lions video', ids: [5, 6, 7] },
          // Reuses ids already taken and has too few left: dropped.
          { kind: 'liked', theme: 'Liked it', ids: [1, 2, 8] },
          { kind: 'liked', theme: 'This viral video rocks', ids: [1, 8, 5] },
        ],
      },
      comments
    );
    expect(themes.map((t) => [t.kind, t.count])).toEqual([
      ['complaint', 3],
      ['question', 3],
    ]);
    expect(themes[0].examples.every((e) => comments.includes(e))).toBe(true);
    expect(buildThemes({ nope: true }, comments)).toEqual([]);
  });
});

describe('lessons', () => {
  it('rejects hype and numbers that aren’t in the findings', () => {
    const allowed = new Set(['2.4']);
    expect(checkLessons({ verdict: 'It did 2.4× its usual thanks to a clear title.', lessons: ['Use a clear subject in the title.', 'Aim for 90% retention.'] }, allowed)).toEqual({
      verdict: 'It did 2.4× its usual thanks to a clear title.',
      lessons: ['Use a clear subject in the title.'],
      titleTemplate: null,
      myVersion: null,
    });
    expect(checkLessons({ verdict: 'A viral hit with 5 million views.', lessons: [] }, allowed)).toBeNull();
    // A bad verdict doesn't throw away good lessons.
    expect(checkLessons({ verdict: 'It got 9 million views.', lessons: ['Use a clear subject in the title.'] }, allowed)).toEqual({ verdict: null, lessons: ['Use a clear subject in the title.'], titleTemplate: null, myVersion: null });
    // The title shape and starting title follow the same checks.
    const shaped = checkLessons({ verdict: 'A clear title did well here.', lessons: [], titleTemplate: '🔴LIVE | [Song name] | [What kids learn]', myVersion: 'The 7 best ABC songs' }, allowed);
    expect(shaped).toMatchObject({ titleTemplate: '🔴LIVE | [Song name] | [What kids learn]', myVersion: 'The 7 best ABC songs' });
    expect(checkLessons({ verdict: 'A clear title did well here.', lessons: [], myVersion: 'The most viral ABC song' }, allowed)?.myVersion).toBeNull();
    expect(checkLessons({ wrong: 1 }, allowed)).toBeNull();
  });

  it('reads thousands separators and allows rounded millions from the input', () => {
    const allowed = allowedNumbersOf('21,326,354 views vs a median of 7,368,662 (2.9×)');
    expect(checkLessons({ verdict: 'It reached 21 million views, 2.9× the usual 7.4 million.', lessons: [] }, allowed)?.verdict).toContain('21 million');
    expect(checkLessons({ verdict: 'It reached 30 million views.', lessons: [] }, allowed)).toBeNull();
  });

  it('has a plain verdict in both languages', () => {
    expect(fallbackVerdict('standout', 'English')).toContain('standout');
    expect(fallbackVerdict('below', 'Bangla')).toContain('খারাপ');
  });
});
