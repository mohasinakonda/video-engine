import { NextResponse } from 'next/server';
import type { YouTubePackagingData, BaseStylePreset } from '@/types';
import { searchYouTubeMarket } from '@/lib/youtube-search';

function formatSecondsToTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export async function POST(req: Request) {
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

    // ─── Step 1: LLM Script Intelligence & Packaging Prompt ─────────────────
    const systemPrompt = `You are an elite YouTube Packaging Strategist & Viral Growth Director (think MrBeast, Colin & Samir, Ali Abdaal, Veristasium).
Your job is to read and analyze the user's provided VOICE SCRIPT in detail, extract genuine script intelligence, and generate an elite YouTube Packaging Kit.

CRITICAL CONCEPT EXTRACTION RULE:
- You must analyze the ENTIRE voice script from beginning to end to identify the TRUE CORE THESIS / CENTRAL SCIENTIFIC, PSYCHOLOGICAL, OR FACTUAL SUBJECT.
- NEVER get misled by opening metaphors, allegories, or rhetorical hooks!
  * Example: If the script begins with "A lion doesn't lie awake wondering if it made the right choice today. But you do. Why? ... prefrontal cortex ... mental time travel ... worry", the core topic is HUMAN WORRY & OVERTHINKING (Mental Time Travel & Prefrontal Cortex), NOT LIONS!
  * Example: If the script starts with an apple falling, the topic is GRAVITY or PHYSICS, NOT APPLES!
- Base all titles, packaging strategy, search queries, and thumbnail concepts STRICTLY on the TRUE CORE SUBJECT.

Video Specifications:
- Aspect Ratio: ${aspectRatio} (${aspectRatio === '9:16' ? 'Vertical Shorts / Reels / TikTok' : 'Landscape 16:9 Standard'})
- Artistic Visual Style: ${styleName}
- Style Guidelines: ${stylePrompt.slice(0, 120)}...

SENIOR YOUTUBE THUMBNAIL DIRECTOR RULES (CTR PHYSICS & MOBILE READABILITY):
1. Thumbnails are viewed at 120-200px on mobile screens. Micro-details and busy clutter ruin CTR.
2. Focus strictly on 1 or at most 2 high-contrast focal elements.
3. DO NOT repeat the style preset name or boilerplate in visualPrompt (e.g. do not write "Conceptual illustration in linocut style on cream paper..."). Focus 100% on concrete physical subjects, composition, camera angle, dramatic lighting, and focal placement.
4. Translate abstract ideas into concrete physical imagery (e.g. instead of "abstract anxiety metaphor", write "Split composition: on the left, a sleeping lion under golden savanna sun; on the right, a translucent human silhouette filled with glowing clock gears, ticking pendulum, and turbulent storm lightning").
5. Always reserve clean negative space on the upper-left or top-center for bold 2-3 word text badges.
6. Provide exactly 3 distinct, proven YouTube thumbnail archetypes:
   - Concept 1 (Split Contrast / The Paradox): Side-by-side or contrasting dual visual elements creating cognitive dissonance.
   - Concept 2 (The Visceral Focal Subject): Singular dominant iconic subject with intense cinematic rim lighting and psychological curiosity.
   - Concept 3 (Surreal Scale / The Human vs The Infinite): A small human silhouette dwarfed by a colossal, impossible conceptual structure or landscape.

Return strictly valid JSON:
{
  "coreTopic": "1 crisp sentence capturing the exact central scientific/psychological thesis or entity of the script",
  "marketSearchQuery": "3 to 5 words specifically crafted to find top-performing YouTube competitor videos on this exact psychological/scientific/historical phenomenon (e.g. 'why we worry about future' or 'psychology of overthinking')",
  "alternativeSearchQueries": [
    "Alternative search query 1 (3-5 words)",
    "Alternative search query 2 (3-5 words)",
    "Alternative search query 3 (3-5 words)"
  ],
  "narrativeSummary": "2 concise sentences summarizing the script premise, revelation, and takeaway",
  "keyTalkingPoints": [
    "Point 1: The Intriguing Hook / Setup",
    "Point 2: Core Evidence / The Revelation",
    "Point 3: Climax & Final Verdict"
  ],
  "targetAudience": "Specific target audience description for this topic",
  "packagingStrategy": "1-2 sentences on why this psychological/scientific insight goes viral on YouTube and how these titles outperform competitors",
  "titles": [
    {"title": "Viral headline 1", "hookStyle": "Curiosity Gap", "ctrScore": 98},
    {"title": "Viral headline 2", "hookStyle": "Search / SEO", "ctrScore": 94},
    {"title": "Viral headline 3", "hookStyle": "High Emotion", "ctrScore": 96},
    {"title": "Viral headline 4", "hookStyle": "Story / Drama", "ctrScore": 93},
    {"title": "Viral headline 5", "hookStyle": "Action / Bold", "ctrScore": 91}
  ],
  "thumbnailConcepts": [
    {
      "id": "thumb_1",
      "conceptName": "The Paradox / Split Contrast",
      "compositionType": "split_contrast",
      "visualHook": "Creates cognitive dissonance by comparing two opposing states side-by-side.",
      "visualPrompt": "Detailed tangible visual description with split or contrasting dual subjects, strong edge separation, cinematic rim lighting, clean negative space on left.",
      "textOverlayHint": "2-3 WORDS ALL CAPS"
    },
    {
      "id": "thumb_2",
      "conceptName": "The Visceral Focal Subject",
      "compositionType": "focal_close_up",
      "visualHook": "Dominant singular focal point with extreme lighting contrast that pops on mobile feeds.",
      "visualPrompt": "Detailed tangible visual description of a single intense iconic subject, dramatic chiaroscuro rim lighting, shallow depth of field, clean composition.",
      "textOverlayHint": "2-3 WORDS ALL CAPS"
    },
    {
      "id": "thumb_3",
      "conceptName": "Surreal Scale / Human vs The Infinite",
      "compositionType": "cinematic_scale",
      "visualHook": "Evokes awe and existential curiosity through vast scale disparity.",
      "visualPrompt": "Detailed tangible visual description of a small human silhouette against an immense, colossal metaphorical structure, deep atmospheric perspective, rule-of-thirds.",
      "textOverlayHint": "2-3 WORDS ALL CAPS"
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
2. TITLES must be authentic, highly engaging, and avoid generic clickbait cliches.
3. THUMBNAILS must strictly follow the Senior YouTube Thumbnail Director rules with concrete physical objects, high contrast, and clean negative space.
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
    const pollinationsKey = process.env.POLLINATIONS_API_KEY;

    let parsedResult: any = null;

    // ─── 1. Groq (Ultra-fast) ────────────────────────────────────────────────
    if (!parsedResult && groqKey && groqKey.trim()) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) parsedResult = JSON.parse(content);
        }
      } catch (err) {
        console.warn('Groq packaging failed:', err);
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
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) parsedResult = JSON.parse(content);
        }
      } catch (err) {
        console.warn('OpenAI packaging failed:', err);
      }
    }

    // ─── 3. Pollinations Unified Gen Endpoint (GPT-5.4-nano) ────────────────
    if (!parsedResult) {
      try {
        const pollHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (pollinationsKey && pollinationsKey.trim()) {
          pollHeaders['Authorization'] = `Bearer ${pollinationsKey.trim()}`;
        }

        const pollRes = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers: pollHeaders,
          body: JSON.stringify({
            model: 'openai',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
          }),
          signal: AbortSignal.timeout(35000),
        });

        if (pollRes.ok) {
          const data = await pollRes.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedResult = JSON.parse(jsonMatch[0]);
          }
        } else {
          console.warn('Pollinations gen returned status:', pollRes.status, await pollRes.text().catch(() => ''));
        }
      } catch (err) {
        console.warn('Pollinations unified endpoint failed:', err);
      }
    }

    // If AI failed completely, return error so user knows to retry instead of receiving fake templates
    if (!parsedResult) {
      return NextResponse.json(
        { error: 'AI generation service is currently busy or timed out. Please click "Analyze & Generate Launch Kit" again to retry.' },
        { status: 503 }
      );
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
        narrativeSummary: parsedResult.narrativeSummary || 'Summary of the script narrative and findings.',
        keyTalkingPoints: Array.isArray(parsedResult.keyTalkingPoints) ? parsedResult.keyTalkingPoints : [],
        targetAudience: parsedResult.targetAudience || 'Curious minds, documentary & video essay enthusiasts',
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
        ? parsedResult.titles.map((t: any) => ({
            title: t.title,
            hookStyle: t.hookStyle || 'Curiosity Gap',
            ctrScore: t.ctrScore || 95,
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
            visualHook: c.visualHook || 'High-contrast focal composition designed for YouTube mobile feeds.',
            compositionType: c.compositionType || (i === 0 ? 'split_contrast' : i === 1 ? 'focal_close_up' : 'cinematic_scale'),
            imageUrl: c.imageUrl || undefined,
          }))
        : [],
      generatedAt: Date.now(),
    };

    return NextResponse.json(packagingData);
  } catch (error: any) {
    console.error('API /api/generate-packaging error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate packaging' }, { status: 500 });
  }
}
