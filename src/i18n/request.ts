/**
 * next-intl without locale routing: the language comes from the NEXT_LOCALE cookie (Bangla by
 * default), so no URL changes. Used by the landing page for now.
 */
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const LOCALES = ['bn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'bn';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export default getRequestConfig(async () => {
  const saved = cookies().get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.includes(saved as Locale) ? (saved as Locale) : DEFAULT_LOCALE;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
