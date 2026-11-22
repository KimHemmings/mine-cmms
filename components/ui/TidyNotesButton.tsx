'use client';

import { useRef, useState } from 'react';
import { correctSiteSpeech } from '@/utils/siteTerminology';
import { Sparkles } from 'lucide-react';

interface TidyNotesButtonProps {
  rawNotes: string;
  fleetId?: string;
  taskDescription?: string;
  isSingleNote?: boolean;
  onTidied: (text: string) => void;
  /** Stop dictation and return the sentence currently in the box. */
  prepare?: () => string;
  disabled?: boolean;
}

export default function TidyNotesButton({
  rawNotes,
  fleetId,
  taskDescription,
  isSingleNote = false,
  onTidied,
  prepare,
  disabled = false,
}: TidyNotesButtonProps) {
  const [previousNotes, setPreviousNotes] = useState<string | null>(null);
  const [tidying, setTidying] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  async function tidy(source?: string) {
    const raw = correctSiteSpeech((source ?? rawNotes).trim());
    if (!raw || busy.current) return;
    busy.current = true;
    setTidying(true);
    setError('');
    try {
      const response = await fetch('/api/ai-tidy-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNotes: raw, fleetId, taskDescription, isSingleNote }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.text !== 'string' || !data.text.trim()) {
        setError('Could not tidy that note.');
        return;
      }
      setPreviousNotes(raw);
      onTidied(data.text.trim());
    } catch {
      setError('Could not tidy that note.');
    } finally {
      busy.current = false;
      setTidying(false);
    }
  }

  function undo() {
    if (previousNotes === null) return;
    onTidied(previousNotes);
    setPreviousNotes(null);
    setError('');
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          const raw = rawNotes.trim();
          if (!raw) return;
          prepare?.();
          void tidy(raw);
        }}
        disabled={disabled || tidying || !rawNotes.trim()}
        className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-lg border-2 border-slate-900 bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" />
        {tidying ? 'Tidying...' : 'Tidy Notes'}
      </button>
      {previousNotes !== null && (
        <button
          type="button"
          onClick={undo}
          className="inline-flex items-center min-h-[38px] px-3 rounded-lg border-2 border-slate-300 bg-white text-slate-900 text-sm font-bold"
        >
          Undo
        </button>
      )}
      {error && <span className="w-full text-sm font-bold text-rose-700">{error}</span>}
    </span>
  );
}
