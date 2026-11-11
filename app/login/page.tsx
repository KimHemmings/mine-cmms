'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Wrench, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleReset() {
    setErrorMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setResetSent(true);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setErrorMsg('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-700/30 overflow-hidden">
        <div className="bg-slate-800 p-6 text-center border-b border-slate-700">
          <div className="inline-flex p-3 bg-amber-500 text-white rounded-xl shadow-md mb-3">
            <Wrench className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight uppercase">
            Mine Shift Workboard
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Field Dispatch & Maintenance Sign-In
          </p>
        </div>

        <form onSubmit={resetSent ? (event) => event.preventDefault() : handleLogin} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supervisor@site.mine"
                className="w-full h-11 pl-10 pr-3 text-sm font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-slate-900"
              />
            </div>
          </div>

          {!resetSent && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <button type="button" onClick={() => void handleReset()} disabled={loading || !email.trim()} className="text-xs font-bold text-amber-700 hover:text-amber-800 disabled:opacity-50">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-3 text-sm font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-slate-900"
              />
            </div>
          </div>
          )}

          {resetSent && (
            <p className="text-sm text-slate-700">
              If that email has an account, a reset link is on its way. Open it on this computer, then choose a new password.
            </p>
          )}

          {!resetSent && (
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white text-sm font-bold uppercase tracking-wider rounded-lg transition-all shadow-md disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <span>Sign In to Workboard</span>
            )}
          </button>
          )}
        </form>
      </div>
    </div>
  );
}