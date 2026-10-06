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

SENIOR YOUTUBE THUMBNAIL DIRECTOR RULES (6-DIMENSIONAL FLUX PROMPT FORMULA):
YouTube thumbnails are viewed at 120-200px on mobile feeds. Low-detail or generic prompts are forbidden!
Every single concept's "visualPrompt" MUST be an 80-120 word vivid, cinematic prompt following this exact 6-part anatomy:
1. SUBJECT & MICRO-EXPRESSION: Specific age, attire, intense facial micro-expression (furrowed brow, wide eyes of revelation, clenched jaw, or focused awe), with realistic skin micro-textures, pores, and fabric weaves.
2. TANGIBLE HERO METAPHOR / PROP: Concrete physical objects illustrating the core tension (e.g., translucent cranium revealing intricate glowing brass clockwork gears, an obsidian hourglass with cracked glass leaking incandescent gold sand, glowing synaptic filaments, or ancient stone monoliths).
3. CAMERA & OPTICS: Exact camera lens simulation (e.g., "Shot on 85mm anamorphic cine prime lens, f/1.4 aperture, creamy cinematic bokeh with shallow depth of field", or "Dramatic wide-angle 24mm low-angle perspective").
4. CHIAROSCURO & HARD RIM LIGHTING: High-contrast lighting (e.g., "warm golden amber key light paired with razor-sharp electric cyan rim lighting cutting the subject profile against the dark background") ensuring the focal subject violently pops on 120px mobile screens.
5. ATMOSPHERE & TEXTURE: Volumetric light shafts, floating dust motes, subtle cinematic fog, micro-particles, and rich surface textures.
6. MOBILE COMPOSITION & NEGATIVE SPACE: Dynamic rule-of-thirds composition, subject anchored firmly (e.g. right two-thirds), with the upper-left or top-center quadrant kept as clean, unobstructed dark negative space for bold 2-3 word YouTube text badges.
7. STYLE INTEGRATION: Seamlessly blend the composition with the designated visual style "${styleName}".

Provide exactly 3 distinct, proven high-CTR YouTube thumbnail archetypes:
- Concept 1 (The Paradox / Split Contrast): Dual split-frame or side-by-side opposing states causing cognitive dissonance.
- Concept 2 (The Visceral Focal Subject): Singular dominant iconic subject or macro portrait with intense gaze and chiaroscuro rim lighting.
- Concept 3 (Surreal Scale / Human vs The Infinite): A tiny human silhouette dwarfed by a colossal, impossible conceptual structure or landscape.

Return strictly valid JSON:
{
  "coreTopic": "1 crisp sentence capturing the exact central scientific/psychological thesis or entity of the script",
  "hookRetentionScore": 88,
  "hookAnalysis": "1-2 sentences diagnosing viewer retention risk in the first 30 seconds of this script",
  "suggestedPowerHook": "High-retention 1-2 sentence rewritten opening line guaranteed to hook viewers immediately",
  "emotionalTriggers": ["Curiosity", "Urgency", "Existential Awe"],
  "viralAngles": ["Niche 1 (e.g. Psychology Enthusiasts)", "Niche 2 (e.g. High-Performers & Overthinkers)"],
  "shortsIdeas": [
    {"timestamp": "00:15 - 00:45", "hook": "Did you know your brain travels through time?", "reason": "High-energy paradox that hooks TikTok & Shorts viewers in 2 seconds"}
  ],
  "competitorGap": "What top competitor videos on YouTube completely fail to explain that this video capitalizes on",
  "marketSearchQuery": "3 to 5 words specifically crafted to find top-performing YouTube competitor videos on this exact psychological/scientific/historical phenomenon",
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
    {"title": "Viral headline 1", "hookStyle": "Curiosity Gap", "ctrScore": 98, "whyItWorks": "Creates an irresistible curiosity gap without sounding cheap.", "pairedConceptId": "thumb_1"},
    {"title": "Viral headline 2", "hookStyle": "Extreme Transformation", "ctrScore": 95, "whyItWorks": "Direct promise of immediate resolution for chronic worry.", "pairedConceptId": "thumb_2"},
    {"title": "Viral headline 3", "hookStyle": "Counter-Intuitive Truth", "ctrScore": 96, "whyItWorks": "Challenges common beliefs, forcing viewers to click to verify.", "pairedConceptId": "thumb_1"},
    {"title": "Viral headline 4", "hookStyle": "High-Stakes Story", "ctrScore": 93, "whyItWorks": "Narrative tension and emotional stakes.", "pairedConceptId": "thumb_3"},
    {"title": "Viral headline 5", "hookStyle": "Search / SEO Authority", "ctrScore": 91, "whyItWorks": "High search volume evergreen query matching user intent.", "pairedConceptId": "thumb_2"}
  ],
  "thumbnailConcepts": [
    {
      "id": "thumb_1",
      "conceptName": "The Paradox / Split Contrast",
      "compositionType": "split_contrast",
      "visualHook": "Creates cognitive dissonance by comparing two opposing states side-by-side.",
      "visualPrompt": "Split-frame dual contrast composition. On the left side, an apex African lion sleeping deeply on sun-drenched golden savanna grass, warm serene sunlight, relaxed peaceful posture. On the right side, an intense close-up portrait of a 30-year-old human in a dark midnight room, wide anxious eyes illuminated by an eerie blue glow, translucent temples revealing miniature glowing golden clock gears and tangled electrical lightning sparks. Shot on 85mm anamorphic prime lens, f/1.4 shallow depth of field, hard contrasting rim lighting separating both halves, textured skin pores, clean dark negative space reserved on the upper-left corner for bold badge text.",
      "textOverlayHint": "WHY WE WORRY",
      "badgeColor": "yellow"
    },
    {
      "id": "thumb_2",
      "conceptName": "The Visceral Focal Subject",
      "compositionType": "focal_close_up",
      "visualHook": "Dominant singular focal point with extreme lighting contrast that pops on mobile feeds.",
      "visualPrompt": "Cinematic macro medium close-up of a human silhouette facing the camera with an intense piercing gaze, their forehead and cranium fracturing like dark obsidian stone to reveal a brilliant glowing core of incandescent fiery amber light and swirling cosmic nebula particles. Shot on 50mm f/1.2 lens, extreme chiaroscuro side lighting, intense cobalt-blue rim light carving the facial contour against an obsidian black background, atmospheric smoke and floating golden dust motes, rule-of-thirds composition centered slightly right, upper-left quadrant completely dark and clean.",
      "textOverlayHint": "THE BRAIN TRAP",
      "badgeColor": "red"
    },
    {
      "id": "thumb_3",
      "conceptName": "Surreal Scale / Human vs The Infinite",
      "compositionType": "cinematic_scale",
      "visualHook": "Evokes awe and existential curiosity through vast scale disparity.",
      "visualPrompt": "Surreal wide-angle composition with immense scale disparity. A tiny solitary human silhouette stands at the precipice of a dark cliff, gazing up at a colossal, monolithic ancient stone sundial looming hundreds of feet into a stormy indigo sky, its central needle crackling with golden electric arcs and temporal distortion rings. Low-angle 24mm anamorphic cinema shot, volumetric God rays piercing heavy storm clouds, deep atmospheric perspective, sharp silhouette contrast, clean negative space in the upper third.",
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
3. THUMBNAILS must strictly follow the Senior YouTube Thumbnail Director rules with 80-120 word concrete physical descriptions, high chiaroscuro contrast, camera optics, and clean negative space.
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

    // ─── 1. Groq (Ultra-fast Llama 3.3 70B) ──────────────────────────────────
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
          signal: AbortSignal.timeout(14000),
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

    // ─── 3. Pollinations DeepSeek (High-Reasoning Primary Fallback) ─────────
    if (!parsedResult) {
      const pollHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (pollinationsKey && pollinationsKey.trim()) {
        pollHeaders['Authorization'] = `Bearer ${pollinationsKey.trim()}`;
      }

      // Try deepseek high reasoning first
      const candidateModels = ['deepseek', 'qwen', 'openai'];
      for (const candidateModel of candidateModels) {
        if (parsedResult) break;
        try {
          const pollRes = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: pollHeaders,
            body: JSON.stringify({
              model: candidateModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.4,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (pollRes.ok) {
            const data = await pollRes.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsedResult = JSON.parse(jsonMatch[0]);
                break;
              }
            }
          }
        } catch (err) {
          console.warn(`Pollinations ${candidateModel} failed, trying next fallback:`, err);
        }
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
        hookRetentionScore: typeof parsedResult.hookRetentionScore === 'number' ? parsedResult.hookRetentionScore : 88,
        hookAnalysis: parsedResult.hookAnalysis || 'Strong opening narrative hook with clear emotional stakes.',
        suggestedPowerHook: parsedResult.suggestedPowerHook || '',
        emotionalTriggers: Array.isArray(parsedResult.emotionalTriggers) ? parsedResult.emotionalTriggers : ['Curiosity', 'Urgency', 'Awe'],
        viralAngles: Array.isArray(parsedResult.viralAngles) ? parsedResult.viralAngles : ['Deep Thinkers', 'Self-Optimization'],
        shortsIdeas: Array.isArray(parsedResult.shortsIdeas) ? parsedResult.shortsIdeas : [],
        competitorGap: parsedResult.competitorGap || 'Most competitors only cover surface-level tips without explaining the underlying mechanism.',
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
            ctrScore: t.ctrScore || (98 - idx * 2),
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
    };

    return NextResponse.json(packagingData);
  } catch (error: any) {
    console.error('API /api/generate-packaging error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate packaging' }, { status: 500 });
  }
}
