import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deductCreditsRemote, grantCreditsRemote } from '@/lib/supabase-service';
import { NotConnectedError, ReauthRequiredError, getValidAccessToken } from './connection-service';
import { ChannelMismatchError } from './fetcher';
import { GoogleApiError } from './google-fetch';
import { acquireRun } from './run-guard';
import { getChannelDoctorSettings, getUserAccess, type ChannelDoctorSettings } from './settings';
import type { DiagnosisStage } from './types';
import { VideoNotOwnedError } from './video-analysis';

type Token = Awaited<ReturnType<typeof getValidAccessToken>>;

interface StreamOptions {
  userId: string;
  /** Credits for this kind of analysis, read from the admin settings. */
  cost: (settings: ChannelDoctorSettings) => number;
  label: string;
  run: (ctx: { token: Token; settings: ChannelDoctorSettings; onStage: (stage: DiagnosisStage) => void }) => Promise<unknown>;
}

/**
 * Shared flow for analysis routes: settings and plan checks, YouTube token, per-user guard,
 * credits charged up front, NDJSON progress stream, and a refund if no result is produced.
 * Nothing produced here is stored.
 */
export async function streamAnalysis({ userId, cost: costFor, label, run }: StreamOptions): Promise<Response> {
  const settings = await getChannelDoctorSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: 'Channel Doctor is temporarily unavailable.' }, { status: 503 });
  }
  const access = await getUserAccess(userId, settings);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Channel analysis is not included in your current plan.', code: 'plan' }, { status: 403 });
  }

  let token: Token;
  try {
    token = await getValidAccessToken(userId);
  } catch (err) {
    if (err instanceof NotConnectedError) return NextResponse.json({ error: 'Connect YouTube first.', code: 'not_connected' }, { status: 409 });
    if (err instanceof ReauthRequiredError) return NextResponse.json({ error: err.message, code: 'reauth' }, { status: 409 });
    console.error(`[${label}] token error:`, (err as Error)?.message);
    return NextResponse.json({ error: 'Could not reach YouTube. Please try again.' }, { status: 502 });
  }

  const guard = acquireRun(userId, settings.hourlyLimitPerUser);
  if (!guard.ok) {
    return NextResponse.json(
      {
        error:
          guard.reason === 'running'
            ? 'An analysis is already running for your account.'
            : `You can run up to ${settings.hourlyLimitPerUser} analyses per hour. Please try again later.`,
      },
      { status: 429 }
    );
  }

  const cost = costFor(settings);
  if (cost > 0) {
    // The user's session client: the RPC checks the balance atomically.
    const charged = await deductCreditsRemote(userId, cost, createClient());
    if (!charged) {
      guard.release();
      return NextResponse.json({ error: `Not enough credits. This analysis costs ${cost} credits.`, code: 'credits' }, { status: 402 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: 'stage', stage: 'connect' satisfies DiagnosisStage, charged: cost });
        const result = await run({ token, settings, onStage: (stage) => send({ type: 'stage', stage }) });
        send({ type: 'stage', stage: 'done' satisfies DiagnosisStage });
        send({ type: 'result', data: result });
      } catch (err) {
        console.error(`[${label}] failed:`, err instanceof GoogleApiError ? err.message : (err as Error)?.message);
        let refunded = false;
        if (cost > 0) {
          try {
            refunded = await grantCreditsRemote(userId, cost);
          } catch {
            refunded = false;
          }
        }
        send({
          type: 'error',
          error: userMessage(err),
          code: err instanceof ChannelMismatchError ? 'reauth' : undefined,
          refunded,
        });
      } finally {
        guard.release();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}

function userMessage(err: unknown): string {
  if (err instanceof ChannelMismatchError || err instanceof VideoNotOwnedError) return err.message;
  if (err instanceof GoogleApiError) {
    if (err.kind === 'quota') return 'The YouTube API limit was reached. Please try again later.';
    if (err.kind === 'auth') return 'YouTube authorization failed. Please reconnect YouTube.';
    if (err.kind === 'network' || err.kind === 'unavailable') return 'YouTube did not respond. Please try again.';
  }
  return 'The analysis could not be completed. Please try again.';
}
