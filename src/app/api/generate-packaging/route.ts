import { NextResponse } from 'next/server';
import type { YouTubePackagingData, BaseStylePreset } from '@/types';
import { searchYouTubeMarket } from '@/lib/youtube-search';
import {
  isSupabaseConfigured,
  deductCreditsRemote,
  grantCreditsRemote,
} from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';

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
        .select('credits_remaining, is_blocked, block_reason')
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

    const durationSec =
      totalDurationMs > 0
        ? Math.round(totalDurationMs / 1000)
        : scenes.length > 0
          ? Math.round(scenes[scenes.length - 1].audioEndSec || 60)
          : 60;

    // Build scene context with timestamps
    const sceneContext = (scenes || [])
      .map(
        (s: any, idx: number) =>
          `Scene ${idx + 1} (${formatSecondsToTime(s.audioStartSec || 0)} - ${formatSecondsToTime(s.audioEndSec || 0)}): "${s.narrationLine || ''}" [Visual Motif: ${s.visualPrompt || ''}]`
      )
      .join('\n');

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
- Aspect Ratio: ${aspectRatio} (${aspectRatio === '9:16' ? 'Vertical Shorts / Reels / TikTok' : 'Landscape 16:9 Standard'})
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
Split-frame compositions are allowed ONLY if BOTH halves are fully filled with equal visual weight and bright colors. Never leave one half empty or black.

Provide exactly 3 distinct, proven high-CTR YouTube thumbnail archetypes:
- Concept 1 (The Paradox / Contrast): Two opposing states in one image causing cognitive dissonance (both fully filled and bright).
- Concept 2 (The Visceral Focal Subject): One dominant iconic subject or close-up face with an intense emotion, bright rim light, vivid color contrast.
- Concept 3 (Surreal Scale): A small figure dwarfed by a colossal conceptual structure, in a vivid luminous sky (sunset or aurora colors), not a dark storm.

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
      "conceptName": "The Paradox / Split Contrast",
      "compositionType": "split_contrast",
      "visualHook": "Creates cognitive dissonance by comparing two opposing states side-by-side.",
      "visualPrompt": "Bold YouTube thumbnail photograph, two halves of equal weight. Left: a calm lion sleeping on bright golden savanna grass in warm sunlight. Right: a close-up of a wide-eyed anxious man, bright blue light on his face, tiny glowing golden gears visible through his temple. Vivid orange versus electric blue color contrast, strong rim light, clean simple backgrounds, sharp focus, crisp detail, high contrast, bright exposure.",
      "textOverlayHint": "WHY WE WORRY",
      "badgeColor": "yellow"
    },
    {
      "id": "thumb_2",
      "conceptName": "The Visceral Focal Subject",
      "compositionType": "focal_close_up",
      "visualHook": "Dominant singular focal point with extreme lighting contrast that pops on mobile feeds.",
      "visualPrompt": "Bold YouTube thumbnail photograph: a man's face filling the right half of the frame, shocked wide eyes looking straight at the camera, his forehead cracked open like stone with brilliant glowing orange light bursting out. Vivid orange and electric blue color contrast, bright blue rim light on the face, simple clean dark-blue gradient background, 85mm portrait, sharp focus, crisp detail, high contrast, bright exposure.",
      "textOverlayHint": "THE BRAIN TRAP",
      "badgeColor": "red"
    },
    {
      "id": "thumb_3",
      "conceptName": "Surreal Scale / Human vs The Infinite",
      "compositionType": "cinematic_scale",
      "visualHook": "Evokes awe and existential curiosity through vast scale disparity.",
      "visualPrompt": "Bold YouTube thumbnail photograph: a tiny lone figure stands on a cliff edge looking up at a colossal ancient stone sundial rising into a vivid orange and purple sunset sky, glowing golden light spilling from its needle. Strong warm backlight, saturated orange versus deep purple color contrast, simple clean sky, wide-angle low-angle shot, sharp focus, crisp detail, high contrast, bright exposure.",
      "textOverlayHint": "TIME ILLUSION",
      "badgeColor": "cyan"
    }
  ],
  "chapters": [
    {"time": "00:00", "title": "Introduction", "seconds": 0}
  ],
  "description": "Full YouTube description with 2-line hook, core summary, chapters list, subscribe CTA, and hashtags.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

RULES:
1. EVERYTHING must be deeply derived from the provided VOICE SCRIPT's true core subject. Never use generic filler or timestamp names.
2. TITLES must be authentic, highly engaging, under 60 characters, and avoid generic clickbait cliches.
3. THUMBNAILS must strictly follow the Senior YouTube Thumbnail Director rules: 45-75 word prompts, one big subject, bright exposure, two saturated contrasting colors, simple background. Never dark or murky.
4. Chapters must span from 00:00 to ${formatSecondsToTime(durationSec)}.`;

    const userPrompt = `${effectiveTitle ? `Working Title: ${effectiveTitle}\n` : ''}Total Duration: ${formatSecondsToTime(durationSec)}
${customTopicPrompt ? `Creator Focus/Direction: "${customTopicPrompt}"\n` : ''}
Voice Script:
\"\"\"
${cleanScript}
\"\"\"

${sceneContext ? `Scene Timestamps:\n${sceneContext}\n` : ''}`;

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const deepinfraKey = process.env.DEEPINFRA_API_KEY;

    let parsedResult: any = null;

    // ─── 1. Groq (Ultra-fast openai/gpt-oss-120b, fallback qwen/qwen3.8-27b) ──
    if (!parsedResult && groqKey && groqKey.trim()) {
      const groqModels = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
      for (const model of groqModels) {
        if (parsedResult) break;
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqKey.trim()}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.4,
            }),
            signal: AbortSignal.timeout(25000),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsedResult = JSON.parse(jsonMatch[0]);
                break;
              }
            }
          } else {
            console.warn(`Groq packaging (${model}) failed HTTP ${response.status}`);
          }
        } catch (err) {
          console.warn(`Groq packaging (${model}) error:`, err);
        }
      }
    }

    // ─── 2. OpenAI ───────────────────────────────────────────────────────────
    if (!parsedResult && openaiKey && openaiKey.trim()) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResult = JSON.parse(jsonMatch[0]);
            }
          }
        }
      } catch (err) {
        console.warn('OpenAI packaging failed:', err);
      }
    }

    // ─── 3. DeepInfra (Llama 3.1 70B fallback) ───────────────────────────────
    if (!parsedResult && deepinfraKey && deepinfraKey.trim()) {
      try {
        const diRes = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${deepinfraKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.4,
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (diRes.ok) {
          const data = await diRes.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResult = JSON.parse(jsonMatch[0]);
            }
          }
        }
      } catch (err) {
        console.warn('DeepInfra packaging failed:', err);
      }
    }

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
      chapters: Array.isArray(parsedResult.chapters) && parsedResult.chapters.length > 0
        ? parsedResult.chapters
        : [{ time: '00:00', title: 'Introduction', seconds: 0 }],
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
