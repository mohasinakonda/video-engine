/**
 * Content formats and title mechanisms from titles (docs/discover-plan.md §6.4).
 * Rules first, in English and Bangla; the model only sees titles the rules can't place
 * (formats-ai.ts). Pure and safe to import in the browser (labels).
 */
import type { Confidence } from '../types';

export const FORMATS = [
  'comparison',
  'review',
  'tutorial',
  'list',
  'experiment',
  'before_after',
  'challenge',
  'myth_testing',
  'problem_solution',
  'case_study',
  'reaction',
  'documentary',
  'compilation',
  'news',
  'explainer',
] as const;
export type ContentFormat = (typeof FORMATS)[number];

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  comparison: 'Comparison',
  review: 'Review',
  tutorial: 'Tutorial',
  list: 'List or ranking',
  experiment: 'Experiment',
  before_after: 'Before and after',
  challenge: 'Challenge',
  myth_testing: 'Myth testing',
  problem_solution: 'Problem and solution',
  case_study: 'Case study',
  reaction: 'Reaction',
  documentary: 'Documentary',
  compilation: 'Compilation',
  news: 'News or update',
  explainer: 'Explainer',
};

// Order matters: the first matching rule is the primary format.
const FORMAT_RULES: { format: ContentFormat; pattern: RegExp }[] = [
  { format: 'compilation', pattern: /\b\d+\s*(?:\+\s*)?(?:hours?|hrs?|minutes?|mins?)\s+(?:of|with)\b|\bcompilation\b|\bbest\s+moments\b|ঘণ্টার/i },
  { format: 'comparison', pattern: /\bvs\.?\s|\bversus\b|\bcompared\b|\bcomparison\b|বনাম|তুলনা/i },
  { format: 'before_after', pattern: /before\s*(?:and|&|\/|vs)\s*after|আগে\s*ও\s*পরে/i },
  { format: 'experiment', pattern: /\bI\s+(?:tested|tried)\b|\bwe\s+(?:tested|tried)\b|\bexperiment\b|পরীক্ষা করে/i },
  { format: 'myth_testing', pattern: /\bmyths?\b|\bdebunk|\breally\s+work|\bfact\s+or\s+fiction\b|সত্যি\s*নাকি|গুজব/i },
  { format: 'challenge', pattern: /\bchallenge\b|চ্যালেঞ্জ/i },
  { format: 'review', pattern: /\breview\b|\bunboxing\b|\bhands[-\s]on\b|রিভিউ|আনবক্সিং/i },
  { format: 'tutorial', pattern: /\bhow\s+to\b|\btutorial\b|\bguide\b|\bstep[-\s]by[-\s]step\b|কি\s*ভাবে|কী\s*ভাবে|শিখুন|টিউটোরিয়াল/i },
  { format: 'list', pattern: /^\s*(?:top\s+)?\d{1,3}\s+\S|\btop\s+\d{1,3}\b|\b\d{1,3}\s+(?:things|ways|reasons|facts|tips|animals|places|mistakes|signs)\b|সেরা\s*[\d০-৯]+|[\d০-৯]+টি/i },
  { format: 'problem_solution', pattern: /\bfix(?:ed|ing)?\b|\bsolv(?:e|ed|ing)\b|\bmistakes?\b|\bavoid\b|সমাধান|সমস্যা|ভুল/i },
  { format: 'case_study', pattern: /\bcase\s+study\b|\bhow\s+(?:I|we)\s+(?:grew|made|built|got)\b/i },
  { format: 'reaction', pattern: /\breact(?:s|ion|ing)?\b|রিঅ্যাকশন/i },
  { format: 'documentary', pattern: /\bdocumentary\b|\bfull\s+episode\b|ডকুমেন্টারি|প্রামাণ্যচিত্র/i },
  { format: 'news', pattern: /\bnews\b|\bbreaking\b|\bupdate\b|\bannounced?\b|খবর|আপডেট|সংবাদ/i },
  { format: 'explainer', pattern: /^\s*(?:why|what|how|who|when)\b|\bexplained\b|\bthe\s+truth\s+about\b|\bscience\s+of\b|^\s*কেন|^\s*কী\s|^\s*কিভাবে|রহস্য/i },
];

export interface FormatTag {
  primary: ContentFormat | null;
  secondary: ContentFormat | null;
  confidence: Confidence | null;
  source: 'rule' | 'ai' | null;
}

/** Formats from title patterns. A title matching nothing stays unclassified, never forced. */
export function ruleFormats(title: string): FormatTag {
  const matches = FORMAT_RULES.filter((r) => r.pattern.test(title)).map((r) => r.format);
  if (matches.length === 0) return { primary: null, secondary: null, confidence: null, source: null };
  // A question-style title is a weaker signal than "vs" or "how to".
  const confidence: Confidence = matches[0] === 'explainer' || matches[0] === 'problem_solution' ? 'medium' : 'high';
  return { primary: matches[0], secondary: matches[1] ?? null, confidence, source: 'rule' };
}

// ─── Title mechanisms (packaging) ────────────────────────────────────────────

export const MECHANISMS = [
  'comparison',
  'number',
  'question',
  'how',
  'why',
  'i_tested',
  'before_you_buy',
  'strong_claim',
  'contrarian',
  'transformation',
  'curiosity',
  'problem',
] as const;
export type TitleMechanism = (typeof MECHANISMS)[number];

export const MECHANISM_LABELS: Record<TitleMechanism, string> = {
  comparison: '“X vs Y” comparison',
  number: 'A number',
  question: 'A question',
  how: '“How…”',
  why: '“Why…”',
  i_tested: '“I tested / tried…”',
  before_you_buy: '“Before you buy…”',
  strong_claim: 'A strong claim (best, worst, never…)',
  contrarian: 'A contrarian angle (stop, wrong, the truth…)',
  transformation: 'A transformation (before/after, from X to Y)',
  curiosity: 'A curiosity gap (secret, nobody knows…)',
  problem: 'A problem (mistake, fix, avoid…)',
};

const MECHANISM_RULES: Record<TitleMechanism, RegExp> = {
  comparison: /\bvs\.?\s|\bversus\b|বনাম/i,
  number: /\d|[০-৯]/,
  question: /\?|？/,
  how: /\bhow\b|কিভাবে|কীভাবে/i,
  why: /\bwhy\b|কেন/i,
  i_tested: /\bI\s+(?:tested|tried|spent|bought|built)\b|\bwe\s+(?:tested|tried)\b/i,
  before_you_buy: /before\s+you\s+buy|কেনার\s+আগে/i,
  strong_claim: /\b(?:best|worst|ultimate|never|always|insane|craziest|deadliest|most|biggest|only)\b|সেরা|সবচেয়ে|ভয়ংকর/i,
  contrarian: /\b(?:stop|don'?t|wrong|lie|lies|myth|actually|truth|overrated|nobody\s+tells)\b|ভুল\s+ধারণা|আসল\s+সত্য/i,
  transformation: /before\s*(?:and|&|\/)\s*after|\bfrom\s+\S+(?:\s+\S+)?\s+to\s+|\btransform/i,
  curiosity: /\b(?:secret|secrets|nobody|no\s+one|hidden|mystery|mysterious|unknown|what\s+happens|this\s+is\s+why|strange)\b|রহস্য|অজানা|গোপন/i,
  problem: /\b(?:problem|mistakes?|fix|avoid|fail|failed|wrong)\b|সমস্যা|ভুল/i,
};

export function titleMechanisms(title: string): TitleMechanism[] {
  return MECHANISMS.filter((m) => MECHANISM_RULES[m].test(title));
}
