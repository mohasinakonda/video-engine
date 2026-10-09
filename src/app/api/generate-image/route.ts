import { NextResponse } from 'next/server';
import {
  isSupabaseConfigured,
  deductCreditsRemote,
  grantCreditsRemote,
  fetchAIModelsRemote,
} from '@/lib/supabase-service';
import type { AIImageModel } from '@/types/subscription';
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
  let serverSupabase: any = null;
  let authenticatedUserId: string | null = null;
  let remainingCredits: number | null = null;
  let deductedCreditsCount = 0;

  try {
    const body = await req.json();
    const {
      prompt,
      aspectRatio = '16:9',
      width: reqWidth,
      height: reqHeight,
      seed,
      model,
      stylePrompt,
      negativePrompt,
      apiKey,
      creditCost: reqCreditCost,
      numInferenceSteps,
      inferenceSteps: reqInferenceSteps,
      guidanceScale: reqGuidanceScale,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // ─── Step 0: Resolve AI Model & Credit Cost dynamically from Supabase / Request ───
    let modelRecord: AIImageModel | null = null;
    let selectedModelId = typeof model === 'string' && model.trim() ? model.trim() : '';
    let creditsPerImage: number | null = typeof reqCreditCost === 'number' && reqCreditCost > 0 ? reqCreditCost : null;
    let inferenceSteps: number | null = typeof numInferenceSteps === 'number' && numInferenceSteps > 0
      ? numInferenceSteps
      : typeof reqInferenceSteps === 'number' && reqInferenceSteps > 0
        ? reqInferenceSteps
        : null;
    let guidanceScale: number | null = typeof reqGuidanceScale === 'number' ? reqGuidanceScale : null;

    if (isSupabaseConfigured()) {
      try {
        try {
          serverSupabase = createServerClient();
        } catch { }

        const allModels = await fetchAIModelsRemote(serverSupabase, true);

        if (allModels && allModels.length > 0) {
          // Find matching model dynamically by modelId, UUID id, or name (case-insensitive)
          const matched = selectedModelId
            ? allModels.find(
              (m) =>
                m.modelId.toLowerCase() === selectedModelId.toLowerCase() ||
                m.id === selectedModelId ||
                m.name.toLowerCase() === selectedModelId.toLowerCase()
            )
            : null;

          const chosen = matched || allModels.find((m) => m.isDefault) || allModels[0];

          if (chosen) {
            modelRecord = chosen;
            selectedModelId = chosen.modelId;
            if (creditsPerImage === null) creditsPerImage = chosen.creditCost ?? null;
            if (inferenceSteps === null) inferenceSteps = chosen.inferenceSteps ?? null;
            if (guidanceScale === null) guidanceScale = chosen.guidanceScale ?? null;
          }
        }
      } catch (dbErr) {
        console.warn('[generate-image] Could not fetch model config from Supabase:', dbErr);
      }
    }

    // Dynamic fallbacks if not resolved from Supabase
    if (!selectedModelId) {
      selectedModelId = 'black-forest-labs/FLUX-1-schnell';
    }
    if (creditsPerImage === null) {
      creditsPerImage = selectedModelId.toLowerCase().includes('dev') ? 4 : 2;
    }
    if (inferenceSteps === null) {
      const isDev = selectedModelId.toLowerCase().includes('dev');
      const isTurbo = selectedModelId.toLowerCase().includes('turbo') || selectedModelId.toLowerCase().includes('lightning');
      inferenceSteps = isDev ? 28 : isTurbo ? 1 : 4;
    }
    if (guidanceScale === null) {
      const isDev = selectedModelId.toLowerCase().includes('dev');
      guidanceScale = isDev ? 3.5 : 1.0;
    }

    // ─── Step 0b: Authenticate Caller, Verify Plan Tier & Atomically Deduct Credits ───
    if (isSupabaseConfigured()) {
      try {
        if (!serverSupabase) {
          try {
            serverSupabase = createServerClient();
          } catch { }
        }

        if (serverSupabase) {
          const {
            data: { user },
          } = await serverSupabase.auth.getUser();

          if (user) {
            authenticatedUserId = user.id;

            const { data: profile } = await serverSupabase
              .from('profiles')
              .select('credits_remaining, is_blocked, block_reason, tier')
              .eq('id', user.id)
              .single();

            if (profile?.is_blocked) {
              return NextResponse.json(
                { error: profile.block_reason || 'Your account is suspended.' },
                { status: 403 }
              );
            }

            // Check if this model is restricted to specific plans
            const allowedPlans = modelRecord?.allowedPlans;
            if (Array.isArray(allowedPlans) && allowedPlans.length > 0) {
              const userTier = profile?.tier || 'TRIAL';
              if (!allowedPlans.includes(userTier)) {
                return NextResponse.json(
                  {
                    error: `The "${modelRecord?.name || selectedModelId}" model is exclusive to ${allowedPlans.join(' and ')} plans. Please upgrade your plan to unlock this engine.`,
                    requiresUpgrade: true,
                    allowedPlans,
                  },
                  { status: 403 }
                );
              }
            }

            if (profile && profile.credits_remaining < creditsPerImage) {
              return NextResponse.json(
                {
                  error: `Insufficient credits. This image generation requires ${creditsPerImage} credits. You currently have ${profile.credits_remaining} credits.`,
                },
                { status: 402 }
              );
            }

            const deducted = await deductCreditsRemote(user.id, creditsPerImage, serverSupabase);
            if (deducted && profile) {
              deductedCreditsCount = creditsPerImage;
              remainingCredits = profile.credits_remaining - creditsPerImage;
            }
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

    // ─── 1. DeepInfra Primary Engine ───────────────
    if (deepinfraKey && deepinfraKey.trim()) {
      try {
        const result = await generateDeepInfraFluxImage(finalPrompt, {
          model: selectedModelId,
          aspectRatio,
          width: reqWidth,
          height: reqHeight,
          seed,
          numInferenceSteps: inferenceSteps,
          guidanceScale,
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
          provider: modelRecord?.provider || 'deepinfra',
          model: selectedModelId,
          runtimeMs: result.runtimeMs,
          cost: result.cost,
          creditsDeducted: creditsPerImage,
          remainingCredits,
        });
      } catch (err) {
        console.warn(`DeepInfra ${selectedModelId} error, checking fallbacks:`, err);
      }
    }


    // ─── 2. Together AI / OpenAI Provider Fallback ──────────────────────────
    if (togetherKey && togetherKey.trim()) {
      try {
        const togetherClient = new OpenAI({
          apiKey: togetherKey.trim(),
          baseURL: process.env.AI_PROVIDER_BASE_URL || 'https://api.together.xyz/v1',
        });

        const togetherModel = selectedModelId.toLowerCase().includes('dev')
          ? 'black-forest-labs/FLUX.1-dev'
          : selectedModelId.toLowerCase().includes('schnell')
            ? 'black-forest-labs/FLUX.1-schnell'
            : selectedModelId;

        const imageResponse = await togetherClient.images.generate({
          model: togetherModel,
          prompt: finalPrompt,
          width: Math.min(width, 1024),
          height: Math.min(height, 1024),
          steps: inferenceSteps,
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
            model: togetherModel,
            creditsDeducted: creditsPerImage,
            remainingCredits,
          });
        }
      } catch (err) {
        console.warn('Together AI error, checking fallbacks:', err);
      }
    }

    // ─── 3. fal.ai Fallback (High-Speed) ────────────────────────────────────────
    if (falKey && falKey.trim()) {
      try {
        const isDevFal = selectedModelId.toLowerCase().includes('dev');
        const falEndpoint = isDevFal
          ? 'https://fal.run/fal-ai/flux/dev'
          : 'https://fal.run/fal-ai/flux/schnell';

        const response = await fetch(falEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${falKey.trim()}`,
          },
          body: JSON.stringify({
            prompt: finalPrompt,
            image_size: aspectRatio === '9:16' ? 'portrait_hd' : aspectRatio === '1:1' ? 'square_hd' : 'landscape_hd',
            num_inference_steps: inferenceSteps,
            guidance_scale: guidanceScale,
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
              model: isDevFal ? 'fal-ai/flux/dev' : 'fal-ai/flux/schnell',
              creditsDeducted: creditsPerImage,
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

    // ─── 4. Pollinations AI Fallback ──────────────────────────────────────
    const encodedPrompt = encodeURIComponent(finalPrompt);
    const polSeed = seed || Math.floor(Math.random() * 1000000);
    const pollHeaders: Record<string, string> = {};
    const cleanPolKey = pollinationsKey ? pollinationsKey.trim() : '';
    const encodedModel = encodeURIComponent(selectedModelId);

    if (cleanPolKey) {
      pollHeaders['Authorization'] = `Bearer ${cleanPolKey}`;
    }

    let pollUrl = '';
    if (cleanPolKey) {
      pollUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${width}&height=${height}&model=${encodedModel}&nologo=true&seed=${polSeed}&quality=hd&key=${encodeURIComponent(cleanPolKey)}`;
    } else {
      pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${polSeed}&model=${encodedModel}&nologo=true`;
    }

    let pollRes = await fetch(pollUrl, {
      headers: pollHeaders,
      signal: AbortSignal.timeout(30000),
    }).catch(() => null);

    // If non-OK, try public image.pollinations.ai with requested model
    if (!pollRes || !pollRes.ok) {
      const publicUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${polSeed}&model=${encodedModel}&nologo=true`;
      pollRes = await fetch(publicUrl, {
        headers: pollHeaders,
        signal: AbortSignal.timeout(30000),
      }).catch(() => null);
    }

    // If still non-OK, try free 'sana' model
    if (!pollRes || !pollRes.ok) {
      console.warn(`Pollinations returned error for model '${selectedModelId}'. Retrying with free 'sana' model...`);
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
      model: selectedModelId,
      creditsDeducted: creditsPerImage,
      remainingCredits,
    });

  } catch (error: any) {
    console.error('API /api/generate-image error:', error);

    // If an error occurred after credit deduction, refund the deducted credits
    if (authenticatedUserId && isSupabaseConfigured() && deductedCreditsCount > 0) {
      try {
        await grantCreditsRemote(authenticatedUserId, deductedCreditsCount, serverSupabase);
        console.log(`[API /api/generate-image] Refunded ${deductedCreditsCount} credits to ${authenticatedUserId} due to generation failure`);
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
