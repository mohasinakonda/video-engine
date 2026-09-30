export interface PromptModifier {
  label: string;
  text: string;
}

export const PROMPT_MODIFIERS: PromptModifier[] = [
  { label: '+ Rim Light & Contrast', text: ', sharp chiaroscuro rim lighting, deep atmospheric shadows, high contrast' },
  { label: '+ Split Contrast (L vs R)', text: ', split screen dual visual contrast, striking juxtaposition' },
  { label: '+ Extreme Close-Up', text: ', dramatic extreme close-up, intense shallow depth of field, sharp focal subject' },
  { label: '+ Clean Negative Space', text: ', clean uncluttered negative space on the left for bold text overlay' },
  { label: '+ Minimalist Silhouette', text: ', striking minimalist silhouette, bold graphic shapes, clean composition' },
  { label: '+ Vivid Pop', text: ', vivid cinematic color grading, punchy highlights, dynamic range' },
];
