'use client';

/**
 * Loading placeholders from react-loading-skeleton, in the app's warm light colours. Wrap a
 * skeleton layout in <SkeletonBox> once; every <Skeleton> inside picks up the theme.
 */
import type { ReactNode } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export { Skeleton };

export function SkeletonBox({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <SkeletonTheme baseColor="#ece7df" highlightColor="#f8f5f0" borderRadius="0.5rem" duration={1.4}>
      <div role="status" className={className}>
        <span className="sr-only">{label}</span>
        <div aria-hidden="true">{children}</div>
      </div>
    </SkeletonTheme>
  );
}
