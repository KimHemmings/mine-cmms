'use client';

import { useEffect, useState } from 'react';

const CHIPS = ['Go-Line', 'North Pit', 'Central Pit', 'South Pit', 'Fuel Bay'];
const TEN_HOURS_MS = 10 * 60 * 60 * 1000;

export function parkUpNeedsConfirm(updatedAt?: string | null, now = Date.now()) {
  if (!updatedAt) return true;
  const then = new Date(updatedAt).getTime();
  if (Number.isNaN(then)) return true;
  return now - then > TEN_HOURS_MS;
}

export default function LocationPill({
  location,
  onSave,
}: {
  location: string;
  onSave: (location: string) => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(location);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(location);
  }, [location]);

  const commit = async (next: string) => {
    const trimmed = next.trim();
    setOpen(false);
    if (!trimmed && trimmed === location.trim()) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen(true)}
        className="min-h-10 px-3 rounded-full border border-slate-300 bg-white text-xs font-black text-slate-700 hover:border-slate-500 disabled:opacity-50"
      >
        {location.trim() ? `@ ${location.trim()}` : 'Set Location...'}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit(value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit(value);
          }
          if (event.key === 'Escape') {
            setValue(location);
            setOpen(false);
          }
        }}
        placeholder="Pit, bench or go-line"
        className="min-h-10 w-44 rounded-lg border-2 border-amber-500 bg-white px-2 text-sm font-bold text-slate-900 focus:outline-none"
      />
      <div className="flex flex-wrap gap-1">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void commit(chip)}
            className="min-h-8 rounded-full border border-slate-300 bg-slate-50 px-2 text-[11px] font-black text-slate-700 hover:bg-white"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
