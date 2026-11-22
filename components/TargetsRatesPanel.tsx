'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { BOWEN_TARGETS, SiteTargets, TARGET_FIELDS, targetsFromRow } from '@/utils/managementRates';

export default function TargetsRatesPanel({
  actorName,
  readOnly = false,
  onSaved,
  onClose,
}: {
  actorName: string;
  readOnly?: boolean;
  onSaved?: (targets: SiteTargets) => void;
  onClose?: () => void;
}) {
  const [rates, setRates] = useState<SiteTargets>(BOWEN_TARGETS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.from('site_targets_rates').select('*').eq('id', 1).maybeSingle().then(({ data, error: loadError }) => {
      if (loadError || !data) return;
      setRates(targetsFromRow(data as Record<string, unknown>));
    });
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    const { error: saveError } = await supabase.from('site_targets_rates').upsert({
      id: 1,
      ...rates,
      updated_by: actorName || 'SSE / GM',
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (saveError) {
      setError('Those targets did not save.');
      return;
    }
    setError('');
    setSaved(true);
    onSaved?.(rates);
  };

  const form = (
    <form onSubmit={(event) => void save(event)} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Targets & Rates ($)</h2>
          <p className="mt-1 text-sm text-slate-500">{readOnly ? 'Benchmarks are set by a superintendent or the SSE / GM. This view is read-only.' : 'These rates drive the Site Command dollar cards. Level 4 and Level 5 can save them.'}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-black text-slate-700">Close</button>
        )}
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {saved && <p className="text-sm font-bold text-emerald-800">Targets saved.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {TARGET_FIELDS.map((field) => (
          <label key={field.key} className="text-xs font-bold text-slate-600">
            {field.label} <span className="font-medium text-slate-400">{field.suffix}</span>
            <input
              type="number"
              min={0}
              max={field.max}
              step="0.01"
              disabled={readOnly}
              value={rates[field.key]}
              onChange={(event) => {
                const value = Number(event.target.value);
                setRates((current) => ({ ...current, [field.key]: Number.isFinite(value) ? value : 0 }));
              }}
              className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2 text-sm font-bold text-slate-900 disabled:bg-slate-100"
            />
          </label>
        ))}
      </div>
      <SanityPreview rates={rates} />
      {!readOnly && (
        <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      )}
    </form>
  );

  if (!onClose) return <div className="rounded-xl border border-slate-300 bg-white p-4">{form}</div>;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Targets and rates">
      <div className="mt-8 w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">{form}</div>
    </div>
  );
}

function SanityPreview({ rates }: { rates: SiteTargets }) {
  const romImpact = (1000 * (rates.chpp_wash_yield_pct / 100) * rates.coal_margin_per_tonne).toLocaleString('en-AU');
  const bcmImpact = (10000 * rates.overburden_rate_per_bcm).toLocaleString('en-AU');
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
      <p className="text-xs font-black uppercase tracking-wide text-slate-600">Calculation Sanity-Check Preview</p>
      <p className="text-sm text-slate-800">1,000t ROM shortfall → = ${romImpact} saleable coal margin impact</p>
      <p className="text-sm text-slate-800">10,000 BCM overburden shortfall → = ${bcmImpact} strip value impact</p>
      <p className="text-sm text-slate-800">1 Contractor Shift (Operator / Trades) → = ${rates.operator_contractor_shift_cost.toLocaleString('en-AU')} / ${rates.trades_contractor_shift_cost.toLocaleString('en-AU')} per 12h</p>
      <p className="text-sm text-slate-800">1 Overtime Shift → = ${rates.overtime_shift_cost.toLocaleString('en-AU')} per 12h</p>
    </div>
  );
}
