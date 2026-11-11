/**
 * Account health: is anything wrong with the channel itself? Pure.
 *
 *   score = 100 − points for each problem the YouTube API shows:
 *   per video (each, up to a cap): rejected upload, copyright block, block in a main country,
 *     other country block, age restriction, Made for Kids on a channel that isn't for kids;
 *   once per channel: features turned off (standing), re-upload, mass-produced pattern, not verified,
 *     upload burst, unclear titles, no warm-up, double post, hashtags in titles.
 *
 * Strikes, claims without a block and Community Guidelines warnings aren't in the API; the card
 * points to Studio for those.
 */
import { bandOf } from './channel-health';
import { VIEWS_RULES as R } from './rules-config';
import type { AccountHealth, AccountIssue, AccountIssueId, ChannelSignal, VideoStatus } from './types';

const A = R.account;
type VideoIssueId = keyof typeof A.perVideo;
type SignalIssueId = keyof typeof A.signals;

const VIDEO_ISSUE: Record<
  VideoIssueId,
  {
    severity: AccountIssue['severity'];
    title: string;
    detail: (n: number) => string;
    fix: string;
  }
> = {
  rejected: {
    severity: 'high',
    title: 'Uploads rejected by YouTube',
    detail: (n) => `${n} upload${n === 1 ? ' was' : 's were'} rejected (copyright, duplicate or a policy reason).`,
    fix: 'Open each one in Studio to see why; upload a corrected, original version instead of the same file.',
  },
  copyright_block: {
    severity: 'high',
    title: 'Videos blocked everywhere: likely copyright',
    detail: (n) => `${n} video${n === 1 ? ' is' : 's are'} blocked in every country (or almost), which almost always means a copyright claim.`,
    fix: 'In Studio, open each video’s Copyright tab; remove or replace the claimed part (usually music) or dispute it if you own the rights.',
  },
  main_country_block: {
    severity: 'medium',
    title: 'Videos blocked where your viewers are',
    detail: (n) => `${n} video${n === 1 ? ' is' : 's are'} blocked in one of your top viewer countries.`,
    fix: 'Check the Copyright tab of each video in Studio; a claim (often music) usually sets the block.',
  },
  country_block: {
    severity: 'low',
    title: 'Videos blocked in some countries',
    detail: (n) => `${n} video${n === 1 ? ' is' : 's are'} blocked in some countries.`,
    fix: 'Check the Copyright tab of each video in Studio.',
  },
  age_restricted: {
    severity: 'medium',
    title: 'Age-restricted videos',
    detail: (n) => `${n} video${n === 1 ? ' is' : 's are'} age-restricted, so most viewers can’t see ${n === 1 ? 'it' : 'them'}.`,
    fix: 'Edit the video or appeal the restriction in Studio if you think it’s wrong.',
  },
  made_for_kids: {
    severity: 'low',
    title: 'Videos marked Made for Kids',
    detail: (n) => `${n} video${n === 1 ? ' is' : 's are'} marked Made for Kids on a channel that mostly isn’t.`,
    fix: 'If they aren’t for children, change the audience setting in Studio.',
  },
};

/** The per-video problem a status shows, if any (processing, private and scheduled aren't problems). */
function videoIssue(status: VideoStatus, mainCountries: string[], kidsChannel: boolean): VideoIssueId | null {
  if (status.uploadStatus === 'rejected') return 'rejected';
  const allowed = status.regionAllowed;
  const blocked = status.regionBlocked ?? [];
  if ((allowed && allowed.length === 0) || blocked.length >= R.region.nearlyEverywhere) return 'copyright_block';
  const main = mainCountries.slice(0, R.region.topCountries);
  if (main.some((c) => blocked.includes(c) || (allowed !== null && !allowed.includes(c)))) return 'main_country_block';
  if (blocked.length || (allowed && allowed.length)) return 'country_block';
  if (status.ageRestricted) return 'age_restricted';
  if (status.madeForKids && !kidsChannel) return 'made_for_kids';
  return null;
}

export function accountHealth(input: {
  videos: { videoId: string; title: string; status: VideoStatus | undefined }[];
  /** False when the videos' status couldn't be read at all. */
  statusRead: boolean;
  mainCountries: string[];
  kidsChannel: boolean;
  signals: ChannelSignal[];
}): AccountHealth {
  if (!input.statusRead) {
    return {
      score: null,
      band: null,
      checked: 0,
      issues: [],
      headline: 'Couldn’t read your videos’ status.',
      detail: 'Run the check again; YouTube didn’t return availability for your videos.',
    };
  }

  const found = new Map<VideoIssueId, { videoId: string; title: string }[]>();
  let checked = 0;
  for (const v of input.videos) {
    if (!v.status) continue;
    checked++;
    const id = videoIssue(v.status, input.mainCountries, input.kidsChannel);
    if (id) found.set(id, [...(found.get(id) ?? []), { videoId: v.videoId, title: v.title }]);
  }

  const issues: AccountIssue[] = [];
  for (const [id, videos] of Array.from(found.entries())) {
    const meta = VIDEO_ISSUE[id];
    issues.push({
      id,
      severity: meta.severity,
      title: meta.title,
      detail: meta.detail(videos.length),
      fix: meta.fix,
      points: Math.min(A.caps[id], A.perVideo[id] * videos.length),
      videos,
    });
  }
  for (const s of input.signals) {
    if (!(s.id in A.signals)) continue;
    issues.push({
      id: s.id as AccountIssueId,
      severity: s.severity,
      title: s.title,
      detail: s.detail,
      fix: s.fix,
      points: A.signals[s.id as SignalIssueId],
      videos: [],
    });
  }
  issues.sort((a, b) => b.points - a.points);

  const score = Math.max(0, 100 - issues.reduce((s, i) => s + i.points, 0));
  const top = issues[0];
  return {
    score,
    band: bandOf(score),
    checked,
    issues,
    headline: top
      ? `${top.severity === 'low' ? `Small risk: ${/^[A-Z][a-z]/.test(top.title) ? top.title.charAt(0).toLowerCase() + top.title.slice(1) : top.title}` : top.title}.`
      : 'No strike, block or restriction found. Your channel is fine.',
    detail: top
      ? `${top.detail}${issues.length > 1 ? ` ${issues.length - 1} more issue${issues.length === 2 ? '' : 's'} in the details.` : ''}`
      : `We checked ${checked} video${checked === 1 ? '' : 's'} and your channel settings.`,
  };
}
