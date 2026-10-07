import { NextResponse } from 'next/server';
import {
  isSupabaseConfigured,
  deductCreditsRemote,
  grantCreditsRemote,
} from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { generateDeepInfraFluxImage, getFluxDimensions } from '@/lib/deepinfra';

/**
 * Enhances an image prompt with quality boosters for better FLUX output.
 * Merges the scene visual_prompt with the project base style, adds negative hint
 * suffix, and ensures the final prompt is well-structured.
 */
function buildFinalPrompt(
  prompt: string,
  stylePrompt?: string,
  negativePrompt?: string
): { positive: string; negative: string } {
  // Strip any existing negative prompt instructions buried in the prompt
  let positive = prompt.trim();

  // Append base style if provided and not already present
  if (stylePrompt && stylePrompt.trim()) {
    const style = stylePrompt.trim();
    // Only append if the style isn't substantially already in the prompt
    if (!positive.toLowerCase().includes(style.slice(0, 30).toLowerCase())) {
      positive = `${positive}. ${style}`;
    }
  }

  // Universal quality boosters for FLUX / DeepInfra
  const qualityBoost = 'highly detailed, sharp focus, masterwork, award-winning composition';
  if (!positive.toLowerCase().includes('masterwork') && !positive.toLowerCase().includes('highly detailed')) {
    positive = `${positive}, ${qualityBoost}`;
  }

  const negative = negativePrompt?.trim() ||
    'blurry, noisy, out of focus, low quality, watermark, text overlay, signature, bad anatomy, distorted, oversaturated, modern UI elements, boring composition';

  return { positive, negative };
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

    // ─── 0. Authenticate Caller & Atomically Deduct 1 Credit (if Supabase user exists) ───
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

          if (profile && profile.credits_remaining < 1) {
            return NextResponse.json(
              { error: 'Insufficient credits. Please purchase a top-up pack or upgrade your subscription plan.' },
              { status: 402 }
            );
          }

          const deducted = await deductCreditsRemote(user.id, 1);
          if (deducted && profile) {
            remainingCredits = profile.credits_remaining - 1;
          }
        }
      } catch (authErr) {
        console.warn('[generate-image] Supabase auth check bypassed:', authErr);
      }
    }

    const { positive: finalPrompt, negative: finalNegative } = buildFinalPrompt(prompt, stylePrompt, negativePrompt);
    const { width, height } = getFluxDimensions(aspectRatio, reqWidth, reqHeight);

    const deepinfraKey = process.env.DEEPINFRA_API_KEY;
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
          guidanceScale: 3.5,
          negativePrompt: finalNegative,
          apiKey: deepinfraKey,
        });

        return NextResponse.json({
          base64Image: result.base64Image,
          imageUrl: result.base64Image,
          url: result.base64Image,
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

    // ─── 2. fal.ai Fallback (High-Speed) ────────────────────────────────────────
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
            num_inference_steps: 8,
            guidance_scale: 3.5,
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
            return NextResponse.json({ base64Image, provider: 'fal', remainingCredits });
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
      base64Image,
      imageUrl: base64Image,
      url: base64Image,
      provider: 'pollinations',
      remainingCredits,
    });

  } catch (error: any) {
    console.error('API /api/generate-image error:', error);

    // If an error occurred after credit deduction, refund the credit
    if (authenticatedUserId && isSupabaseConfigured()) {
      try {
        await grantCreditsRemote(authenticatedUserId, 1);
        console.log(`[API /api/generate-image] Refunded 1 credit to ${authenticatedUserId} due to generation failure`);
      } catch (refundErr) {
        console.error('[API /api/generate-image] Failed to refund credit:', refundErr);
      }
    }

    return NextResponse.json(
      { error: error.message || 'Image generation failed' },
      { status: 500 }
    );
  }
}
