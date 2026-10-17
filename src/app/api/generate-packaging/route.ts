import { NextResponse } from 'next/server';
import type { YouTubePackagingData, BaseStylePreset } from '@/types';
import { searchYouTubeMarket } from '@/lib/youtube-search';
import {
  isSupabaseConfigured,
  deductCreditsRemote,
  grantCreditsRemote,
} from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import {
  SCRIPT_CHAR_LIMITS,
  TEXT_LIMITS,
  effectiveTier,
  getScriptCharLimit,
  scriptTooLongMessage,
} from '@/lib/input-limits';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function formatSecondsToTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export async function POST(req: Request) {
  let authenticatedUserId: string | null = null;
  let remainingCredits: number | null = null;
  let creditsCharged = false;
  const CREDITS_PER_PACKAGING = 15;

  try {
    const {
      title = 'Video',
      script = '',
      scenes = [],
      totalDurationMs = 0,
      customTopicPrompt = '',
      baseStylePreset,
      aspectRatio = '16:9',
      youtubeApiKey,
    } = await req.json();

    const cleanScript = (script || '').trim();
    if (!cleanScript && scenes.length === 0) {
      return NextResponse.json({ error: 'Voice script content is required to generate packaging.' }, { status: 400 });
    }
    // Absolute ceiling before any DB work; the per-plan check follows once we know the user.
    if (cleanScript.length > SCRIPT_CHAR_LIMITS.STUDIO) {
      return NextResponse.json(
        { error: scriptTooLongMessage(cleanScript.length, SCRIPT_CHAR_LIMITS.STUDIO) },
        { status: 400 }
      );
    }
    if (typeof customTopicPrompt !== 'string' || customTopicPrompt.length > TEXT_LIMITS.customFocus) {
      return NextResponse.json(
        { error: `Custom angle must be ${TEXT_LIMITS.customFocus} characters or fewer.` },
        { status: 400 }
      );
    }

    // ─── 0. Authenticate Caller & Atomically Deduct 15 Credits (if Supabase user exists) ───
    // Fails closed: must be signed in, and the charge must succeed before we spend AI quota.
    if (isSupabaseConfigured()) {
      const serverSupabase = createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
      }
      authenticatedUserId = user.id;

      const { data: profile } = await serverSupabase
        .from('profiles')
        .select('credits_remaining, is_blocked, block_reason, tier, role, subscription_expires_at')
        .eq('id', user.id)
        .single();

      if (!profile) {
        return NextResponse.json({ error: 'Profile not found.' }, { status: 403 });
      }

      if (profile.is_blocked) {
        return NextResponse.json(
          { error: profile.block_reason || 'Your account is suspended.' },
          { status: 403 }
        );
      }

      const scriptLimit = getScriptCharLimit(effectiveTier(profile), profile.role === 'admin');
      if (cleanScript.length > scriptLimit) {
        return NextResponse.json(
          { error: scriptTooLongMessage(cleanScript.length, scriptLimit) },
          { status: 400 }
        );
      }

      if (profile.credits_remaining < CREDITS_PER_PACKAGING) {
        return NextResponse.json(
          {
            error: `Insufficient credits. Generating a YouTube Launch Kit requires ${CREDITS_PER_PACKAGING} credits. You currently have ${profile.credits_remaining} credits.`,
          },
          { status: 402 }
        );
      }

      // Pass the user's session client so the DB sees an authenticated caller.
      const deducted = await deductCreditsRemote(user.id, CREDITS_PER_PACKAGING, serverSupabase);
      if (!deducted) {
        return NextResponse.json(
          { error: 'Could not charge credits. Please try again.' },
          { status: 402 }
        );
      }
      creditsCharged = true;
      remainingCredits = profile.credits_remaining - CREDITS_PER_PACKAGING;
    }

    // Filter out generic timestamp titles like "Project Sep 29 10:51 PM"
    const isDefaultTitle = !title || title.toLowerCase().startsWith('project ') || title.toLowerCase() === 'video' || title.toLowerCase() === 'untitled';
    const effectiveTitle = isDefaultTitle ? '' : title.trim();

    // Only known for kits built from a video project; a standalone kit has no audio yet,
    // so no length is sent rather than a made-up one.
    const durationSec =
      totalDurationMs > 0
        ? Math.round(totalDurationMs / 1000)
        : scenes.length > 0
          ? Math.round(scenes[scenes.length - 1].audioEndSec || 0)
          : 0;

    // Build scene context with timestamps
    const sceneContext = (scenes || [])
      .map(
        (s: any, idx: number) =>
          `Scene ${idx + 1} (${formatSecondsToTime(s.audioStartSec || 0)} - ${formatSecondsToTime(s.audioEndSec || 0)}): "${s.narrationLine || ''}" [Visual Motif: ${s.visualPrompt || ''}]`
      )
      .join('\n')
      .slice(0, 24_000);

    // Determine artistic style context for thumbnails
    const styleName = (baseStylePreset as BaseStylePreset)?.name || 'Cinematic Documentary';
    const stylePrompt = (baseStylePreset as BaseStylePreset)?.stylePrompt || 'Cinematic lighting, 8k, photorealistic';
    const negativePrompt = (baseStylePreset as BaseStylePreset)?.negativePrompt || '';

    // ─── Step 1: LLM Script Intelligence & Packaging Prompt ─────────────────
    const systemPrompt = `You are an elite YouTube Packaging Strategist & Viral Growth Director (partner to MrBeast, Veritasium, Ali Abdaal, and Paddy Galloway) and an award-winning Visual Art Director specializing in FLUX.1 and Midjourney v6 thumbnail cinematography.
Your job is to read and analyze the user's provided VOICE SCRIPT in detail, extract genuine creator intelligence, and generate a world-class YouTube Packaging Kit.

CRITICAL CONCEPT EXTRACTION & METAPHOR SEPARATION RULE:
- You must analyze the ENTIRE voice script from beginning to end to identify the TRUE CORE THESIS / CENTRAL SCIENTIFIC, PSYCHOLOGICAL, OR FACTUAL SUBJECT.
- FOR TITLES, SEARCH QUERIES, AND SEO: NEVER get misled by opening metaphors, allegories, or rhetorical hooks!
  * Example: If the script begins with "A lion doesn't lie awake wondering if it made the right choice today...", the core topic is strictly HUMAN WORRY & OVERTHINKING (Mental Time Travel & Prefrontal Cortex), NOT LIONS!
  * Example: If the script starts with an apple falling, the topic is GRAVITY or PHYSICS, NOT APPLES!
- FOR THUMBNAIL VISUALS (CRITICAL EXCEPTION): YouTube thumbnails THRIVE on visual metaphors, stark contrasts, and striking physical symbols! The thumbnail CAN and SHOULD utilize dramatic visual metaphors (such as a sleeping calm lion contrasted with an overthinking human cranium filled with turbulent clockwork gears) to provoke immense psychological curiosity!

Video Specifications:
- Aspect Ratio: ${aspectRatio} (${aspectRatio === '9:16' ? 'Vertical Shorts / Reels / TikTok' : aspectRatio === '1:1' ? 'Square 1:1 for Facebook / Instagram feeds' : 'Landscape 16:9 Standard'})
- Artistic Visual Style: ${styleName}
- Style Guidelines: ${stylePrompt}
${negativePrompt ? `- Style Negative Rules (Do not generate): ${negativePrompt}` : ''}

TITLES RULES (CRITICAL MOBILE-FIRST CTR RULES):
YouTube mobile app truncates titles at 50-60 characters with "...".
Every title MUST be tightly edited (under 55 characters if possible, never exceeding 65 characters)!
Provide exactly 5 distinct, proven psychological title archetypes:
1. Curiosity Gap (e.g., "The Dark Side of Thinking Ahead")
2. Extreme Transformation / Outcome (e.g., "How to Stop Overthinking in 60s")
3. Counter-Intuitive Truth (e.g., "Why Smart People Worry More")
4. High-Stakes Story / Tension (e.g., "The Brain Glitch That Ruined Him")
5. Search / SEO Authority (e.g., "Why We Worry About the Future")

SENIOR YOUTUBE THUMBNAIL DIRECTOR RULES (BRIGHT, BOLD, SIMPLE — FLUX PROMPT FORMULA):
YouTube thumbnails are viewed at 120-200px on mobile feeds. They must read instantly: ONE bold idea, big subject, bright and punchy. Dark, murky, over-detailed images FAIL.
Every concept's "visualPrompt" MUST be a focused 45-75 word prompt, concrete nouns, no filler, following this anatomy:
1. ONE DOMINANT SUBJECT, LARGE: a single clear subject filling 40-60% of the frame. If it is a person: close-up face with a strong readable emotion (shocked wide eyes, awe, fear, curiosity) looking toward the camera.
2. ONE HERO METAPHOR / PROP: a single concrete, instantly understandable symbol of the video's core idea (cracked hourglass, glowing brain, giant clock, tiny figure vs huge object). Never stack more than 2 ideas.
3. COLOR CONTRAST: exactly two strongly contrasting SATURATED colors (e.g. orange vs electric blue, red vs teal, gold vs deep purple). Vivid and luminous.
4. BRIGHT EXPOSURE: the subject must be the BRIGHTEST, best-lit element, lit by a strong key light plus a bright rim light. Overall image is mid-to-high key: NEVER mostly black, NEVER pitch-black backgrounds or "obsidian black", NEVER extreme chiaroscuro. Backgrounds are simple gradients or softly blurred, medium-dark at the darkest.
5. SIMPLE BACKGROUND: clean, uncluttered, with a calm area (one third of the frame) kept free of detail for a text badge. Describe it as "simple clean gradient background", not "dark negative space".
6. CAMERA: mention one lens/framing at most (e.g. "85mm portrait, shallow depth of field"). End with "sharp focus, crisp detail, high contrast".
7. STYLE: use the medium of the style "${styleName}" (photograph vs illustration vs painting) but the lighting/brightness rules above ALWAYS override the style's lighting.
FRAME (${aspectRatio}): ${
  aspectRatio === '9:16'
    ? 'Vertical frame. Stack elements top-to-bottom. A split screen is TOP half vs BOTTOM half, never left/right. Keep the main subject in the upper two-thirds; headline text goes at the top.'
    : aspectRatio === '1:1'
      ? 'Square frame. Centered composition. A split screen is LEFT half vs RIGHT half of the square. Headline text goes along the top or bottom edge.'
      : 'Landscape frame. A split screen is LEFT half vs RIGHT half. Headline text goes on the calm left or right third, opposite the subject.'
}

Provide exactly 3 thumbnail concepts, in this order:
- Concept 1 (Bold Text Headline): ONE dominant subject from the script plus a SHORT HEADLINE rendered inside the image. The headline is 2-4 words, ALL CAPS, the most curiosity-provoking idea of the video. In "visualPrompt" write it exactly as: huge bold clean sans-serif text reading "YOUR HEADLINE" in white with a thick black outline, then where it sits in the frame. Use the identical words in "textOverlayHint". The text must not cover the subject's face.
- Concept 2 (Split Screen): two opposing states from the script in one image, both halves fully filled and bright with equal visual weight (follow the FRAME rule for the split direction).
- Concept 3 (Single Scene): one direct, literal scene of the script's core idea. No split, no collage. One clear subject in a simple setting.
Only Concept 1 contains text. In Concepts 2 and 3 never mention words, letters, signs, labels or captions.
The JSON below is a TEMPLATE: replace every <...> with content from THIS script. Every subject, object and setting must come from the script; never copy wording or subjects from these instructions.

Return strictly valid JSON:
{
  "coreTopic": "1 crisp sentence capturing the exact central factual/scientific/historical thesis of the script",
  "marketSearchQuery": "3 to 5 words specifically crafted to find top-performing YouTube competitor videos on this exact subject",
  "alternativeSearchQueries": [
    "Alternative search query 1 (3-5 words)",
    "Alternative search query 2 (3-5 words)",
    "Alternative search query 3 (3-5 words)"
  ],
  "packagingStrategy": "1-2 sentences on why this psychological/scientific insight goes viral on YouTube and how these titles outperform competitors",
  "titles": [
    {"title": "Viral headline 1", "hookStyle": "Curiosity Gap", "whyItWorks": "Creates an irresistible curiosity gap without sounding cheap.", "pairedConceptId": "thumb_1"},
    {"title": "Viral headline 2", "hookStyle": "Extreme Transformation", "whyItWorks": "Direct promise of immediate resolution for chronic worry.", "pairedConceptId": "thumb_2"},
    {"title": "Viral headline 3", "hookStyle": "Counter-Intuitive Truth", "whyItWorks": "Challenges common beliefs, forcing viewers to click to verify.", "pairedConceptId": "thumb_1"},
    {"title": "Viral headline 4", "hookStyle": "High-Stakes Story", "whyItWorks": "Narrative tension and emotional stakes.", "pairedConceptId": "thumb_3"},
    {"title": "Viral headline 5", "hookStyle": "Search / SEO Authority", "whyItWorks": "High search volume evergreen query matching user intent.", "pairedConceptId": "thumb_2"}
  ],
  "thumbnailConcepts": [
    {
      "id": "thumb_1",
      "conceptName": "Bold Text Headline",
      "compositionType": "text_headline",
      "visualHook": "<why this hook + subject makes people click>",
      "visualPrompt": "Bold YouTube thumbnail photograph: <one dominant subject from the script, its state or emotion, its key light>. Huge bold clean sans-serif text reading \"<2-4 WORD HOOK>\" in white with a thick black outline <placement from the FRAME rule>. <two saturated contrasting colors> color contrast, bright rim light, simple clean gradient background, <one lens/framing>, sharp focus, crisp detail, high contrast, bright exposure.",
      "textOverlayHint": "<the same 2-4 WORD HOOK>",
      "badgeColor": "yellow"
    },
    {
      "id": "thumb_2",
      "conceptName": "Split Screen",
      "compositionType": "split_contrast",
      "visualHook": "<the contrast between the two states and why it creates curiosity>",
      "visualPrompt": "Bold YouTube thumbnail photograph, two halves of equal weight. ${aspectRatio === '9:16' ? 'Top' : 'Left'}: <state A from the script, brightly lit>. ${aspectRatio === '9:16' ? 'Bottom' : 'Right'}: <the opposite state B from the script, brightly lit>. <two saturated contrasting colors> color contrast, strong rim light, clean simple backgrounds, sharp focus, crisp detail, high contrast, bright exposure.",
      "textOverlayHint": "<2-4 WORD HOOK>",
      "badgeColor": "red"
    },
    {
      "id": "thumb_3",
      "conceptName": "Single Scene",
      "compositionType": "single_scene",
      "visualHook": "<the single moment from the script that tells the story at a glance>",
      "visualPrompt": "Bold YouTube thumbnail photograph: <one literal scene from the script with one clear subject and a simple setting, its key light>. <two saturated contrasting colors> color contrast, strong backlight or rim light, simple clean background, <one lens/framing>, sharp focus, crisp detail, high contrast, bright exposure.",
      "textOverlayHint": "<2-4 WORD HOOK>",
      "badgeColor": "cyan"
    }
  ],
  "description": "Full YouTube description with 2-line hook, core summary, subscribe CTA, and hashtags. No timestamps or chapters.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

RULES:
1. EVERYTHING must be deeply derived from the provided VOICE SCRIPT's true core subject. Never use generic filler or timestamp names.
2. TITLES must be authentic, highly engaging, under 60 characters, and avoid generic clickbait cliches.
3. THUMBNAILS must strictly follow the Senior YouTube Thumbnail Director rules: 45-75 word prompts, one big subject, bright exposure, two saturated contrasting colors, simple background. Never dark or murky. Concept 1 = text headline, Concept 2 = split screen, Concept 3 = single scene.
4. The DESCRIPTION must not contain timestamps or a chapters list.`;

    const userPrompt = `${effectiveTitle ? `Working Title: ${effectiveTitle}\n` : ''}${durationSec > 0 ? `Total Duration: ${formatSecondsToTime(durationSec)}` : ''}
${customTopicPrompt ? `Creator Focus/Direction: "${customTopicPrompt}"\n` : ''}
Voice Script:
\"\"\"
${cleanScript}
\"\"\"

${sceneContext ? `Scene Timestamps:\n${sceneContext}\n` : ''}`;

    // A kit missing titles/description/thumbnails still costs the user 15 credits,
    // so only a complete one is accepted; otherwise the next model is tried.
    const isCompleteKit = (r: any) =>
      Array.isArray(r?.titles) && r.titles.length >= 5 &&
      Array.isArray(r?.thumbnailConcepts) && r.thumbnailConcepts.length >= 3 &&
      typeof r?.description === 'string' && r.description.trim().length > 0;

    // 2 models × 45s stays inside maxDuration together with the competitor search below.
    const llm = await callLLM({
      tag: 'generate-packaging',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      json: true,
      timeoutMs: 45_000,
      accept: (content) => isCompleteKit(parseJsonObject(content)),
    });
    const parsedResult: any = llm ? parseJsonObject(llm.content) : null;

    // If AI failed completely, throw error so user knows to retry and credit deduction is safely refunded
    if (!parsedResult) {
      throw new Error('AI generation service is currently busy or timed out. Please click "Analyze & Generate Launch Kit" again to retry.');
    }

    // ─── Step 2: Intelligent Live YouTube Market Competitor Search ───────────
    // Use the AI's extracted intelligent query or creator focus, NOT naive first words!
    const effectiveSearchQuery =
      customTopicPrompt.trim() ||
      parsedResult.marketSearchQuery ||
      parsedResult.coreTopic?.slice(0, 50) ||
      'psychology of overthinking';

    const cleanSearchQuery = effectiveSearchQuery
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 6)
      .join(' ');

    const envYoutubeKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || youtubeApiKey;
    const competitorVideos = await searchYouTubeMarket(cleanSearchQuery, envYoutubeKey);

    // Assemble final verified AI result
    const packagingData: YouTubePackagingData = {
      scriptIntelligence: {
        coreTopic: parsedResult.coreTopic || 'Analysis of the provided voice script.',
        narrativeSummary: parsedResult.coreTopic || 'Summary of the script narrative.',
        keyTalkingPoints: [],
        targetAudience: 'Curious minds, documentary & video essay enthusiasts',
        searchKeywords: Array.isArray(parsedResult.tags) ? parsedResult.tags.slice(0, 5) : [cleanSearchQuery],
      },
      marketInsights: {
        competitorVideos,
        packagingStrategy: parsedResult.packagingStrategy || 'Curiosity-driven titles with high-contrast thumbnails perform best for this topic.',
        marketSearchQuery: cleanSearchQuery,
        alternativeSearchQueries: Array.isArray(parsedResult.alternativeSearchQueries)
          ? parsedResult.alternativeSearchQueries
          : ['why humans worry future', 'psychology of overthinking', 'prefrontal cortex mental time travel'],
      },
      customTopicPrompt,
      titles: Array.isArray(parsedResult.titles) && parsedResult.titles.length > 0
        ? parsedResult.titles.map((t: any, idx: number) => ({
          title: t.title,
          hookStyle: t.hookStyle || (idx === 0 ? 'Curiosity Gap' : idx === 1 ? 'Extreme Transformation' : idx === 2 ? 'Counter-Intuitive Truth' : idx === 3 ? 'High-Stakes Story' : 'Search / SEO Authority'),
          whyItWorks: t.whyItWorks || 'Maximizes click-through rate through emotional resonance.',
          charCount: (t.title || '').length,
          pairedConceptId: t.pairedConceptId || `thumb_${(idx % 3) + 1}`,
        }))
        : [],
      selectedTitleIndex: 0,
      description: parsedResult.description || '',
      tags: Array.isArray(parsedResult.tags) ? parsedResult.tags : [],
      hashtags: Array.isArray(parsedResult.hashtags) ? parsedResult.hashtags : [],
      thumbnailConcepts: Array.isArray(parsedResult.thumbnailConcepts)
        ? parsedResult.thumbnailConcepts.map((c: any, i: number) => ({
          id: c.id || `thumb_${i + 1}`,
          conceptName: c.conceptName || `Concept #${i + 1}`,
          visualPrompt: (c.visualPrompt || '').trim(),
          originalPrompt: (c.visualPrompt || '').trim(),
          textOverlayHint: (c.textOverlayHint || '').toUpperCase().slice(0, 30),
          customBadgeText: (c.textOverlayHint || '').toUpperCase().slice(0, 30),
          badgeColor: c.badgeColor || (i === 0 ? 'yellow' : i === 1 ? 'red' : 'cyan'),
          badgePosition: 'top-left',
          visualHook: c.visualHook || 'High-contrast focal composition designed for YouTube mobile feeds.',
          compositionType: c.compositionType || (i === 0 ? 'split_contrast' : i === 1 ? 'focal_close_up' : 'cinematic_scale'),
          imageUrl: c.imageUrl || undefined,
        }))
        : [],
      generatedAt: Date.now(),
      remainingCredits: remainingCredits ?? undefined,
    };

    return NextResponse.json(packagingData);
  } catch (error: any) {
    console.error('API /api/generate-packaging error:', error);

    // If an error occurred after credit deduction, refund the 15 credits
    // Only refund what was actually charged
    if (creditsCharged && authenticatedUserId && isSupabaseConfigured()) {
      try {
        const serverSupabase = createServerClient();
        await grantCreditsRemote(authenticatedUserId, CREDITS_PER_PACKAGING, serverSupabase);
        console.log(`[API /api/generate-packaging] Refunded ${CREDITS_PER_PACKAGING} credits to ${authenticatedUserId} due to generation failure`);
      } catch (refundErr) {
        console.error('[API /api/generate-packaging] Failed to refund credits:', refundErr);
      }
    }

    return NextResponse.json({ error: error.message || 'Failed to generate packaging' }, { status: 500 });
  }
}
