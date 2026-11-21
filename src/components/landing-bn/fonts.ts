/** The Bangla landing page's two faces: Anek Bangla for display, Hind Siliguri for reading. */
import { Anek_Bangla, Hind_Siliguri } from 'next/font/google';

export const anek = Anek_Bangla({ subsets: ['bengali', 'latin'], weight: ['600', '700', '800'], display: 'swap', variable: '--font-anek' });
export const hind = Hind_Siliguri({ subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-hind' });

/** 1,240 → ১,২৪০ */
export function bn(value: number | string) {
  return String(value).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
}
