import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** A small "go there" link: text in an accent colour with an arrow, never boxed like a button or a badge. */
export function TextLink({ href, children, className = 'text-amber-300' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1 text-xs font-medium hover:underline underline-offset-2 ${className}`}>
      {children}
      <ArrowRight size={12} aria-hidden />
    </Link>
  );
}
