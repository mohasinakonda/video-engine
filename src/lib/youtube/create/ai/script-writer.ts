/**
 * ScriptGenerator (docs/create-plan.md §4.2): writes narration for each part of the brief's
 * structure, tags its claims, checks the result, retries the failing parts once, and leaves
 * any part it still can't write empty for the user instead of failing the whole script.
 */
import { z } from 'zod';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import { FORMAT_LABELS } from '../../discover/formats';
import type { VideoBrief } from '../brief';
import {
  CLAIM_KINDS,
  ISSUE_TEXT,
  allowedNumbers,
  briefFacts,
  reconcileClaims,
  sectionIds,
  sectionIssues,
  targetWords,
  withoutFiller,
  type Claim,
  type ScriptSection,
  type VideoScript,
} from '../script';

const aiSchema = z.object({
  sections: z.array(z.object({ id: z.string(), narration: z.string(), claims: z.array(z.unknown()).optional() }).passthrough()),
});

const claimSchema = z.object({ text: z.string().trim().min(1).max(300), kind: z.enum(CLAIM_KINDS) });

const SYSTEM = `You write the narration for a YouTube video, part by part, from a brief.
- Write only the words spoken aloud: no stage directions, camera notes, music cues or headings.
- Follow each part's purpose, in the order given. Each part's narration must be between 90% and 120% of its targetWords (about aboutSentences sentences): the video has to fill its target length. Short parts make a short video.
- Cover every key point and answer every viewer question somewhere in the script. Don't defer them to another video.
- The hook delivers the core promise within the first 15 seconds. No slow intro.
- Talk to one viewer, plainly. No fake excitement, no filler ("in today's video", "smash that like button", "without further ado"), no hype ("viral", "guaranteed").
- Don't repeat the same point across parts.
- Facts: state as fact only what the brief gives. Anything factual beyond it (statistics, dates, names, research findings) must be listed as a claim with kind "needs_research"; never invent numbers or sources.
- For each part, list its claims: {"text": "<the claim, short>", "kind": "evidence" | "needs_research" | "creative"}. evidence = stated in the brief's keyPoints, corePromise or knownFacts; needs_research = the creator must verify; creative = opinion, story or framing.
- Language: write the narration and the claims in the language given as writeIn, even when the brief is partly in another language.
Reply only with JSON: {"sections": [{"id": "<part id>", "narration": "<spoken text>", "claims": [...]}]}`;

interface Part {
  id: string;
  heading: string;
  purpose: string;
}

interface WriteOptions {
  notes?: string;
  models: string[];
}

/** The brief as the model sees it: content only, no ids or timestamps. */
function briefContext(brief: VideoBrief, notes: string) {
  return {
    writeIn: brief.language,
    topic: brief.topic,
    corePromise: brief.corePromise,
    angle: brief.angle || null,
    audience: brief.audience,
    viewerNeed: brief.problem,
    format: brief.format ? FORMAT_LABELS[brief.format] : null,
    keyPoints: brief.keyPoints,
    viewerQuestions: brief.keyQuestions,
    knownFacts: brief.supportingEvidence.map((e) => e.statement),
    creatorNotes: notes || null,
  };
}

async function ask(content: object, models: string[], maxTokens: number): Promise<Map<string, { narration: string; claims: unknown[] }> | null> {
  const answer = await callLLM({
    tag: 'create:script',
    models,
    json: true,
    temperature: 0.6,
    maxTokens,
    timeoutMs: 110_000,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: JSON.stringify(content) },
    ],
  });
  const parsed = answer ? aiSchema.safeParse(parseJsonObject(answer.content)) : null;
  if (!parsed?.success) return null;
  return new Map(parsed.data.sections.map((s) => [s.id, { narration: s.narration.trim(), claims: s.claims ?? [] }]));
}

const toClaims = (raw: unknown[]): Claim[] => raw.flatMap((c) => {
  const r = claimSchema.safeParse(c);
  return r.success ? [r.data] : [];
});

/** Models follow sentence counts better than word counts, especially in Bangla. */
const sentencesFor = (words: number, language: VideoBrief['language']) => Math.max(2, Math.round(words / (language === 'Bangla' ? 9 : 14)));

/** Rough output budget: Bangla takes several times more tokens per word. */
const tokensFor = (words: number, language: VideoBrief['language']) => Math.min(16_000, Math.round(words * (language === 'Bangla' ? 6 : 2)) + 1500);

/**
 * Writes `parts` (all of them, or one when rewriting), retrying the failing ones once.
 * `others` are the finished parts the model sees as context and must not repeat.
 */
async function writeParts(
  brief: VideoBrief,
  parts: Part[],
  script: Pick<VideoScript, 'targetMinutes' | 'language'> & { sections: ScriptSection[] },
  options: WriteOptions & { extra?: object }
): Promise<ScriptSection[] | null> {
  const notes = (options.notes ?? '').slice(0, 1500);
  const allowed = allowedNumbers(brief, notes);
  const facts = briefFacts(brief, notes);
  const targets = targetWords(script.sections, script.targetMinutes, script.language);
  const ids = new Set(parts.map((p) => p.id));
  const others = script.sections.filter((s) => !ids.has(s.id) && s.narration.trim()).map((s) => ({ id: s.id, heading: s.heading, narration: s.narration.slice(0, 600) }));
  const wanted = parts.reduce((sum, p) => sum + (targets.get(p.id) ?? 100), 0);

  const request = (only: Part[], problems?: Record<string, string[]>) =>
    ask(
      {
        brief: briefContext(brief, notes),
        targetMinutes: script.targetMinutes,
        writeParts: only.map((p) => ({ id: p.id, heading: p.heading, purpose: p.purpose, targetWords: targets.get(p.id) ?? 100, aboutSentences: sentencesFor(targets.get(p.id) ?? 100, script.language), ...(problems?.[p.id] ? { fixThese: problems[p.id] } : {}) })),
        alreadyWritten: others.length ? others : undefined,
        ...options.extra,
      },
      options.models,
      tokensFor(only.reduce((sum, p) => sum + (targets.get(p.id) ?? 100), 0), script.language)
    );

  const first = await request(parts);
  if (!first) return null;

  const build = (written: Map<string, { narration: string; claims: unknown[] }>, from: Part[]): ScriptSection[] =>
    from.map((p) => {
      const w = written.get(p.id);
      const narration = w?.narration ?? '';
      return { id: p.id, heading: p.heading, purpose: p.purpose, narration, claims: reconcileClaims(narration, toClaims(w?.claims ?? []), allowed, facts), needsWriting: false };
    });

  let result = build(first, parts);
  const check = () => sectionIssues({ ...script, sections: script.sections.map((s) => result.find((r) => r.id === s.id) ?? s) });
  let issues = check();
  const failing = parts.filter((p) => (issues.get(p.id) ?? []).length > 0);

  if (failing.length && wanted > 0) {
    const problems = Object.fromEntries(failing.map((p) => [p.id, (issues.get(p.id) ?? []).map((i) => ISSUE_TEXT[i])]));
    const retry = await request(failing, problems);
    if (retry) {
      const fixed = build(retry, failing);
      result = result.map((r) => {
        const f = fixed.find((x) => x.id === r.id);
        // Keep whichever version has fewer problems.
        if (!f || !f.narration) return r;
        const before = (issues.get(r.id) ?? []).length;
        const after = sectionIssues({ ...script, sections: script.sections.map((s) => (s.id === f.id ? f : result.find((x) => x.id === s.id) ?? s)) }).get(f.id)?.length ?? 0;
        return after <= before ? f : r;
      });
      issues = check();
    }
  }

  // Last resort, never block the user: drop filler sentences; a part still empty is theirs to write.
  return result.map((r) => {
    const narration = (issues.get(r.id) ?? []).includes('filler') ? withoutFiller(r.narration) : r.narration;
    return { ...r, narration, needsWriting: !narration.trim() };
  });
}

/** A full script from the brief. Null when nothing usable came back (the caller refunds). */
export async function writeScript(brief: VideoBrief, options: WriteOptions & { targetMinutes: number; now?: Date }): Promise<VideoScript | null> {
  const ids = sectionIds(brief.structure);
  const parts: Part[] = brief.structure.map((b, i) => ({ id: ids[i], heading: b.label, purpose: b.purpose }));
  const blank: ScriptSection[] = parts.map((p) => ({ ...p, narration: '', claims: [], needsWriting: false }));
  const shell = { targetMinutes: options.targetMinutes, language: brief.language, sections: blank };

  const sections = await writeParts(brief, parts, shell, options);
  if (!sections || sections.every((s) => s.needsWriting)) return null;
  return {
    version: 1,
    language: brief.language,
    targetMinutes: options.targetMinutes,
    sections,
    briefUpdatedAt: brief.updatedAt,
    source: 'ai',
    updatedAt: (options.now ?? new Date()).toISOString(),
  };
}

/** Rewrites one part, keeping the others as context. Null when nothing usable came back. */
export async function rewriteSection(brief: VideoBrief, script: VideoScript, sectionId: string, options: WriteOptions & { now?: Date }): Promise<VideoScript | null> {
  const section = script.sections.find((s) => s.id === sectionId);
  if (!section) return null;
  const extra = section.narration.trim() ? { previousVersion: section.narration.slice(0, 2000), instruction: 'Write a better, different version of this part.' } : undefined;
  const written = await writeParts(brief, [{ id: section.id, heading: section.heading, purpose: section.purpose }], script, { ...options, extra });
  const next = written?.[0];
  if (!next || next.needsWriting) return null;
  return {
    ...script,
    sections: script.sections.map((s) => (s.id === sectionId ? next : s)),
    source: 'ai',
    updatedAt: (options.now ?? new Date()).toISOString(),
  };
}
