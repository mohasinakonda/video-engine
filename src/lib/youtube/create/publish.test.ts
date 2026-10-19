import { describe, expect, it } from 'vitest';
import { blankThumbnail, emptyPackaging } from './packaging';
import { findReminders, linkStatusFor, parseVideoId, projectTitles, rankCandidates, titleSimilarity, type Upload } from './publish';

const ID = 'dQw4w9WgXcQ';

describe('parseVideoId', () => {
  it('reads ids from every common link shape', () => {
    for (const input of [
      ID,
      `https://www.youtube.com/watch?v=${ID}`,
      `youtube.com/watch?v=${ID}&t=42s`,
      `https://m.youtube.com/watch?feature=share&v=${ID}`,
      `https://youtu.be/${ID}?si=abc`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://youtube.com/live/${ID}?feature=share`,
      `https://www.youtube.com/embed/${ID}`,
    ]) {
      expect(parseVideoId(input), input).toBe(ID);
    }
  });

  it('rejects other sites and malformed ids', () => {
    expect(parseVideoId(`https://evil.com/watch?v=${ID}`)).toBeNull();
    expect(parseVideoId('https://youtube.com/watch?v=short')).toBeNull();
    expect(parseVideoId('not a link')).toBeNull();
  });
});

const upload = (videoId: string, title: string, publishedAt = '2026-10-22T10:00:00Z', privacy: Upload['privacy'] = 'public'): Upload => ({
  videoId,
  title,
  thumbnailUrl: null,
  publishedAt,
  privacy,
  scheduledFor: null,
});

const project = {
  id: 'p1',
  title: 'Deep sea glow',
  createdAt: '2026-10-20T00:00:00Z',
  packaging: {
    ...emptyPackaging('English', ''),
    titles: [
      { title: 'Why Deep Sea Creatures Glow', mechanism: 'why', audience: '', risk: 'low', rationale: '', source: 'ai' },
      { title: 'The Secret Language of Glowing Sea Creatures', mechanism: 'curiosity', audience: '', risk: 'low', rationale: '', source: 'ai' },
    ],
    thumbnails: [{ ...blankThumbnail(), mainSubject: 'fish' }],
    selectedTitle: 1,
    selectedThumbnail: 0,
  },
};

describe('matching uploads to a project', () => {
  it('compares titles by words, tolerating edits and Bangla', () => {
    expect(titleSimilarity('Why Deep Sea Creatures Glow', 'Why deep-sea creatures GLOW (explained)')).toBe(1);
    expect(titleSimilarity('Why Deep Sea Creatures Glow', 'My morning routine')).toBe(0);
    expect(titleSimilarity('কেন গভীর সমুদ্রের প্রাণীরা আলো জ্বালায়?', 'গভীর সমুদ্রের প্রাণীরা কেন আলো জ্বালায়')).toBe(1);
  });

  it('puts the chosen title first', () => {
    expect(projectTitles(project)[0]).toBe('The Secret Language of Glowing Sea Creatures');
    expect(projectTitles({ title: 'Only this', packaging: null })).toEqual(['Only this']);
  });

  it('suggests the best match, ignores linked videos, and suggests nothing when unsure', () => {
    const uploads = [upload('aaaaaaaaaaa', 'My morning routine'), upload('bbbbbbbbbbb', 'The secret language of glowing sea creatures!'), upload('ccccccccccc', 'Glowing sea creatures, part 2')];
    const ranked = rankCandidates(project, uploads, new Set());
    expect(ranked.suggestion).toBe('bbbbbbbbbbb');
    expect(ranked.candidates.map((c) => c.videoId)[0]).toBe('bbbbbbbbbbb');

    expect(rankCandidates(project, uploads, new Set(['bbbbbbbbbbb'])).candidates.some((c) => c.videoId === 'bbbbbbbbbbb')).toBe(false);
    expect(rankCandidates(project, [upload('aaaaaaaaaaa', 'My morning routine')], new Set()).suggestion).toBeNull();
  });

  it('prefers videos published after the project started', () => {
    const old = upload('ooooooooooo', 'Why deep sea creatures glow', '2025-01-01T00:00:00Z');
    const fresh = upload('nnnnnnnnnnn', 'Why deep sea creatures glow');
    expect(rankCandidates(project, [old, fresh], new Set()).candidates[0].videoId).toBe('nnnnnnnnnnn');
  });

  it('tracks only public videos', () => {
    expect(linkStatusFor({ privacy: 'public' })).toBe('tracking');
    expect(linkStatusFor({ privacy: 'private' })).toBe('waiting_public');
    expect(linkStatusFor({ privacy: 'unlisted' })).toBe('waiting_public');
  });

  it('pairs each new upload with at most one waiting project', () => {
    const other = { id: 'p2', title: 'Morning routine for creators', createdAt: '2026-10-20T00:00:00Z', packaging: null };
    const uploads = [upload('bbbbbbbbbbb', 'The secret language of glowing sea creatures'), upload('aaaaaaaaaaa', 'My morning routine for creators')];
    const reminders = findReminders([project, other], uploads, new Set());
    expect(reminders.map((r) => [r.projectId, r.video.videoId])).toEqual(
      expect.arrayContaining([
        ['p1', 'bbbbbbbbbbb'],
        ['p2', 'aaaaaaaaaaa'],
      ])
    );
    expect(reminders).toHaveLength(2);
    expect(findReminders([project], uploads, new Set(['bbbbbbbbbbb']))).toHaveLength(0);
  });
});
