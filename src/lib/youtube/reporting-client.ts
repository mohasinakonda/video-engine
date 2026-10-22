import { REACH_REPORT_TYPE, YOUTUBE_REPORTING_API } from './config';
import { googleFetch, googleJson } from './google-fetch';
import type { DateRange, ReachData } from './types';

interface Job {
  id: string;
  reportTypeId: string;
  createTime: string;
}

/**
 * Makes sure a Reporting API job exists for the reach report (thumbnail impressions + CTR).
 * YouTube only generates daily files for days after a job exists (plus a 30-day backfill),
 * so this runs as soon as a channel connects. Reuses an existing job for the same report.
 */
export async function ensureReachJob(accessToken: string): Promise<{ id: string; createdAt: string }> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const list = await googleJson<{ jobs?: Job[] }>(`${YOUTUBE_REPORTING_API}/jobs`, { headers });
  const existing = list.jobs?.find((job) => job.reportTypeId === REACH_REPORT_TYPE);
  if (existing) return { id: existing.id, createdAt: existing.createTime };

  const created = await googleJson<Job>(`${YOUTUBE_REPORTING_API}/jobs`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportTypeId: REACH_REPORT_TYPE, name: 'channel-doctor' }),
    retries: 1,
  });
  return { id: created.id, createdAt: created.createTime };
}

/** Stops YouTube generating reach files for this channel. Returns false if it couldn't. */
export async function deleteReachJob(accessToken: string, jobId: string): Promise<boolean> {
  try {
    await googleFetch(`${YOUTUBE_REPORTING_API}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      retries: 1,
    });
    return true;
  } catch {
    return false;
  }
}

interface ReportFile {
  id: string;
  startTime: string;
  createTime: string;
  downloadUrl: string;
}

/** Minimal CSV parser for YouTube's bulk reports (no quoted commas in this report's columns). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(header.map((name, i) => [name, (cells[i] ?? '').trim()]));
  });
}

/**
 * Sums daily reach rows into per-video impressions and CTR.
 * CTR is clicks / impressions over the whole period, never an average of daily CTRs.
 */
export function aggregateReach(rows: Record<string, string>[]): Pick<ReachData, 'byVideo' | 'totalImpressions' | 'ctr'> {
  const values = rows.map((row) => Number(row.video_thumbnail_impressions_ctr)).filter(Number.isFinite);
  // Google documents CTR as a percentage; accept either 0–1 or 0–100 until verified on real files.
  const ctrScale = values.some((v) => v > 1) ? 0.01 : 1;

  const sums: Record<string, { impressions: number; clicks: number }> = {};
  for (const row of rows) {
    const videoId = row.video_id;
    const impressions = Number(row.video_thumbnail_impressions);
    const ctr = Number(row.video_thumbnail_impressions_ctr) * ctrScale;
    if (!videoId || !Number.isFinite(impressions) || impressions <= 0) continue;
    const entry = (sums[videoId] ||= { impressions: 0, clicks: 0 });
    entry.impressions += impressions;
    if (Number.isFinite(ctr)) entry.clicks += impressions * ctr;
  }

  let totalImpressions = 0;
  let totalClicks = 0;
  const byVideo: ReachData['byVideo'] = {};
  for (const [videoId, { impressions, clicks }] of Object.entries(sums)) {
    byVideo[videoId] = { impressions, ctr: impressions > 0 ? clicks / impressions : null };
    totalImpressions += impressions;
    totalClicks += clicks;
  }
  return { byVideo, totalImpressions, ctr: totalImpressions > 0 ? totalClicks / totalImpressions : null };
}

/**
 * Impressions and CTR for a period from the reach job's daily files, read into memory only.
 * When the job is too new, returns what is covered and when full data is expected.
 */
export async function fetchReach(
  accessToken: string,
  jobId: string,
  jobCreatedAt: string | null,
  range: DateRange
): Promise<ReachData> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const files: ReportFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      startTimeAtOrAfter: `${range.startDate}T00:00:00Z`,
      startTimeBefore: new Date(Date.parse(`${range.endDate}T00:00:00Z`) + 86_400_000).toISOString(),
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await googleJson<{ reports?: ReportFile[]; nextPageToken?: string }>(
      `${YOUTUBE_REPORTING_API}/jobs/${encodeURIComponent(jobId)}/reports?${params}`,
      { headers }
    );
    files.push(...(page.reports || []));
    pageToken = page.nextPageToken;
  } while (pageToken && files.length < 500);

  // YouTube may regenerate a day's file; keep only the newest per day.
  const latestByDay = new Map<string, ReportFile>();
  for (const file of files) {
    const day = file.startTime.slice(0, 10);
    const current = latestByDay.get(day);
    if (!current || file.createTime > current.createTime) latestByDay.set(day, file);
  }

  // Download in batches of 6, straight into memory. A failed day lowers coverage instead of failing the report.
  const dayFiles = Array.from(latestByDay.values());
  const rows: Record<string, string>[] = [];
  let coveredDays = 0;
  for (let i = 0; i < dayFiles.length; i += 6) {
    const batch = await Promise.all(
      dayFiles.slice(i, i + 6).map(async (file) => {
        try {
          const res = await googleFetch(file.downloadUrl, { headers, retries: 1 });
          return parseCsv(await res.text());
        } catch {
          return null;
        }
      })
    );
    for (const part of batch) {
      if (!part) continue;
      rows.push(...part);
      coveredDays++;
    }
  }

  const aggregated = aggregateReach(rows);
  const availableFrom =
    dayFiles.length === 0 && jobCreatedAt
      ? new Date(Date.parse(jobCreatedAt) + 2 * 86_400_000).toISOString().slice(0, 10)
      : null;
  return { ...aggregated, coveredDays, totalDays: range.days, availableFrom };
}
