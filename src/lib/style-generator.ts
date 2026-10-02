'use client';

import { getPollinationsClient, getStoredPollinationsKey } from '@/lib/pollinations';

export interface StyleSynthesisParams {
  genre?: string;
  medium?: string;
  userNotes?: string;
  scriptSnippet?: string;
}

export interface SynthesizedStyleResult {
  name: string;
  stylePrompt: string;
  negativePrompt: string;
  rationale: string;
}

export async function synthesizeUniqueStylePrompt(
  params: StyleSynthesisParams
): Promise<SynthesizedStyleResult> {
  const { genre = 'Documentary & Lore', medium = 'Cinematic Film', userNotes = '', scriptSnippet = '' } = params;
  const apiKey = getStoredPollinationsKey();
  const client = getPollinationsClient(apiKey);

  const systemInstruction = `You are a master film director and art concept designer (for BBC, A24, and Criterion Collection).
Your task is to craft a 100% UNIQUE, award-winning Visual Art Style Prompt for an AI video generation engine.

CRITICAL MULTI-SCENE CONSISTENCY MANDATE:
The style prompt you create will act as the IMMUTABLE ARTISTIC ANCHOR across every scene of the video.
It must lock:
1. ARTISTIC MEDIUM & TECHNIQUE: (e.g. "35mm anamorphic photography", "hand-carved linocut relief print on fibrous paper", "Studio Ghibli hand-painted gouache animation").
2. MATERIAL & TEXTURE: Enumerate tactile details (e.g. film grain, chiseled grooves, cotton paper bleed, optical bokeh).
3. COLOR PALETTE DNA: Define a tight, cohesive palette envelope (e.g. "charcoal, muted terracotta peach and sage olive", or "golden hour amber with deep indigo shadows").

DO NOT lock rigid specific scene subjects or static actions. The anchor must be applicable to ANY scene subject while maintaining 100% medium consistency.

ANTI-SLOP NEGATIVE PROMPT:
Provide a strong negative prompt specifically tailored to prevent generic CGI, plastic airbrushed AI looks, modern clutter, text, and watermarks.

OUTPUT FORMAT:
Return strictly a valid JSON object with these exact keys:
{
  "name": "Evocative, memorable style name (3-5 words)",
  "stylePrompt": "Studio-grade style prompt (45-80 words) specifying medium, material texture, color DNA, and camera optics",
  "negativePrompt": "Strict negative exclusion constraints (20-40 words)",
  "rationale": "Brief 1-2 sentence explanation of why this unique visual DNA elevates this genre"
}
Do not output markdown code blocks or text outside the JSON.`;

  const userQuery = `Create an original, consistent visual art style anchor for:
- Video Genre / Topic: ${genre}
- Core Art Medium requested: ${medium}
${userNotes ? `- Creator custom notes / direction: "${userNotes}"` : ''}
${scriptSnippet ? `- Video Script Context excerpt: "${scriptSnippet.slice(0, 300)}..."` : ''}

Generate a distinct, non-repetitive visual signature that looks human-crafted and cinematic.`;

  try {
    const response = await client.chat.completions.create({
      model: 'openai',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userQuery },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI style model.');
    }

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const cleaned = jsonMatch ? jsonMatch[1].trim() : content.trim();
    const parsed = JSON.parse(cleaned) as SynthesizedStyleResult;

    if (parsed.name && parsed.stylePrompt) {
      return {
        name: parsed.name.trim(),
        stylePrompt: parsed.stylePrompt.trim(),
        negativePrompt: parsed.negativePrompt?.trim() || 'plastic 3D, glossy render, cartoon, blurry, low resolution, watermark, text',
        rationale: parsed.rationale?.trim() || `Tailored aesthetic optimized for ${genre} content.`,
      };
    }
    throw new Error('Incomplete JSON response');
  } catch (err) {
    console.warn('AI Style Synthesis fallback used:', err);
    // Intelligent curated fallback based on medium & genre
    return generateLocalFallbackStyle(genre, medium, userNotes);
  }
}

function generateLocalFallbackStyle(
  genre: string,
  medium: string,
  userNotes: string
): SynthesizedStyleResult {
  const notesLower = userNotes.toLowerCase();
  const isLinocut = medium.toLowerCase().includes('linocut') || medium.toLowerCase().includes('print') || notesLower.includes('woodblock');
  const isAnime = medium.toLowerCase().includes('anime') || notesLower.includes('ghibli');
  const isVector = medium.toLowerCase().includes('vector') || notesLower.includes('flat');
  const isOil = medium.toLowerCase().includes('oil') || notesLower.includes('painting');

  if (isLinocut) {
    return {
      name: `${genre} Artisan Woodcut Print`,
      stylePrompt: `Masterwork hand-carved relief woodblock print tailored for ${genre.toLowerCase()}, chiseled relief grooves, rough tactile ink press on fibrous cream archival paper (#FAF8F5), heavy contrasting charcoal ink with muted terracotta accents, organic cross-hatching, museum-quality editorial relief art`,
      negativePrompt: 'photorealism, 3D render, CGI, glossy, smooth vector gradients, plastic, modern UI, neon, blurry, watermark, text',
      rationale: `Hand-carved printmaking texture delivers an authentic historical feel ideal for ${genre}, avoiding generic AI slop.`,
    };
  }

  if (isAnime) {
    return {
      name: `${genre} Nostalgic Hand-Painted Animation`,
      stylePrompt: `Lush hand-painted animation background aesthetic, soft emotional sunlight, hand-painted gouache and watercolor textures on textured animation paper, nuanced muted pastel color palette, cinematic environmental scale, Studio Ghibli inspired masterwork`,
      negativePrompt: 'photorealistic, 3D CGI render, dark harsh modern digital vectors, airbrushed plastic, watermark, text',
      rationale: `Handcrafted animation textures provide timeless emotional connection for ${genre}.`,
    };
  }

  if (isVector) {
    return {
      name: `${genre} Modern Editorial Infographic`,
      stylePrompt: `Modern 2D editorial flat vector design, clean geometric forms, subtle paper tooth grain texture, sophisticated limited color blocking, zero gradient clutter, architectural precision, corporate technology and documentary explainer aesthetic`,
      negativePrompt: 'photorealistic, 3D render, CGI, glossy, messy sketches, blurry, dark gothic, watermark, text',
      rationale: `Sharp geometric clarity makes complex ${genre} concepts instantly digestible and visually modern.`,
    };
  }

  if (isOil) {
    return {
      name: `${genre} Classical Impasto Canvas`,
      stylePrompt: `Rich classical oil painting on coarse primed linen canvas, thick visible impasto brushstrokes, optical color mixing, dramatic atmospheric lighting with golden highlight accents, old masters museum quality fine art`,
      negativePrompt: 'photograph, flat digital vector, 3D CGI render, smooth airbrushed, cartoon, neon, watermark, signature',
      rationale: `Classical museum canvas texture gives ${genre} narrative weight and prestige.`,
    };
  }

  // Default Cinematic 35mm
  return {
    name: `${genre} 35mm Archival Cinema`,
    stylePrompt: `Cinematic 35mm anamorphic documentary photography tailored for ${genre.toLowerCase()}, natural atmospheric lighting, organic silver halide film grain texture, subtle lens halation, muted archival color grade, shallow depth of field, Panavision prime lens realism, 8k documentary cinematography`,
    negativePrompt: 'cartoon, anime, 3D render, CGI, glossy, blurry, distorted faces, low resolution, oversaturated, text, watermark, signature',
    rationale: `Authentic 35mm film grain and naturalistic optical physics protect your video against YouTube repetitive AI content flags.`,
  };
}
