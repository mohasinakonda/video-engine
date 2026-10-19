import type { TitleFeatures, VideoMeta } from '../types';

/** Measurable title traits. Interpretation (clarity, promise) is left to the AI, with these as input. */
export function titleFeatures(video: Pick<VideoMeta, 'id' | 'title'>): TitleFeatures {
  const title = video.title.trim();
  const words = title.split(/\s+/).filter(Boolean);
  return {
    videoId: video.id,
    length: Array.from(title).length,
    words: words.length,
    hasNumber: /\d/.test(title),
    hasQuestion: /\?/.test(title),
    hasBrackets: /[([{【]/.test(title),
    capsWords: words.filter((w) => w.length > 1 && /[A-Z]/.test(w) && w === w.toUpperCase()).length,
  };
}
