/**
 * Compare mode (docs/audit-plan.md §5): your video next to another. Pure: two audits in, a
 * side-by-side table and the clear differences out. Each video is judged against its own
 * channel's usual, so a small channel and a big one compare fairly.
 */
import { MECHANISM_LABELS, titleMechanisms } from '../discover/formats';
import { THUMB_MAX_WORDS, titleOverlap } from './thumbnail-audit';
import type { VideoAuditOutput } from './run-video';
import type { AuditFinding } from './video-audit';

export interface CompareRow {
  label: string;
  yours: string;
  theirs: string;
  /** True when this row is one of the clear differences below. */
  differs: boolean;
}

const LABEL = {
  standout: 'Standout',
  above: 'Above usual',
  typical: 'Usual',
  below: 'Below usual',
  well_below: 'Well below usual',
  not_comparable: 'Can’t compare yet',
} as const;

const minutes = (sec: number | null) => (sec === null ? '—' : sec < 60 ? `${sec} s` : `${Math.round(sec / 60)} min`);
const pct = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`);
const yesNo = (b: boolean | null) => (b === null ? '—' : b ? 'Yes' : 'No');

export function compareVideos(yours: VideoAuditOutput, theirs: VideoAuditOutput): { rows: CompareRow[]; differences: AuditFinding[] } {
  const rows: CompareRow[] = [];
  const differences: AuditFinding[] = [];
  const diff = (area: AuditFinding['area'], statement: string, evidence: string | null = null) =>
    differences.push({ id: `compare_${differences.length + 1}`, area, kind: 'note', statement, evidence, confidence: 'medium' });

  // Performance, each against its own channel.
  const [ry, rt] = [yours.performance.ratio, theirs.performance.ratio];
  const perfDiffers = ry !== null && rt !== null && rt >= ry * 2;
  rows.push({
    label: 'Against its own channel’s usual',
    yours: `${LABEL[yours.performance.label]}${ry !== null ? ` (${ry}×)` : ''}`,
    theirs: `${LABEL[theirs.performance.label]}${rt !== null ? ` (${rt}×)` : ''}`,
    differs: perfDiffers,
  });
  if (perfDiffers) diff('performance', `Theirs did far better for its channel than yours did for yours.`, `${rt}× vs ${ry}× each channel’s usual.`);

  // Title.
  const [ty, tt] = [yours.video.title, theirs.video.title];
  const [my, mt] = [titleMechanisms(ty), titleMechanisms(tt)];
  const onlyTheirs = mt.filter((m) => !my.includes(m));
  rows.push({ label: 'Title length', yours: `${ty.length} characters`, theirs: `${tt.length} characters`, differs: (ty.length > 70) !== (tt.length > 70) });
  rows.push({
    label: 'Title approach',
    yours: my.map((m) => MECHANISM_LABELS[m]).join(', ') || 'Plain',
    theirs: mt.map((m) => MECHANISM_LABELS[m]).join(', ') || 'Plain',
    differs: onlyTheirs.length > 0,
  });
  if (onlyTheirs.length) diff('title', `Their title uses ${onlyTheirs.map((m) => MECHANISM_LABELS[m].toLowerCase()).join(' and ')}; yours doesn’t.`);
  if (ty.length > 70 && tt.length <= 70) diff('title', 'Your title gets cut off on phones; theirs fits.', `${ty.length} vs ${tt.length} characters.`);

  // Thumbnail.
  const [hy, ht] = [yours.thumbnail, theirs.thumbnail];
  if (hy && ht) {
    rows.push({ label: 'Thumbnail text', yours: hy.textOnImage ? `“${hy.textOnImage}” (${hy.wordCount} words)` : 'None', theirs: ht.textOnImage ? `“${ht.textOnImage}” (${ht.wordCount} words)` : 'None', differs: (hy.wordCount > THUMB_MAX_WORDS) !== (ht.wordCount > THUMB_MAX_WORDS) });
    rows.push({ label: 'Readable at phone size', yours: yesNo(hy.readableAtSmallSize), theirs: yesNo(ht.readableAtSmallSize), differs: hy.readableAtSmallSize !== ht.readableAtSmallSize });
    rows.push({ label: 'Contrast · background', yours: `${hy.contrast} · ${hy.background}`, theirs: `${ht.contrast} · ${ht.background}`, differs: hy.contrast !== ht.contrast || hy.background !== ht.background });
    rows.push({ label: 'Main subject size', yours: `~${Math.round(hy.subjectSizePct)}%`, theirs: `~${Math.round(ht.subjectSizePct)}%`, differs: Math.abs(hy.subjectSizePct - ht.subjectSizePct) >= 25 });
    if (!hy.readableAtSmallSize && ht.readableAtSmallSize) diff('thumbnail', 'Their thumbnail reads at phone size; yours doesn’t.');
    if (hy.contrast !== 'high' && ht.contrast === 'high') diff('thumbnail', 'Their thumbnail has higher contrast.');
    if (hy.background === 'busy' && ht.background !== 'busy') diff('thumbnail', 'Their thumbnail background is simpler.');
    if (ht.subjectSizePct - hy.subjectSizePct >= 25) diff('thumbnail', 'Their main subject fills much more of the frame.', `About ${Math.round(ht.subjectSizePct)}% vs ${Math.round(hy.subjectSizePct)}%.`);
    const [oy, ot] = [titleOverlap(hy.textOnImage, ty), titleOverlap(ht.textOnImage, tt)];
    if (oy >= 0.6 && ot < 0.6) diff('thumbnail', 'Your thumbnail text repeats your title; theirs adds something new.');
  } else {
    rows.push({ label: 'Thumbnail', yours: hy ? 'Read' : 'Not judged', theirs: ht ? 'Read' : 'Not judged', differs: false });
  }

  // Length and description.
  rows.push({ label: 'Length', yours: minutes(yours.video.durationSec), theirs: minutes(theirs.video.durationSec), differs: false });
  const chapters = (a: VideoAuditOutput) => a.findings.some((f) => f.area === 'metadata' && f.statement.startsWith('It has chapters')) || null;
  const [cy, ct] = [chapters(yours), chapters(theirs)];
  rows.push({ label: 'Chapters', yours: yesNo(cy ?? false), theirs: yesNo(ct ?? false), differs: !cy && !!ct });
  if (!cy && ct) diff('metadata', 'They have chapters; you don’t.');

  // Engagement, each against its own channel.
  rows.push({ label: 'Liked by (vs its channel)', yours: `${pct(yours.performance.likeRate)} vs ${pct(yours.performance.baselineLikeRate)}`, theirs: `${pct(theirs.performance.likeRate)} vs ${pct(theirs.performance.baselineLikeRate)}`, differs: false });

  // Viewers.
  // No comments read means unknown, not zero.
  const count = (a: VideoAuditOutput, kind: string) => (a.viewers && a.viewers.read > 0 ? a.viewers.themes.filter((t) => t.kind === kind).reduce((s, t) => s + t.count, 0) : null);
  rows.push({ label: 'Comments: complaints', yours: String(count(yours, 'complaint') ?? '—'), theirs: String(count(theirs, 'complaint') ?? '—'), differs: false });
  rows.push({ label: 'Comments: unanswered questions', yours: String(count(yours, 'question') ?? '—'), theirs: String(count(theirs, 'question') ?? '—'), differs: false });

  return { rows, differences };
}

/** Each video's standing against its own channel, as context lines for the model. */
export function compareContext(yours: VideoAuditOutput, theirs: VideoAuditOutput): AuditFinding[] {
  const line = (who: string, a: VideoAuditOutput) =>
    `${who} video: ${LABEL[a.performance.label].toLowerCase()} for its channel${a.performance.ratio !== null ? ` (${a.performance.ratio}× its usual)` : ''}.`;
  return [
    { id: 'ctx_yours', area: 'performance', kind: 'note', statement: line('Your', yours), evidence: null, confidence: 'medium' },
    { id: 'ctx_theirs', area: 'performance', kind: 'note', statement: line('Their', theirs), evidence: null, confidence: 'medium' },
  ];
}
