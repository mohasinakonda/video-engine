import { NextResponse } from 'next/server';

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
    'blurry, noisy, out of focus, low quality, watermark, text overlay, signature, bad anatomy, distorted, oversaturated, flat digital illustration, modern UI elements, boring composition';

  return { positive, negative };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      prompt,
      aspectRatio = '16:9',
      width: reqWidth,
      height: reqHeight,
      seed,
      model = 'flux',
      stylePrompt,
      negativePrompt,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Determine dimensions based on aspect ratio
    let width = reqWidth || 1024;
    let height = reqHeight || 576;
    if (aspectRatio === '9:16') {
      width = reqWidth || 576;
      height = reqHeight || 1024;
    } else if (aspectRatio === '1:1') {
      width = reqWidth || 768;
      height = reqHeight || 768;
    }

    const { positive: finalPrompt, negative: finalNegative } = buildFinalPrompt(prompt, stylePrompt, negativePrompt);

    const deepinfraKey = process.env.DEEPINFRA_API_KEY;
    const falKey = process.env.FAL_KEY;
    const pollinationsKey = process.env.POLLINATIONS_API_KEY;

    // ─── 1. DeepInfra Primary ($0.0015/image, 200 concurrent slots) ───────────
    if (deepinfraKey && deepinfraKey.trim()) {
      try {
        const response = await fetch('https://api.deepinfra.com/v1/inference/black-forest-labs/FLUX-1-schnell', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepinfraKey.trim()}`,
          },
          body: JSON.stringify({
            prompt: finalPrompt,
            negative_prompt: finalNegative,
            width,
            height,
            num_inference_steps: 8, // 8 steps for better quality vs 4 (minimal cost diff)
            guidance_scale: 3.5,
            seed: seed || Math.floor(Math.random() * 1000000),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.images && data.images.length > 0) {
            const imgData = data.images[0];
            const base64Image = imgData.startsWith('data:') ? imgData : `data:image/jpeg;base64,${imgData}`;
            return NextResponse.json({ base64Image, provider: 'deepinfra' });
          }
        } else {
          const errText = await response.text().catch(() => '');
          console.warn(`DeepInfra failed with status ${response.status}: ${errText.slice(0, 200)}`);
        }
      } catch (err) {
        console.warn('DeepInfra fetch error:', err);
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
            return NextResponse.json({ base64Image, provider: 'fal' });
          }
        } else {
          const errText = await response.text().catch(() => '');
          console.warn(`fal.ai failed with status ${response.status}: ${errText.slice(0, 200)}`);
        }
      } catch (err) {
        console.warn('fal.ai fetch error:', err);
      }
    }

    // ─── 3. Pollinations AI Public Fallback ──────────────────────────────────────
    const encodedPrompt = encodeURIComponent(finalPrompt);
    const polSeed = seed || Math.floor(Math.random() * 1000000);
    let pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${polSeed}&model=${model}&nologo=true`;
    if (pollinationsKey && pollinationsKey.trim()) {
      pollUrl += `&key=${encodeURIComponent(pollinationsKey.trim())}`;
    }

    const pollRes = await fetch(pollUrl);
    if (!pollRes.ok) {
      throw new Error(`Pollinations AI error status: ${pollRes.status}`);
    }

    const arrayBuffer = await pollRes.arrayBuffer();
    const base64Image = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
    return NextResponse.json({ base64Image, provider: 'pollinations' });

  } catch (error: any) {
    console.error('API /api/generate-image error:', error);
    return NextResponse.json(
      { error: error.message || 'Image generation failed' },
      { status: 500 }
    );
  }
}
