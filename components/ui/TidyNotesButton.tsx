'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface TidyNotesButtonProps {
  rawNotes: string;
  fleetId?: string;
  taskDescription?: string;
  isSingleNote?: boolean;
  onTidied: (text: string) => void;
  disabled?: boolean;
}

export default function TidyNotesButton({
  rawNotes,
  fleetId,
  taskDescription,
  isSingleNote = false,
  onTidied,
  disabled = false,
}: TidyNotesButtonProps) {
  const [previousNotes, setPreviousNotes] = useState<string | null>(null);
  const [tidying, setTidying] = useState(false);
  const [error, setError] = useState('');

  async function tidy() {
    const raw = rawNotes.trim();
    if (!raw || tidying) return;
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
      setPreviousNotes(rawNotes);
      onTidied(data.text.trim());
    } catch {
      setError('Could not tidy that note.');
    } finally {
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
        onClick={() => void tidy()}
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
      {error && <span className="text-sm font-bold text-rose-700">{error}</span>}
    </span>
  );
}
