'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Whether a visitor is already signed in, so the page can send them to Home instead of sign-up. */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    try {
      createClient()
        .auth.getUser()
        .then(({ data }) => setSignedIn(Boolean(data?.user)))
        .catch(() => setSignedIn(false));
    } catch {
      // No auth in this environment: treat as a guest.
    }
  }, []);
  return signedIn;
}
