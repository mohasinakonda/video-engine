'use client';
import { GoogleAnalytics } from "@next/third-parties/google";

import { Suspense } from "react";
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-565DHG8C';
const isUntracked = true

function installOptOut(gaId: string) {
  const key = `ga-disable-${gaId}`;
  if (Object.getOwnPropertyDescriptor(window, key)?.get) return;
  Object.defineProperty(window, key, {
    configurable: true,
    get: () => isUntracked,
  });
}

function Tracker({ gaId }: { gaId: string }) {

  if (typeof window !== "undefined") installOptOut(gaId);

  return <GoogleAnalytics gaId={gaId} />;
}

export const GA4 = () => {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <Suspense fallback={null}>
      <Tracker gaId={GTM_ID} />
    </Suspense>
  );
};
