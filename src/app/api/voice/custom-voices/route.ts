import { NextResponse } from 'next/server';
import {
  authenticateVoiceRequest,
  createDeepinfraVoice,
  deleteDeepinfraVoice,
} from '@/lib/voice-server';

export const dynamic = 'force-dynamic';

function getDeepinfraKey(): string | null {
  return process.env.DEEPINFRA_API_KEY || null;
}

/**
 * GET /api/voice/custom-voices
 * Lists all custom saved voices for the authenticated user.
 */
export async function GET() {
  try {
    const gate = await authenticateVoiceRequest();
    if ('error' in gate) return gate.error;
    const { auth } = gate;

    const { data, error } = await auth.serverSupabase
      .from('user_custom_voices')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[custom-voices] Query error (table may need creation):', error.message);
      return NextResponse.json({
        success: true,
        voices: [],
        warning: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      voices: data || [],
    });
  } catch (err: any) {
    console.error('[custom-voices GET] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch custom voices' }, { status: 500 });
  }
}

/**
 * POST /api/voice/custom-voices
 * Body: { name, audioBase64, voicePrompt?, language?, gender? }
 * Registers anchor audio with DeepInfra and saves persistent voice record in Supabase.
 */
export async function POST(req: Request) {
  try {
    const gate = await authenticateVoiceRequest();
    if ('error' in gate) return gate.error;
    const { auth } = gate;

    const apiKey = getDeepinfraKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPINFRA_API_KEY is not configured.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
    const voicePrompt = typeof body.voicePrompt === 'string' ? body.voicePrompt.trim() : '';
    const language = typeof body.language === 'string' ? body.language : 'English';
    const gender = typeof body.gender === 'string' ? body.gender : 'neutral';

    if (!name) {
      return NextResponse.json({ error: 'Voice name is required.' }, { status: 400 });
    }
    if (!audioBase64) {
      return NextResponse.json({ error: 'Audio sample is required to create a persistent voice anchor.' }, { status: 400 });
    }

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();
    const fullAudioBuf = Buffer.from(cleanBase64, 'base64');

    if (fullAudioBuf.byteLength < 1024) {
      return NextResponse.json({ error: 'Audio sample is too short or invalid.' }, { status: 400 });
    }

    // Cost & storage optimization: Trim to max ~5-6 seconds of 24kHz 16-bit WAV (~280KB)
    // 1 sec @ 24kHz 16-bit mono = ~48,000 bytes. 6 seconds = ~288,000 bytes.
    let anchorBuf = fullAudioBuf;
    const MAX_ANCHOR_BYTES = 320 * 1024; // ~6.5 seconds max
    if (fullAudioBuf.byteLength > MAX_ANCHOR_BYTES) {
      // Preserve WAV 44-byte header and slice data chunk
      const header = fullAudioBuf.subarray(0, 44);
      const dataSlice = fullAudioBuf.subarray(44, MAX_ANCHOR_BYTES);
      const trimmed = Buffer.concat([header, dataSlice]);
      // Update data chunk size in header (offset 40) and overall file size (offset 4)
      trimmed.writeUInt32LE(trimmed.byteLength - 8, 4);
      trimmed.writeUInt32LE(trimmed.byteLength - 44, 40);
      anchorBuf = trimmed;
    }

    const audioArrayBuffer = anchorBuf.buffer.slice(
      anchorBuf.byteOffset,
      anchorBuf.byteOffset + anchorBuf.byteLength
    );

    // 1. Register with DeepInfra permanent voice clone catalog
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
    const voiceId = await createDeepinfraVoice(`custom_${safeName}_${Date.now()}`, audioArrayBuffer, apiKey);

    // 2. Sample data URL for fast UI preview (compact ~5 sec preview)
    const previewDataUrl = `data:audio/wav;base64,${anchorBuf.toString('base64')}`;

    // 3. Save to Supabase user_custom_voices table
    const { data: savedVoice, error: dbError } = await auth.serverSupabase
      .from('user_custom_voices')
      .insert({
        user_id: auth.userId,
        name,
        deepinfra_voice_id: voiceId,
        voice_prompt: voicePrompt,
        sample_audio_url: previewDataUrl,
        language,
        gender,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[custom-voices POST] DB Insert failed:', dbError);
      // Clean up the created DeepInfra voice so we don't leave an orphan
      await deleteDeepinfraVoice(voiceId, apiKey).catch(() => {});
      return NextResponse.json(
        { error: `Database error: ${dbError.message}. Please ensure the user_custom_voices table is created.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      voice: savedVoice,
    });
  } catch (err: any) {
    console.error('[custom-voices POST] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save custom voice' }, { status: 500 });
  }
}

/**
 * DELETE /api/voice/custom-voices?id=xxx
 * Deletes a custom voice from DeepInfra and Supabase.
 */
export async function DELETE(req: Request) {
  try {
    const gate = await authenticateVoiceRequest();
    if ('error' in gate) return gate.error;
    const { auth } = gate;

    const apiKey = getDeepinfraKey();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Voice ID is required.' }, { status: 400 });
    }

    // Fetch the voice to confirm ownership and get deepinfra_voice_id
    const { data: voice, error: fetchErr } = await auth.serverSupabase
      .from('user_custom_voices')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single();

    if (fetchErr || !voice) {
      return NextResponse.json({ error: 'Voice not found or unauthorized.' }, { status: 404 });
    }

    // 1. Delete from DeepInfra
    if (apiKey && voice.deepinfra_voice_id) {
      await deleteDeepinfraVoice(voice.deepinfra_voice_id, apiKey).catch((e) => {
        console.warn('[custom-voices DELETE] DeepInfra delete warning:', e);
      });
    }

    // 2. Delete from Supabase
    const { error: delErr } = await auth.serverSupabase
      .from('user_custom_voices')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('[custom-voices DELETE] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete custom voice' }, { status: 500 });
  }
}
