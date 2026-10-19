import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deductCreditsRemote, grantCreditsRemote } from '@/lib/supabase-service';
import { NotConnectedError, ReauthRequiredError, getValidAccessToken } from './connection-service';
import { ChannelMismatchError } from './fetcher';
import { GoogleApiError } from './google-fetch';
import { UserFacingError } from './errors';
import { QuotaBudgetError } from './quota-budget';
import { acquireRun } from './run-guard';
import { getChannelDoctorSettings, getUserAccess, type ChannelDoctorSettings } from './settings';
import type { DiagnosisStage } from './types';
import { VideoNotOwnedError } from './video-analysis';

type Token = Awaited<ReturnType<typeof getValidAccessToken>>;

/** Extra detail sent with a stage, e.g. how many channels or videos it is working on. */
export interface StageDetail {
  count?: number;
}

interface StreamOptions<S extends string> {
  userId: string;
  /** Which admin switch and plan list gate this route. Default: Channel Doctor. */
  feature?: 'doctor' | 'discover' | 'create';
  /**
   * Set false for work that doesn't call YouTube (writing a brief or script): no token is
   * fetched, so a missing or expired connection doesn't block it.
   */
  needsYouTube?: boolean;
  /** Credits for this kind of analysis, read from the admin settings. */
  cost: (settings: ChannelDoctorSettings) => number;
  label: string;
  /**
   * Optional last check before credits are charged (e.g. a daily limit).
   * Returns an error message to stop the run, or null to continue.
   */
  reserve?: (settings: ChannelDoctorSettings) => Promise<string | null>;
  run: (ctx: {
    /** Always set when `needsYouTube` is true (the default). */
    token: Token;
    settings: ChannelDoctorSettings;
    onStage: (stage: S, detail?: StageDetail) => void;
  }) => Promise<unknown>;
}

/**
 * Shared flow for analysis routes: settings and plan checks, YouTube token, per-user guard,
 * credits charged up front, NDJSON progress stream, and a refund if no result is produced.
 * Nothing produced here is stored.
 */
export async function streamAnalysis<S extends string = DiagnosisStage>({
  userId,
  feature = 'doctor',
  needsYouTube = true,
  cost: costFor,
  label,
  reserve,
  run,
}: StreamOptions<S>): Promise<Response> {
  const settings = await getChannelDoctorSettings();
  const access = await getUserAccess(userId, settings);
  if (feature === 'discover' || feature === 'create') {
    const allowed = feature === 'discover' ? access.hasDiscoverAccess : access.hasCreateAccess;
    const switchedOn = feature === 'discover' ? settings.discover.enabled : settings.create.enabled;
    const name = feature === 'discover' ? 'Discover' : 'Create';
    if (!allowed) {
      return switchedOn
        ? NextResponse.json({ error: `${name} is not included in your current plan.`, code: 'plan' }, { status: 403 })
        : NextResponse.json({ error: `${name} is not available yet.` }, { status: 503 });
    }
  } else {
    if (!settings.enabled) {
      return NextResponse.json({ error: 'Channel Doctor is temporarily unavailable.' }, { status: 503 });
    }
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Channel analysis is not included in your current plan.', code: 'plan' }, { status: 403 });
    }
  }

  let token: Token | null = null;
  if (needsYouTube) {
    try {
      token = await getValidAccessToken(userId);
    } catch (err) {
      if (err instanceof NotConnectedError) return NextResponse.json({ error: 'Connect YouTube first.', code: 'not_connected' }, { status: 409 });
      if (err instanceof ReauthRequiredError) return NextResponse.json({ error: err.message, code: 'reauth' }, { status: 409 });
      console.error(`[${label}] token error:`, (err as Error)?.message);
      return NextResponse.json({ error: 'Could not reach YouTube. Please try again.' }, { status: 502 });
    }
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

  if (reserve) {
    const blocked = await reserve(settings);
    if (blocked) {
      guard.release();
      return NextResponse.json({ error: blocked, code: 'limit' }, { status: 429 });
    }
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
        send({ type: 'stage', stage: 'connect', charged: cost });
        const result = await run({ token: token as Token, settings, onStage: (stage, detail) => send({ type: 'stage', stage, ...detail }) });
        send({ type: 'stage', stage: 'done' });
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
          code: err instanceof ChannelMismatchError || (err instanceof GoogleApiError && err.kind === 'auth') ? 'reauth' : undefined,
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
  if (err instanceof ChannelMismatchError || err instanceof VideoNotOwnedError || err instanceof UserFacingError) return err.message;
  if (err instanceof QuotaBudgetError) {
    return `${err.message} You can still add competitors by pasting their channel link, or try again after the daily reset.`;
  }
  if (err instanceof GoogleApiError) {
    if (err.kind === 'quota') return 'YouTube’s API limit for our app was reached. Try again later or reduce the research scope.';
    if (err.kind === 'auth') return 'YouTube authorization failed. Please reconnect YouTube.';
    if (err.kind === 'network' || err.kind === 'unavailable') return 'YouTube did not respond. Please try again.';
  }
  return 'The analysis could not be completed. Please try again.';
}
