import { NextResponse } from 'next/server';
import {
  isSupabaseConfigured,
  deductCreditsRemote,
  grantCreditsRemote,
} from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { generateDeepInfraFluxImage, getFluxDimensions } from '@/lib/deepinfra';
import { optimizeFluxPrompt, sanitizeFluxPrompt } from '@/lib/flux-prompt-optimizer';

/**
 * Prepares image prompt for FLUX.1 T5-XXL language model.
 * Extracts embedded negative hints and strips any residual legacy tags.
 */
function buildFinalPrompt(
  prompt: string,
  stylePrompt?: string,
  negativePrompt?: string
): { positive: string; negative: string } {
  // Strip any existing (avoid: ...), avoid: ..., or (negative prompt: ...) embedded in the prompt
  let positive = sanitizeFluxPrompt(prompt || '');
  let extractedNegative = '';

  const avoidMatch = positive.match(/[,.\s]*\((?:avoid:?|negative(?:\s+prompt)?:?)\s*([^)]+)\)/i);
  if (avoidMatch) {
    extractedNegative = avoidMatch[1].trim();
    positive = positive.replace(avoidMatch[0], '').trim();
  }

  const trailingAvoidMatch = positive.match(/[,.\s]+avoid:\s*(.+)$/i);
  if (trailingAvoidMatch) {
    if (!extractedNegative) {
      extractedNegative = trailingAvoidMatch[1].trim();
    }
    positive = positive.replace(trailingAvoidMatch[0], '').trim();
  }

  positive = positive.replace(/[,;.\s]+$/, '').trim();

  // Append base style if provided and not already present
  if (stylePrompt && stylePrompt.trim()) {
    const style = sanitizeFluxPrompt(stylePrompt);
    if (!positive.toLowerCase().includes(style.toLowerCase().slice(0, 25))) {
      positive = `${positive}. ${style}`;
    }
  }

  const negative = negativePrompt?.trim() ||
    extractedNegative ||
    'blurry, noisy, out of focus, low quality, watermark, text overlay, signature, bad anatomy, distorted, oversaturated, modern UI elements, boring composition';

  return { positive: sanitizeFluxPrompt(positive), negative };
}

export async function POST(req: Request) {
  let authenticatedUserId: string | null = null;
  let remainingCredits: number | null = null;

  try {
    const body = await req.json();
    const {
      prompt,
      aspectRatio = '16:9',
      width: reqWidth,
      height: reqHeight,
      seed,
      model = 'black-forest-labs/FLUX-1-schnell',
      stylePrompt,
      negativePrompt,
      apiKey,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // ─── 0. Authenticate Caller & Atomically Deduct 2 Credits (if Supabase user exists) ───
    const CREDITS_PER_IMAGE = 2;
    if (isSupabaseConfigured()) {
      try {
        const serverSupabase = createServerClient();
        const {
          data: { user },
        } = await serverSupabase.auth.getUser();

        if (user) {
          authenticatedUserId = user.id;

          const { data: profile } = await serverSupabase
            .from('profiles')
            .select('credits_remaining, is_blocked, block_reason')
            .eq('id', user.id)
            .single();

          if (profile?.is_blocked) {
            return NextResponse.json(
              { error: profile.block_reason || 'Your account is suspended.' },
              { status: 403 }
            );
          }

          if (profile && profile.credits_remaining < CREDITS_PER_IMAGE) {
            return NextResponse.json(
              { error: `Insufficient credits. Image generation requires ${CREDITS_PER_IMAGE} credits. You currently have ${profile.credits_remaining} credits.` },
              { status: 402 }
            );
          }

          const deducted = await deductCreditsRemote(user.id, CREDITS_PER_IMAGE);
          if (deducted && profile) {
            remainingCredits = profile.credits_remaining - CREDITS_PER_IMAGE;
          }
        }
      } catch (authErr) {
        console.warn('[generate-image] Supabase auth check bypassed:', authErr);
      }
    }

    // ─── Step 1: AI Prompt Editor Layer (T5-XXL Optimization) ───────────
    const optimizedPrompt = await optimizeFluxPrompt(prompt, { stylePrompt });
    const { positive: finalPrompt, negative: finalNegative } = buildFinalPrompt(optimizedPrompt, undefined, negativePrompt);
    const { width, height } = getFluxDimensions(aspectRatio, reqWidth, reqHeight);

    const deepinfraKey = process.env.DEEPINFRA_API_KEY;
    const togetherKey = process.env.TOGETHER_API_KEY || (process.env.AI_PROVIDER_API_KEY && !process.env.AI_PROVIDER_API_KEY.startsWith('di_') ? process.env.AI_PROVIDER_API_KEY : undefined);
    const falKey = process.env.FAL_KEY;
    const userApiKey = typeof apiKey === 'string' && apiKey.trim().length > 0 ? apiKey.trim() : undefined;
    const pollinationsKey = userApiKey || process.env.POLLINATIONS_API_KEY;

    // ─── 1. DeepInfra Primary: black-forest-labs/FLUX-1-schnell ───────────────
    if (deepinfraKey && deepinfraKey.trim()) {
      try {
        const result = await generateDeepInfraFluxImage(finalPrompt, {
          aspectRatio,
          width: reqWidth,
          height: reqHeight,
          seed,
          numInferenceSteps: 4,
          guidanceScale: 1.0,
          negativePrompt: finalNegative,
          apiKey: deepinfraKey,
        });

        return NextResponse.json({
          success: true,
          base64Image: result.base64Image,
          imageUrl: result.base64Image,
          url: result.base64Image,
          originalPrompt: prompt,
          optimizedPrompt: finalPrompt,
          provider: 'deepinfra',
          model: 'black-forest-labs/FLUX-1-schnell',
          runtimeMs: result.runtimeMs,
          cost: result.cost,
          remainingCredits,
        });
      } catch (err) {
        console.warn('DeepInfra FLUX-1-schnell error, checking fallbacks:', err);
      }
    }

    // ─── 2. Together AI / OpenAI Provider Fallback ──────────────────────────
    if (togetherKey && togetherKey.trim()) {
      try {
        const togetherClient = new OpenAI({
          apiKey: togetherKey.trim(),
          baseURL: process.env.AI_PROVIDER_BASE_URL || 'https://api.together.xyz/v1',
        });

        const imageResponse = await togetherClient.images.generate({
          model: 'black-forest-labs/FLUX.1-schnell',
          prompt: finalPrompt,
          width: Math.min(width, 1024),
          height: Math.min(height, 1024),
          steps: 4,
          response_format: 'b64_json',
        } as any);

        const b64Data = imageResponse.data?.[0]?.b64_json;
        if (b64Data) {
          const base64Image = b64Data.startsWith('data:') ? b64Data : `data:image/jpeg;base64,${b64Data}`;
          return NextResponse.json({
            success: true,
            base64Image,
            imageUrl: base64Image,
            url: base64Image,
            originalPrompt: prompt,
            optimizedPrompt: finalPrompt,
            provider: 'together',
            model: 'black-forest-labs/FLUX.1-schnell',
            remainingCredits,
          });
        }
      } catch (err) {
        console.warn('Together AI FLUX.1-schnell error, checking fallbacks:', err);
      }
    }

    // ─── 3. fal.ai Fallback (High-Speed) ────────────────────────────────────────
    if (falKey && falKey.trim()) {
      try {
        const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${falKey.trim()}`,
          },
          body: JSON.stringify({
            prompt: finalPrompt,
            image_size: aspectRatio === '9:16' ? 'portrait_hd' : aspectRatio === '1:1' ? 'square_hd' : 'landscape_hd',
            num_inference_steps: 4,
            guidance_scale: 1.0,
            seed: seed || Math.floor(Math.random() * 1000000),
            sync_mode: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.images && data.images.length > 0) {
            const imageUrl = data.images[0].url;
            const imgRes = await fetch(imageUrl);
            const arrayBuffer = await imgRes.arrayBuffer();
            const base64Image = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
            return NextResponse.json({
              success: true,
              base64Image,
              imageUrl: base64Image,
              url: base64Image,
              originalPrompt: prompt,
              optimizedPrompt: finalPrompt,
              provider: 'fal',
              model: 'fal-ai/flux/schnell',
              remainingCredits,
            });
          }
        } else {
          const errText = await response.text().catch(() => '');
          console.warn(`fal.ai failed with status ${response.status}: ${errText.slice(0, 200)}`);
        }
      } catch (err) {
        console.warn('fal.ai fetch error:', err);
      }
    }

    // ─── 3. Pollinations AI Fallback ──────────────────────────────────────
    const encodedPrompt = encodeURIComponent(finalPrompt);
    const polSeed = seed || Math.floor(Math.random() * 1000000);
    const pollHeaders: Record<string, string> = {};
    const cleanPolKey = pollinationsKey ? pollinationsKey.trim() : '';

    if (cleanPolKey) {
      pollHeaders['Authorization'] = `Bearer ${cleanPolKey}`;
    }

    let pollUrl = '';
    if (cleanPolKey) {
      pollUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(model)}&nologo=true&seed=${polSeed}&quality=hd&key=${encodeURIComponent(cleanPolKey)}`;
    } else {
      pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${polSeed}&model=${encodeURIComponent(model)}&nologo=true`;
    }

    let pollRes = await fetch(pollUrl, {
      headers: pollHeaders,
      signal: AbortSignal.timeout(30000),
    }).catch(() => null);

    // If non-OK, try public image.pollinations.ai with requested model
    if (!pollRes || !pollRes.ok) {
      const publicUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${polSeed}&model=${encodeURIComponent(model)}&nologo=true`;
      pollRes = await fetch(publicUrl, {
        headers: pollHeaders,
        signal: AbortSignal.timeout(30000),
      }).catch(() => null);
    }

    // If still non-OK, try free 'sana' model
    if (!pollRes || !pollRes.ok) {
      console.warn(`Pollinations returned error for model '${model}'. Retrying with free 'sana' model...`);
      const sanaUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${polSeed}&model=sana&nologo=true`;
      pollRes = await fetch(sanaUrl, {
        headers: pollHeaders,
        signal: AbortSignal.timeout(30000),
      }).catch(() => null);
    }

    // Secondary fallback without model parameter if still failing
    if (!pollRes || !pollRes.ok) {
      console.warn(`Pollinations still failed, retrying with default public model...`);
      const defaultUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${polSeed}&nologo=true`;
      pollRes = await fetch(defaultUrl, {
        headers: pollHeaders,
        signal: AbortSignal.timeout(30000),
      }).catch(() => null);
    }

    if (!pollRes || !pollRes.ok) {
      throw new Error(`Pollinations AI error status: ${pollRes?.status || 'network error'}`);
    }

    const arrayBuffer = await pollRes.arrayBuffer();
    const base64Image = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
    return NextResponse.json({
      success: true,
      base64Image,
      imageUrl: base64Image,
      url: base64Image,
      originalPrompt: prompt,
      optimizedPrompt: finalPrompt,
      provider: 'pollinations',
      model,
      remainingCredits,
    });

  } catch (error: any) {
    console.error('API /api/generate-image error:', error);

    // If an error occurred after credit deduction, refund the 2 credits
    if (authenticatedUserId && isSupabaseConfigured()) {
      try {
        await grantCreditsRemote(authenticatedUserId, 2);
        console.log(`[API /api/generate-image] Refunded 2 credits to ${authenticatedUserId} due to generation failure`);
      } catch (refundErr) {
        console.error('[API /api/generate-image] Failed to refund credits:', refundErr);
      }
    }

    return NextResponse.json(
      { error: error.message || 'Image generation failed' },
      { status: 500 }
    );
  }
}
