'use client';

import { useEffect, useState } from 'react';
import { Asset } from '@/types';

const HAULAGE = ['Strip / Overburden', 'Coal Haulage'];

export function circuitChoices(assets: Asset[], current = '') {
  const diggers = assets
    .filter((asset) => asset.asset_type === 'Excavator' || asset.asset_type === 'Electric Shovel')
    .map((asset) => `Circuit: ${asset.fleet_id}`);
  const choices = [...diggers, ...HAULAGE];
  if (current && !choices.includes(current)) choices.unshift(current);
  return [...new Set(choices)];
}

export default function CircuitPill({
  circuit,
  assets,
  onSave,
}: {
  circuit: string;
  assets: Asset[];
  onSave: (circuit: string) => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const choices = circuitChoices(assets, circuit);

  useEffect(() => {
    setOpen(false);
  }, [circuit]);

  const commit = async (next: string) => {
    setOpen(false);
    if (next === circuit) return;
    setSaving(true);
    try {
      await onSave(next);
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
        className={`min-h-10 px-3 rounded-full border text-xs font-black disabled:opacity-50 ${
          circuit
            ? 'border-sky-300 bg-sky-50 text-sky-950'
            : 'border-slate-300 bg-white text-slate-500'
        }`}
      >
        {circuit || 'Set circuit...'}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void commit(choice)}
          className="min-h-9 px-2 rounded-full border border-sky-300 bg-sky-50 text-[11px] font-black text-sky-950"
        >
          {choice}
        </button>
      ))}
      {circuit && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void commit('')}
          className="min-h-9 px-2 rounded-full border border-slate-300 bg-white text-[11px] font-black text-slate-500"
        >
          Clear
        </button>
      )}
    </div>
  );
}
