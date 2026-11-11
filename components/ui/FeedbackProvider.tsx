'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

interface FeedbackContextValue {
  showToast: (options: ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const TOAST_STYLES: Record<ToastTone, { box: string; icon: React.ReactNode }> = {
  success: {
    box: 'bg-emerald-700 text-white',
    icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
  },
  error: {
    box: 'bg-rose-700 text-white',
    icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
  },
  info: {
    box: 'bg-slate-800 text-white',
    icon: <Info className="w-5 h-5 shrink-0" />,
  },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-2), { ...options, id }]);
      setTimeout(() => dismissToast(id), options.durationMs ?? 3500);
    },
    [dismissToast]
  );

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPendingConfirm({ ...options, resolve })),
    []
  );

  const closeConfirm = useCallback(
    (ok: boolean) => {
      pendingConfirm?.resolve(ok);
      setPendingConfirm(null);
    },
    [pendingConfirm]
  );

  useEffect(() => {
    if (!pendingConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingConfirm, closeConfirm]);

  return (
    <FeedbackContext.Provider value={{ showToast, confirm }}>
      {children}

      {pendingConfirm && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 id="confirm-title" className="text-xl font-black text-slate-900">
              {pendingConfirm.title}
            </h2>
            {pendingConfirm.message && <p className="text-base text-slate-700">{pendingConfirm.message}</p>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="min-h-12 px-5 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-base font-bold text-slate-800 transition"
              >
                {pendingConfirm.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => closeConfirm(true)}
                className={`min-h-12 px-5 rounded-xl text-base font-black text-white shadow-sm transition ${
                  pendingConfirm.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {pendingConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed bottom-4 inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none print:hidden"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.tone ?? 'success'];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl shadow-lg max-w-lg w-full sm:w-auto ${style.box}`}
            >
              {style.icon}
              <span className="text-base font-bold flex-1">{toast.message}</span>
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    dismissToast(toast.id);
                    toast.onAction?.();
                  }}
                  className="min-h-10 px-4 rounded-lg bg-white/20 hover:bg-white/30 text-base font-black uppercase tracking-wide transition"
                >
                  {toast.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-2 rounded-lg hover:bg-white/20 transition"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return ctx;
}
