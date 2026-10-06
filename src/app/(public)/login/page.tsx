'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Film,
  Coins,
  Gift,
} from 'lucide-react';
import { isSupabaseConfigured, signInWithGoogle } from '@/lib/supabase-service';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const supabaseConfigured = isSupabaseConfigured();

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);

    if (!supabaseConfigured) {
      // Demo mode fallback when Supabase keys are not yet pasted
      setLoading(false);
      router.push('/project/new');
      return;
    }

    try {
      await signInWithGoogle(`${window.location.origin}/auth/callback?next=/project/new`);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to initialize Google Login');
      setLoading(false);
    }
  };

  return (
    <div className="py-16 px-4 flex items-center justify-center">
      <div className="max-w-md w-full p-8 sm:p-10 rounded-3xl bg-white border border-[#E5E0D8] shadow-xl space-y-7 relative overflow-hidden">
        {/* Top subtle decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-orange-100/60 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 text-white font-black shadow-md shadow-zinc-900/10 mb-1">
            <Zap size={24} className="text-[#E05A30] fill-[#E05A30]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight flex items-center justify-center gap-2">
              <span>Rendoza AI</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#F4F0EA] text-zinc-600 border border-[#E5E0D8]">
                v2.0
              </span>
            </h1>
            <p className="text-xs text-zinc-600 mt-1">
              Sign in with your Google account to start creating videos
            </p>
          </div>

          {/* 30 Free Credits Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-[#E05A30] text-xs font-bold uppercase tracking-wider">
            <Gift size={14} />
            <span>Claim 30 Free Credits on Sign-In</span>
          </div>
        </div>

        {/* Google Sign-In Button */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-zinc-50 text-zinc-950 font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 border border-[#E5E0D8] hover:border-zinc-400 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <span className="text-xs text-zinc-600">Connecting to Google...</span>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {errorMsg && (
            <p className="text-xs text-rose-600 flex items-center justify-center gap-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200">
              <AlertCircle size={14} />
              {errorMsg}
            </p>
          )}

          {!supabaseConfigured && (
            <p className="text-[11px] text-zinc-500 text-center">
              (Preview Mode: Clicking will take you directly to your Creator Dashboard)
            </p>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="pt-4 border-t border-[#E5E0D8] space-y-2.5">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-center">
            What you get with your account
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-700">
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center gap-2">
              <Coins size={15} className="text-amber-500 shrink-0" />
              <span className="font-medium">30 Free Credits</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center gap-2">
              <Film size={15} className="text-blue-500 shrink-0" />
              <span className="font-medium">1080p Video Export</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center gap-2">
              <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
              <span className="font-medium">bKash / Nagad Topup</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center gap-2">
              <Sparkles size={15} className="text-purple-500 shrink-0" />
              <span className="font-medium">15% Referral Cash</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center pt-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-zinc-950 font-medium">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-zinc-950 font-medium">
              Privacy Policy
            </Link>
            . No passwords required.
          </p>
        </div>
      </div>
    </div>
  );
}
