/** Number helpers shared by the AI guards and the browser (no server imports here). */

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Converts Bangla digits to ASCII so both count as the same number. */
export const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));

/** Numbers in a text, normalized ("4.0" and "4" match; Bangla digits count too). */
export function numbersIn(text: string): string[] {
  return (toAsciiDigits(text).match(/\d+(?:[.,]\d+)?/g) || []).map((n) => String(Number(n.replace(',', '.'))));
}
