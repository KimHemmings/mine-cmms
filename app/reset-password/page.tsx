'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { KeyRound, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && exchangeError) setError(exchangeError.message);
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setReady(Boolean(data.session));
        setChecking(false);
      }
    }

    prepare();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-amber-600" />
          <h1 className="text-xl font-black text-slate-900">Choose a new password</h1>
        </div>
        {checking ? (
          <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking the reset link...</p>
        ) : ready ? (
          <form onSubmit={save} className="space-y-3">
            {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
            <label className="block space-y-1">
              <span className="text-sm font-bold text-slate-700">New password</span>
              <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="w-full min-h-12 px-3 rounded-xl border border-slate-300 text-base" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-bold text-slate-700">Confirm password</span>
              <input type="password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" className="w-full min-h-12 px-3 rounded-xl border border-slate-300 text-base" />
            </label>
            <button type="submit" disabled={saving} className="w-full min-h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-black uppercase disabled:opacity-50">
              {saving ? 'Saving...' : 'Save password'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">This reset link is missing or has expired. Request a new one from the sign-in page.</p>
            {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
            <Link href="/login" className="inline-flex min-h-12 items-center text-sm font-bold text-amber-700">Back to sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}
