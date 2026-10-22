import { describe, expect, it } from 'vitest';
import { acceptThumbnails, acceptTitles, cleanDescription, cleanHashtags, withHashtags } from './ai/packager';
import {
  blankThumbnail,
  cleanTags,
  emptyPackaging,
  isComplete,
  mechanismOf,
  missingForPackaged,
  packagingSchema,
  packagingToText,
  statusAfterPackaging,
  thumbnailPrompt,
  type VideoPackaging,
} from './packaging';

const allowed = new Set(['5']);
const title = (t: string, mechanism = 'question') => ({ title: t, mechanism, audience: 'a', risk: 'low', rationale: 'r' });

const filled = (): VideoPackaging => ({
  ...emptyPackaging('English', '2026-10-20T00:00:00.000Z'),
  titles: [{ ...title('Why do deep sea animals glow?'), mechanism: 'why', risk: 'low', source: 'ai' }],
  thumbnails: [{ ...blankThumbnail(), mainSubject: 'An anglerfish', text: 'Living light' }],
  description: 'What glows down there.',
  tags: ['deep sea', 'bioluminescence'],
});

describe('packaging schema and status', () => {
  it('needs a chosen title and thumbnail to be complete', () => {
    const p = filled();
    expect(isComplete(p)).toBe(false);
    expect(missingForPackaged(p)).toEqual(['choose a title', 'choose a thumbnail']);
    expect(isComplete({ ...p, selectedTitle: 0, selectedThumbnail: 0 })).toBe(true);
  });

  it('rejects choices that point at nothing and tags over YouTube’s limit', () => {
    expect(packagingSchema.safeParse({ ...filled(), selectedTitle: 3 }).success).toBe(false);
    expect(packagingSchema.safeParse({ ...filled(), tags: Array(30).fill('a long search phrase here') }).success).toBe(false);
    expect(packagingSchema.safeParse({ ...filled(), selectedTitle: 0, selectedThumbnail: 0 }).success).toBe(true);
  });

  it('moves to PACKAGED only when complete, and only after the script', () => {
    expect(statusAfterPackaging('SCRIPT_READY', true)).toBe('PACKAGED');
    expect(statusAfterPackaging('SCRIPT_READY', false)).toBe('SCRIPT_READY');
    expect(statusAfterPackaging('PACKAGED', false)).toBe('SCRIPT_READY');
    expect(statusAfterPackaging('PACKAGED', true)).toBe('PACKAGED');
    expect(statusAfterPackaging('BRIEF_READY', true)).toBeNull();
    expect(statusAfterPackaging('ARCHIVED', true)).toBeNull();
  });

  it('uses the mechanism the wording shows', () => {
    expect(mechanismOf('How deep sea fish glow', 'why')).toBe('how');
    expect(mechanismOf('Why do fish glow?', 'question')).toBe('question');
    expect(mechanismOf('Fish glow', 'curiosity')).toBe('curiosity');
  });

  it('cleans tags', () => {
    expect(cleanTags(['#Deep sea', 'deep sea', ' fish ', '', 'a<b>'])).toEqual(['Deep sea', 'fish', 'a b']);
  });

  it('exports the chosen package as text', () => {
    const text = packagingToText({ ...filled(), selectedTitle: 0, selectedThumbnail: 0 });
    expect(text).toContain('## Title\nWhy do deep sea animals glow?');
    expect(text).toContain('- Text on the thumbnail: Living light');
    expect(text).toContain('deep sea, bioluminescence');
  });
});

describe('AI output checks', () => {
  it('keeps safe, unique titles and drops hype, invented numbers and duplicates', () => {
    const out = acceptTitles(
      [
        title('Why do 5 deep sea animals glow?'),
        title('90% of the ocean glows'),
        title('This INSANE fish will shock you'),
        title('This viral fish glows'),
        title('why do 5 deep sea animals glow?'),
        title('Kept already'),
        { title: '' },
      ],
      allowed,
      ['Kept already']
    );
    expect(out.map((t) => t.title)).toEqual(['Why do 5 deep sea animals glow?']);
    expect(out[0]).toMatchObject({ mechanism: 'question', source: 'ai' });
  });

  it('allows a count in a title only when the brief says it or the video has that many key points', () => {
    expect(acceptTitles([title('3 ways animals glow')], allowed, [])).toHaveLength(0);
    expect(acceptTitles([title('3 ways animals glow')], allowed, [], 3)).toHaveLength(1);
    expect(acceptTitles([title('৫টি কৌশল')], allowed, [])).toHaveLength(1);
  });

  it('accepts thumbnails with missing optional fields, drops hype', () => {
    const out = acceptThumbnails([{ mainSubject: 'Anglerfish', text: 'Light' }, { mainSubject: 'A viral fish' }, { text: 'no subject' }], allowed);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ mainSubject: 'Anglerfish', composition: '', source: 'ai' });
  });

  it('removes hype, unbacked numbers, links and hashtags from the description', () => {
    expect(cleanDescription('Meet 5 glowing animals. 90% of the sea is dark.\n\nVisit https://x.y now. #ocean rocks. Smash that like button.', allowed)).toBe('Meet 5 glowing animals.');
  });

  it('removes hashtags in any script from the description body', () => {
    expect(cleanDescription('Meet the animals. আলোর মাছ #বিজ্ঞান দেখুন।', allowed)).toBe('Meet the animals.');
  });

  it('keeps three specific hashtags, in any script, and puts them on their own line', () => {
    const tags = cleanHashtags(['#Deep Sea', 'অন্ধকার সমুদ্র', '#viral', '#deepsea', '#Fish!', '#Ocean', 42], allowed);
    expect(tags).toEqual(['#DeepSea', '#অন্ধকারসমুদ্র', '#Fish']);
    expect(withHashtags('Meet the animals.', tags)).toBe('Meet the animals.\n\n#DeepSea #অন্ধকারসমুদ্র #Fish');
    expect(withHashtags('', tags)).toBe('');
  });
});

describe('thumbnailPrompt', () => {
  const idea = { ...blankThumbnail(), mainSubject: 'An anglerfish', supportingObject: 'its glowing lure', composition: 'close up, left third', background: 'pitch black water' };

  it('describes the idea and asks for text the model can draw', () => {
    const { prompt, textLeftOut } = thumbnailPrompt({ ...idea, text: 'Living light' });
    expect(prompt).toContain('An anglerfish');
    expect(prompt).toContain('with its glowing lure');
    expect(prompt).toContain('Background: pitch black water');
    expect(prompt).toContain('text reading "Living light"');
    // Not last: the image route strips a closing quote.
    expect(prompt.endsWith('"')).toBe(false);
    expect(textLeftOut).toBe(false);
  });

  it('leaves out text it can’t draw, and asks for no text when there is none', () => {
    const bangla = thumbnailPrompt({ ...idea, text: 'আলোর মাছ' });
    expect(bangla.prompt).not.toContain('আলোর');
    expect(bangla.prompt).toContain('No text or letters');
    expect(bangla.textLeftOut).toBe(true);
    expect(thumbnailPrompt(idea).textLeftOut).toBe(false);
  });

  it('keeps any text in a prompt meant for other image models', () => {
    const copied = thumbnailPrompt({ ...idea, text: 'আলোর মাছ' }, { anyText: true });
    expect(copied.prompt).toContain('text reading "আলোর মাছ"');
    expect(copied.prompt).not.toContain('No text');
    expect(copied.textLeftOut).toBe(false);
  });
});
