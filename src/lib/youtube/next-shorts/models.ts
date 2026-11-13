/**
 * What each Google Flow video model can do, from Google Flow Help ("Learn about Flow models &
 * supported features", read 12 Nov 2026). Anything the page doesn't state is 'unknown', never
 * assumed. Veo 3.1 Fast and Quality leave Flow on 5 Dec 2026 and Veo Extend is gone, so they
 * are not offered.
 */
export type Support = true | false | 'unknown';

export interface ModelCaps {
  id: 'omni' | 'veo_lite';
  label: string;
  /** Lengths one generation can have, in seconds. */
  durations: number[];
  /** Lengths that need a Google AI Plus, Pro or Ultra plan. */
  paidDurations: number[];
  textToVideo: Support;
  firstFrame: Support;
  lastFrame: Support;
  /** Reference images ("ingredients") for product, character or place identity. */
  ingredients: Support;
  /** Generation lengths allowed when ingredients are used. */
  ingredientDurations: number[] | null;
  extend: Support | 'paid';
  videoEdit: Support;
  audio: Support;
  resolutions: string[];
  notes: string[];
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const MODELS: Record<ModelCaps['id'], ModelCaps> = {
  omni: {
    id: 'omni',
    label: 'Omni Flash 1.2',
    durations: range(3, 15),
    paidDurations: range(11, 15),
    textToVideo: true,
    firstFrame: true,
    // Google lists "frames to video" for Omni without saying if a last frame is supported.
    lastFrame: 'unknown',
    ingredients: true,
    ingredientDurations: null,
    extend: 'paid',
    videoEdit: true,
    audio: true,
    resolutions: ['360p', '720p', '1080p (upscale)'],
    notes: ['Frames to video is web only.', '11–15 second clips and Extend need Google AI Plus, Pro or Ultra.', 'Draft at 360p (a third of the credits), then upscale.'],
  },
  veo_lite: {
    id: 'veo_lite',
    label: 'Veo 3.1 Lite',
    durations: [4, 6, 8],
    paidDurations: [],
    textToVideo: true,
    firstFrame: true,
    lastFrame: true,
    ingredients: true,
    ingredientDurations: [8],
    extend: false,
    videoEdit: false,
    audio: 'unknown',
    resolutions: ['720p'],
    notes: ['Reference images work only on 8-second clips.'],
  },
};

export type FlowMode = ModelCaps['id'];
export const FLOW_MODES = Object.keys(MODELS) as FlowMode[];

/**
 * The generation length for a shot: the shortest the model can make that covers it (the rest is
 * trimmed in editing). Null when no supported length is long enough.
 */
export function fitGeneration(shotSeconds: number, model: ModelCaps, usesIngredients: boolean): { seconds: number; trim: number } | null {
  const allowed = usesIngredients && model.ingredientDurations ? model.ingredientDurations : model.durations;
  const seconds = allowed.find((d) => d >= shotSeconds);
  return seconds === undefined ? null : { seconds, trim: seconds - shotSeconds };
}
