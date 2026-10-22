'use client';

import { useEffect, useState } from 'react';
import type { PricingCatalog } from '@/lib/pricing-catalog';

// One request shared by every section on the page.
let catalogPromise: Promise<PricingCatalog | null> | null = null;

function fetchCatalog(): Promise<PricingCatalog | null> {
  if (!catalogPromise) {
    catalogPromise = fetch('/api/pricing/catalog')
      .then((res) => (res.ok ? (res.json() as Promise<PricingCatalog>) : null))
      .catch(() => null)
      .then((catalog) => {
        if (!catalog) catalogPromise = null;
        return catalog;
      });
  }
  return catalogPromise;
}

/** The growth tools' plans and prices and the image models' prices, live from the admin settings; null while loading. */
export function usePricingCatalog(): PricingCatalog | null {
  const [catalog, setCatalog] = useState<PricingCatalog | null>(null);

  useEffect(() => {
    let active = true;
    fetchCatalog().then((c) => {
      if (active) setCatalog(c);
    });
    return () => {
      active = false;
    };
  }, []);

  return catalog;
}
