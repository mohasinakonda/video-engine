/** The language an audit's written parts use: the language the analyzed channel works in. */
export type ReportLanguage = 'English' | 'Bangla';

const BENGALI = /[\u0980-\u09FF]/g;
/** Latin and Bengali letters: enough to tell the two apart. */
const LETTER = /[A-Za-z\u00C0-\u024F\u0980-\u09FF]/g;

/**
 * Bangla when the uploader set a Bangla language code, or when most letters in its titles and
 * descriptions are Bengali script; English otherwise (the only other language reports support).
 */
export function detectReportLanguage(texts: string[], codes: (string | null | undefined)[] = []): ReportLanguage {
  if (codes.some((c) => c?.toLowerCase().startsWith('bn'))) return 'Bangla';
  const text = texts.join(' ');
  const letters = text.match(LETTER)?.length ?? 0;
  const bengali = text.match(BENGALI)?.length ?? 0;
  return letters > 0 && bengali / letters >= 0.3 ? 'Bangla' : 'English';
}
