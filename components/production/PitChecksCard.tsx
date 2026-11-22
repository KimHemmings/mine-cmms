'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface PitCheckValues {
  highwall_status: string;
  highwall_notes: string;
  blast_status: string;
  blast_notes: string;
  dewatering_status: string;
  dewatering_notes: string;
  ramps_lighting_status: string;
  ramps_lighting_notes: string;
}

export const EMPTY_PIT_CHECKS: PitCheckValues = {
  highwall_status: 'Checked',
  highwall_notes: '',
  blast_status: 'All Clear',
  blast_notes: '',
  dewatering_status: 'Normal',
  dewatering_notes: '',
  ramps_lighting_status: 'Good',
  ramps_lighting_notes: '',
};

export type PitCheckKey = 'highwall' | 'blast' | 'dewatering' | 'ramps';

const ROWS: { key: PitCheckKey; status: keyof PitCheckValues; notes: keyof PitCheckValues; label: string; options: string[] }[] = [
  { key: 'highwall', status: 'highwall_status', notes: 'highwall_notes', label: 'Highwall / Lowwall & Bench Inspections', options: ['Checked', 'Action Required', 'Restricted Zone'] },
  { key: 'blast', status: 'blast_status', notes: 'blast_notes', label: 'Blast Exclusion & Shotfiring Windows', options: ['No Blast Scheduled', 'Blast Window Active', 'All Clear'] },
  { key: 'dewatering', status: 'dewatering_status', notes: 'dewatering_notes', label: 'Dewatering, Sumps & Pumps', options: ['Normal', 'Pump Attention', 'Water Impacting Pit'] },
  { key: 'ramps', status: 'ramps_lighting_status', notes: 'ramps_lighting_notes', label: 'Ramps, Dumps & Lighting Plants', options: ['Good', 'Maintenance Required', 'Lighting Issue'] },
];

const CHECK_KEYS = new Set<string>(ROWS.map((row) => row.key));

export function pitCheckLines(values: PitCheckValues, carried: string[] = []) {
  const open = new Set(carried);
  return ROWS.map((row) => ({
    label: row.label,
    status: open.has(row.key) ? `${values[row.status] || '—'} · CARRIED OVER FROM PREV SHIFT` : (values[row.status] || '—'),
    notes: values[row.notes] || '',
  }));
}

function blastIsClear(status: string) {
  return status === 'Clear' || status === 'All Clear' || status === 'No Blast Scheduled';
}

function statusIsClear(key: PitCheckKey, status: string) {
  if (key === 'highwall') return status === 'Checked';
  if (key === 'blast') return blastIsClear(status);
  if (key === 'dewatering') return status === 'Normal';
  return status === 'Good';
}

function shiftRank(date: string, name: string) {
  return `${date}|${name === 'Night Shift' ? '1' : '0'}`;
}

interface CheckRow extends PitCheckValues {
  shift_date: string;
  shift_name: string;
  crew_group: string;
  carried_fields: string[] | null;
  updated_at: string | null;
}

function valuesFrom(row: PitCheckValues): PitCheckValues {
  return {
    highwall_status: row.highwall_status || EMPTY_PIT_CHECKS.highwall_status,
    highwall_notes: row.highwall_notes || '',
    blast_status: row.blast_status || EMPTY_PIT_CHECKS.blast_status,
    blast_notes: row.blast_notes || '',
    dewatering_status: row.dewatering_status || EMPTY_PIT_CHECKS.dewatering_status,
    dewatering_notes: row.dewatering_notes || '',
    ramps_lighting_status: row.ramps_lighting_status || EMPTY_PIT_CHECKS.ramps_lighting_status,
    ramps_lighting_notes: row.ramps_lighting_notes || '',
  };
}

function carryForward(previous: PitCheckValues) {
  const values = { ...EMPTY_PIT_CHECKS };
  const carried: PitCheckKey[] = [];
  for (const row of ROWS) {
    const status = previous[row.status] || '';
    if (statusIsClear(row.key, status)) continue;
    values[row.status] = status;
    values[row.notes] = previous[row.notes] || '';
    carried.push(row.key);
  }
  return { values, carried };
}

export default function PitChecksCard({
  shiftDate,
  shiftName,
  crewGroup,
  supervisorName,
  onChange,
}: {
  shiftDate: string;
  shiftName: 'Day Shift' | 'Night Shift';
  crewGroup: string | null;
  supervisorName: string;
  onChange: (values: PitCheckValues, carried: string[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [values, setValues] = useState<PitCheckValues>(EMPTY_PIT_CHECKS);
  const [carried, setCarried] = useState<PitCheckKey[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    onChange(values, carried);
  }, [values, carried, onChange]);

  useEffect(() => {
    if (!crewGroup) return;
    let cancelled = false;
    void supabase
      .from('production_handover_checks')
      .select('shift_date, shift_name, crew_group, highwall_status, highwall_notes, blast_status, blast_notes, dewatering_status, dewatering_notes, ramps_lighting_status, ramps_lighting_notes, carried_fields, updated_at')
      .order('shift_date', { ascending: false })
      .limit(24)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError('Pit checks could not be loaded.');
          return;
        }
        const rows = (data ?? []) as CheckRow[];
        const current = rows.find((row) => row.shift_date === shiftDate && row.shift_name === shiftName && row.crew_group === crewGroup);
        if (current) {
          const loaded = valuesFrom(current);
          const stored = (current.carried_fields ?? []).flatMap((key) => {
            if (!CHECK_KEYS.has(key)) return [];
            const check = key as PitCheckKey;
            const row = ROWS.find((item) => item.key === check);
            if (!row || statusIsClear(check, loaded[row.status])) return [];
            return [check];
          });
          setValues(loaded);
          setCarried(stored);
          return;
        }
        const currentRank = shiftRank(shiftDate, shiftName);
        const previous = rows
          .filter((row) => shiftRank(row.shift_date, row.shift_name) < currentRank)
          .sort((a, b) => shiftRank(b.shift_date, b.shift_name).localeCompare(shiftRank(a.shift_date, a.shift_name))
            || (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
        if (!previous) {
          setValues(EMPTY_PIT_CHECKS);
          setCarried([]);
          return;
        }
        const carriedIn = carryForward(valuesFrom(previous));
        setValues(carriedIn.values);
        setCarried(carriedIn.carried);
      });
    return () => {
      cancelled = true;
    };
  }, [crewGroup, shiftDate, shiftName, supabase]);

  const save = async (next: PitCheckValues, touched?: PitCheckKey) => {
    if (!crewGroup) return;
    const remaining = touched ? carried.filter((key) => key !== touched) : carried;
    setValues(next);
    setCarried(remaining);
    const { error: saveError } = await supabase.from('production_handover_checks').upsert({
      shift_date: shiftDate,
      shift_name: shiftName,
      crew_group: crewGroup,
      ...next,
      carried_fields: remaining,
      updated_by: supervisorName || 'Production Supervisor',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shift_date,shift_name,crew_group' });
    setError(saveError ? 'That pit check did not save. Check the pit signal and try again.' : '');
  };

  return (
    <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-3">
      <div>
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Statutory Pit & OCE Checks</h3>
        <p className="text-sm text-slate-500">{shiftName} · {shiftDate}{crewGroup ? ` · ${crewGroup} Crew` : ''}</p>
      </div>
      {!crewGroup ? (
        <p className="text-sm font-bold text-amber-800">The active crew is not set, so these checks cannot be saved yet.</p>
      ) : (
        <div className="space-y-3">
          {ROWS.map((row) => (
            <div key={row.status} className="grid gap-2 md:grid-cols-[1.1fr_0.8fr_1.4fr] md:items-center">
              <div>
                <p className="text-sm font-black text-slate-800">{row.label}</p>
                {carried.includes(row.key) && (
                  <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-900">
                    CARRIED OVER FROM PREV SHIFT
                  </span>
                )}
              </div>
              <select
                value={values[row.status]}
                onChange={(event) => void save({ ...values, [row.status]: event.target.value }, row.key)}
                className="min-h-11 rounded-lg border-2 border-slate-300 bg-white px-2 text-sm font-bold text-slate-900"
              >
                {!row.options.includes(values[row.status]) && values[row.status] && (
                  <option value={values[row.status]}>{values[row.status]}</option>
                )}
                {row.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input
                value={values[row.notes]}
                onChange={(event) => setValues((current) => ({ ...current, [row.notes]: event.target.value }))}
                onBlur={(event) => void save({ ...values, [row.notes]: event.target.value }, row.key)}
                placeholder="Note"
                className="min-h-11 rounded-lg border-2 border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
    </section>
  );
}
