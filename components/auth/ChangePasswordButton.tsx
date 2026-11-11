'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useFeedback } from '@/components/ui/FeedbackProvider';

export function ChangePasswordButton() {
  const supabase = createClient();
  const { showToast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setPassword('');
    setConfirm('');
    setOpen(false);
    showToast({ message: 'Password changed' });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="min-h-11 flex items-center gap-1.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-bold rounded-xl transition"
      >
        <KeyRound className="w-4 h-4" /> Password
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
          <form onSubmit={save} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="change-password-title" className="text-xl font-black text-slate-900">Change password</h2>
                <p className="text-sm text-slate-600 mt-1">This updates the password for the account you are signed in with.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
            <label className="block space-y-1">
              <span className="text-sm font-bold text-slate-700">New password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="w-full min-h-12 px-3 rounded-xl border border-slate-300 text-base"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-bold text-slate-700">Confirm password</span>
              <input
                type="password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                className="w-full min-h-12 px-3 rounded-xl border border-slate-300 text-base"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="min-h-12 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="min-h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black disabled:opacity-50">
                {saving ? 'Saving...' : 'Save password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
