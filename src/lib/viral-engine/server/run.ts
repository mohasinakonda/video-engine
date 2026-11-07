import { detectReportLanguage } from '@/lib/youtube/audit/language';
import type { PublicConnection } from '@/lib/youtube/connection-service';
import type { ChannelDoctorSettings } from '@/lib/youtube/settings';
import { analyzeShort } from '../engine';
import type { ViralRequest } from '../request';
import { VIRAL_RESULT_VERSION, type ChannelContext, type EngineInput, type ViralResult } from '../types';
import { wordViralReport } from './ai';
import { fetchChannelData } from './channel';
import { topicFit, topicFromFrames, topicFromText } from './topic';
import { describeFrames } from './vision';

export type ViralStage = 'vision' | 'channel' | 'analyze' | 'write';

interface RunOptions {
  request: ViralRequest;
  videoId: string | null;
  /** Set when the channel is connected and the user asked to compare with it. */
  token: { accessToken: string; connection: PublicConnection } | null;
  settings: ChannelDoctorSettings;
  onStage: (stage: ViralStage, detail?: { count?: number }) => void;
}

/**
 * Vision, channel data and the topic line run in parallel; then the rules and the wording.
 * Returns everything the browser shows; nothing is stored.
 */
export async function runViralEngine({ request, videoId, token, settings, onStage }: RunOptions): Promise<ViralResult> {
  const transcript = request.signals.speech.map((s) => s.text).join(' ');

  onStage('vision', { count: request.hookFrames.length + request.sheets.reduce((n, s) => n + s.times.length, 0) });
  const visionP = describeFrames(request, settings.visionModels);

  let channelP: ReturnType<typeof fetchChannelData> | null = null;
  let topicP: Promise<string | null> | null = null;
  if (token) {
    onStage('channel');
    channelP = fetchChannelData({
      accessToken: token.accessToken,
      connection: token.connection,
      videoId,
      durationSec: request.signals.durationSec,
      maxBaselineShorts: settings.viralEngine.maxBaselineShorts,
    });
    topicP = topicFromText(request.metadata.title, transcript, settings.textModels);
  }

  const [vision, channelData, textTopic] = await Promise.all([visionP, channelP, topicP]);

  let channel: ChannelContext | null = channelData?.context ?? null;
  if (channel?.profile && channelData) {
    const topic = textTopic ?? topicFromFrames(vision.frames);
    const fit = topic ? await topicFit(topic, channelData.uploads, settings.discover.embeddingModels) : null;
    channel = { ...channel, profile: { ...channel.profile, fit } };
    if (!fit && channelData.uploads.length > 0) channel.notes = [...channel.notes, 'We couldn’t compare this Short’s topic with your channel this time.'];
  }

  onStage('analyze');
  const metadata = {
    title: request.metadata.title || channel?.title || '',
    hashtags: request.metadata.hashtags,
  };
  const input: EngineInput = { signals: request.signals, vision, channel, metadata, formatOverride: null };
  const report = analyzeShort(input);

  onStage('write');
  const language = detectReportLanguage([metadata.title, transcript], [request.signals.speechLanguage]);
  const wording = await wordViralReport(report, request.signals.speech, metadata, language, settings.textModels, channel?.profile ?? null);

  return {
    version: VIRAL_RESULT_VERSION,
    file: request.file,
    input,
    report,
    wording,
    generatedAt: new Date().toISOString(),
  };
}
