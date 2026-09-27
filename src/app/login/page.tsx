'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Sparkles,
  ArrowRight,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured, signInWithGoogle } from '@/lib/supabase-service';

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const supabaseConfigured = isSupabaseConfigured();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    if (!supabaseConfigured) {
      // Offline / LocalStorage demo mode
      setTimeout(() => {
        setLoading(false);
        setSuccessMsg('Signed in successfully (Demo mode)!');
        setTimeout(() => router.push('/dashboard'), 1000);
      }, 600);
      return;
    }

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              full_name: fullName.trim() || splitEmail(email),
            },
          },
        });

        if (error) throw error;
        if (data.session) {
          setSuccessMsg('Account created with 30 Free Credits! Redirecting...');
          setTimeout(() => router.push('/dashboard'), 1500);
        } else {
          setSuccessMsg('Verification email sent! Please check your inbox.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        setSuccessMsg('Signed in successfully! Redirecting...');
        setTimeout(() => router.push('/dashboard'), 1000);
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    if (!supabaseConfigured) {
      setErrorMsg('Supabase API keys are not configured in .env.local yet.');
      return;
    }
    await signInWithGoogle();
  };

  function splitEmail(e: string) {
    return e.split('@')[0];
  }

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white text-zinc-950 font-black shadow-lg shadow-white/10 mb-1">
            <Zap size={22} className="fill-zinc-950" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isSignUp ? 'Create Creator Account' : 'Welcome Back'}
          </h1>
          <p className="text-xs text-zinc-400">
            {isSignUp
              ? 'Sign up today and get 30 Free Image Credits automatically!'
              : 'Log in to access your video projects and credit dashboard'}
          </p>
        </div>

        {/* Google OAuth Button */}
        <div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-850 border border-zinc-700/80 text-xs font-semibold text-white flex items-center justify-center gap-2.5 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
            Or with email
          </span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5 text-xs">
          {isSignUp && (
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Your Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Hazrat Ali"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl pl-9 pr-3 py-2 text-white outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Email Address</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="email"
                required
                placeholder="creator@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl pl-9 pr-3 py-2 text-white outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl pl-9 pr-3 py-2 text-white outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <AlertCircle size={14} />
              {errorMsg}
            </p>
          )}

          {successMsg && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 size={14} />
              {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <span>Please wait...</span>
            ) : isSignUp ? (
              <>
                <span>Sign Up & Claim 30 Credits</span>
                <ArrowRight size={13} />
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={13} />
              </>
            )}
          </button>
        </form>

        {/* Toggle between Sign In / Sign Up */}
        <div className="text-center pt-2 text-xs text-zinc-400">
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-emerald-400 hover:underline font-semibold"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-emerald-400 hover:underline font-semibold"
              >
                Create Account (+30 Free Credits)
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
