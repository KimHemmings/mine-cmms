'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, Target } from 'lucide-react';
import {
  DailyReportTargets,
  EMPTY_TARGETS,
  KpiTargetSet,
  resolveTargets,
  SUGGESTED_TARGETS,
  TARGETS_KEY,
  targetTone,
  TargetTone,
  readDailyReportTargets,
} from '@/utils/dailyReportTargets';
import {
  buildDailyReport,
  DatePreset,
  hoursLabel,
  MACHINE_CLASSES,
  ParetoRow,
  reportAreas,
  ReportAsset,
  ReportFilter,
  ReportOrder,
  shortFaultLabel,
  TrendPoint,
} from '@/utils/dailyReports';

const PRESET_KEY = 'daily-report-presets';
const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: '24h', label: 'Last 24h' },
  { id: '7d', label: '7 days' },
  { id: '14d', label: '14 days' },
  { id: '30d', label: '30 days' },
  { id: 'mtd', label: 'MTD' },
  { id: 'custom', label: 'Custom' },
];

const EMPTY_FILTER: ReportFilter = {
  assetQuery: '',
  area: 'all',
  machineClass: 'all',
  preset: '14d',
  start: '',
  end: '',
  lookbackDays: 14,
};

interface SavedPreset {
  name: string;
  filter: ReportFilter;
}

const fieldClass = 'mt-1 w-full min-h-11 rounded-lg border border-slate-400 bg-white px-3 text-sm font-bold normal-case text-slate-950';

export function DailyReportsUnauthorized() {
  return (
    <section className="rounded-xl border border-rose-300 bg-rose-50 p-6">
      <h2 className="text-lg font-black text-rose-950">Daily Maintenance Reports</h2>
      <p className="mt-2 text-sm font-bold text-rose-900">Clearance level 3 or higher is required. This meeting pack is not available on your login.</p>
    </section>
  );
}

export default function DailyReportsTab() {
  const [assets, setAssets] = useState<ReportAsset[]>([]);
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [filter, setFilter] = useState<ReportFilter>(EMPTY_FILTER);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [error, setError] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [drill, setDrill] = useState<ParetoRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [targets, setTargets] = useState<DailyReportTargets>(EMPTY_TARGETS);
  const [targetsOpen, setTargetsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]') as SavedPreset[];
      if (Array.isArray(saved)) setPresets(saved);
    } catch {
      setPresets([]);
    }
    setTargets(readDailyReportTargets(localStorage.getItem(TARGETS_KEY)));
  }, []);

  function load() {
    setStatus('loading');
    setError('');
    fetch('/api/daily-reports')
      .then(async (response) => {
        if (response.status === 403 || response.status === 401) {
          setStatus('forbidden');
          return;
        }
        const body = await response.json() as { assets?: ReportAsset[]; orders?: ReportOrder[]; error?: string };
        if (!response.ok) throw new Error(body.error || 'Could not load the daily reports.');
        setAssets(body.assets ?? []);
        setOrders(body.orders ?? []);
        setStatus('ready');
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not load the daily reports.');
        setStatus('error');
      });
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, []);

  const report = useMemo(
    () => (status === 'ready' ? buildDailyReport(assets, orders, filter) : null),
    [assets, orders, filter, status],
  );
  const areas = useMemo(() => reportAreas(assets), [assets]);
  const fleetIds = useMemo(() => assets.map((asset) => asset.fleetId).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [assets]);
  const activeTargets = useMemo(() => resolveTargets(targets, filter), [targets, filter]);

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const next = [...presets.filter((item) => item.name !== name), { name, filter }];
    setPresets(next);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    setPresetName('');
  }

  function saveTargets(next: DailyReportTargets) {
    setTargets(next);
    localStorage.setItem(TARGETS_KEY, JSON.stringify(next));
    setTargetsOpen(false);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        preset: filter.preset,
        asset: filter.assetQuery,
        area: filter.area,
        class: filter.machineClass,
        start: filter.start,
        end: filter.end,
        lookback: String(filter.lookbackDays),
      });
      const response = await fetch(`/api/daily-reports/export?${params.toString()}`);
      if (response.status === 403 || response.status === 401) {
        setStatus('forbidden');
        return;
      }
      if (!response.ok) throw new Error('Could not export this report.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'daily-maintenance-report.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export this report.');
      setStatus('error');
    } finally {
      setExporting(false);
    }
  }

  if (status === 'forbidden') return <DailyReportsUnauthorized />;

  return (
    <div className="daily-reports-root space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-950">Daily reports</h2>
        <button type="button" onClick={() => setTargetsOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-950 bg-white px-3 text-sm font-black print:hidden">
          <Target className="h-4 w-4" /> Set targets
        </button>
      </div>

      <section className="rounded-xl border border-slate-300 bg-sky-100 p-4 print:border-black print:bg-white">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-xs font-black uppercase tracking-wide text-slate-700">Machine
            <input
              list="daily-report-assets"
              value={filter.assetQuery}
              onChange={(event) => setFilter({ ...filter, assetQuery: event.target.value })}
              placeholder="Asset ID"
              className={fieldClass}
            />
            <datalist id="daily-report-assets">
              {fleetIds.map((id) => <option key={id} value={id} />)}
            </datalist>
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-slate-700">Fleet
            <select value={filter.area} onChange={(event) => setFilter({ ...filter, area: event.target.value })} className={fieldClass}>
              <option value="all">All fleets</option>
              {areas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-slate-700">Machine type
            <select value={filter.machineClass} onChange={(event) => setFilter({ ...filter, machineClass: event.target.value })} className={fieldClass}>
              <option value="all">All types</option>
              {MACHINE_CLASSES.map((item) => <option key={item} value={item}>{item}</option>)}
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-slate-700">Repeat window
            <select value={filter.lookbackDays} onChange={(event) => setFilter({ ...filter, lookbackDays: Number(event.target.value) })} className={fieldClass}>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter({ ...filter, preset: item.id })}
                className={`min-h-10 rounded-lg border px-3 text-sm font-black ${filter.preset === item.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-400 bg-white text-slate-900'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Morning Handover - 7d" aria-label="Meeting preset name" className="min-h-10 w-52 rounded-lg border border-slate-400 bg-white px-3 text-sm font-bold" />
            <button type="button" onClick={savePreset} className="min-h-10 rounded-lg border border-slate-400 bg-white px-3 text-sm font-black">Save</button>
            <select
              value=""
              aria-label="Load meeting preset"
              onChange={(event) => {
                const chosen = presets.find((item) => item.name === event.target.value);
                if (chosen) setFilter(chosen.filter);
              }}
              className="min-h-10 rounded-lg border border-slate-400 bg-white px-3 text-sm font-bold"
            >
              <option value="">Load</option>
              {presets.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
            <button type="button" onClick={() => void exportCsv()} disabled={exporting || status !== 'ready'} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white disabled:opacity-50">
              <Download className="h-4 w-4" /> {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-950 bg-white px-3 text-sm font-black">
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>
        </div>
        {filter.preset === 'custom' && (
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="text-xs font-black uppercase text-slate-700">Start
              <input type="date" value={filter.start} onChange={(event) => setFilter({ ...filter, start: event.target.value })} className="mt-1 block min-h-10 rounded-lg border border-slate-400 bg-white px-3 text-sm font-bold" />
            </label>
            <label className="text-xs font-black uppercase text-slate-700">End
              <input type="date" value={filter.end} onChange={(event) => setFilter({ ...filter, end: event.target.value })} className="mt-1 block min-h-10 rounded-lg border border-slate-400 bg-white px-3 text-sm font-bold" />
            </label>
          </div>
        )}
      </section>

      <p className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-black text-white">{report?.banner ?? 'All fleets · Last 14 days'}</p>

      {status === 'loading' && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
        </div>
      )}

      {status === 'error' && (
        <section className="rounded-xl border border-rose-300 bg-rose-50 p-4">
          <p className="text-sm font-bold text-rose-950">{error}</p>
          <button type="button" onClick={load} className="mt-3 min-h-10 rounded-lg bg-rose-800 px-3 text-sm font-black text-white">Try again</button>
        </section>
      )}

      {status === 'ready' && report && (
        <div className="space-y-4">
          {report.assetCount === 0 ? (
            <EmptyCopy text="No machines match this search, fleet, or type." />
          ) : report.empty ? (
            <EmptyCopy text="No faults or downtime match this filter." />
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Availability" value={report.kpis.availability == null ? '—' : `${report.kpis.availability.toFixed(1)}%`} note="% of time machines were ready to run" target={activeTargets.values.availability} direction="higher" unit="%" scope={activeTargets.scope} current={report.kpis.availability} />
            <Kpi label="MTBF" value={hoursLabel(report.kpis.mtbf)} note="Avg operating hours between breakdowns" target={activeTargets.values.mtbf} direction="higher" unit="h" scope={activeTargets.scope} current={report.kpis.mtbf} />
            <Kpi label="MTTR" value={hoursLabel(report.kpis.mttr)} note="Avg repair time per breakdown" target={activeTargets.values.mttr} direction="lower" unit="h" scope={activeTargets.scope} current={report.kpis.mttr} />
            <Kpi label="Total downtime" value={hoursLabel(report.kpis.downtimeHours)} note="All stopped hours (breakdowns, PM, waiting)" target={activeTargets.values.downtime} direction="lower" unit="h" scope={activeTargets.scope} current={report.kpis.downtimeHours} />
          </section>

          <section className="rounded-xl border border-slate-300 bg-white">
            <header className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-black text-slate-950">Common failures and bad actors</h2>
              <p className="text-sm text-slate-600">Ranked by hours lost and number of jobs</p>
            </header>
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <Pareto title="Failure modes" rows={report.failureModes} onPick={setDrill} />
              <Pareto title="Systems" rows={report.systems} onPick={setDrill} />
            </div>
            {drill && (
              <div className="border-t border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-slate-950">{drill.name}</h3>
                  <button type="button" onClick={() => setDrill(null)} className="text-sm font-bold underline">Close</button>
                </div>
                <ul className="mt-2 space-y-2">
                  {report.orders.filter((order) => drill.orderIds.includes(order.id)).map((order) => (
                    <li key={order.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <strong>{order.fleetId}</strong>
                      {order.woNumber ? ` · WO ${order.woNumber}` : ''}
                      {' · '}{shortFaultLabel(order.task)}
                      <span className="block text-slate-600">{hoursLabel(order.hours)} · {order.fitter || 'Unassigned'} · {order.systems.join(', ') || 'General'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-300 bg-white">
            <header className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-black text-slate-950">Downtime trend</h2>
              <p className="text-sm text-slate-600">{report.rangeLabel}</p>
            </header>
            <TrendChart points={report.trend} />
            <div className="overflow-x-auto border-t border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="px-4 py-3 text-left text-sm font-black text-slate-950">Current and last-24h stoppages</caption>
                <thead className="text-xs uppercase text-slate-600">
                  <tr>
                    {['Asset', 'Type', 'System / fault', 'Downtime', 'Status', 'Next action'].map((heading) => (
                      <th key={heading} className="px-3 py-2 font-black">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.stoppages.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-slate-600">No stoppages in the last 24 hours of this range.</td></tr>
                  ) : report.stoppages.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="whitespace-nowrap px-3 py-2 font-black text-slate-950">{row.fleetId}</td>
                      <td className="px-3 py-2">{row.machineClass}</td>
                      <td className="px-3 py-2">{row.fault}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold">{hoursLabel(row.hours)}</td>
                      <td className="px-3 py-2"><StatusPill status={row.status} /></td>
                      <td className="px-3 py-2">{row.nextAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-300 bg-white">
            <header className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-black text-slate-950">Repeat failure watchlist</h2>
              <p className="text-sm text-slate-600">Machines with the same system fault again within {filter.lookbackDays} days</p>
            </header>
            {report.crossTrends.length > 0 && (
              <ul className="space-y-2 border-b border-slate-200 p-4">
                {report.crossTrends.map((trend) => (
                  <li key={`${trend.machineClass}-${trend.system}`} className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">
                    {trend.machineClass} · {trend.system} on {trend.assets.join(', ')} ({trend.count} jobs)
                  </li>
                ))}
              </ul>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-600">
                  <tr>
                    {['Asset', 'Type', 'System', `Repeats (${filter.lookbackDays}d)`, 'Last gap', 'Last fix'].map((heading) => (
                      <th key={heading} className="px-3 py-2 font-black">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.repeats.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-slate-600">No repeat system failures in this window.</td></tr>
                  ) : report.repeats.map((row) => (
                    <tr key={`${row.fleetId}-${row.system}`} className="border-t border-slate-200">
                      <td className="whitespace-nowrap px-3 py-2 font-black text-slate-950">{row.fleetId}</td>
                      <td className="px-3 py-2">{row.machineClass}</td>
                      <td className="px-3 py-2">{row.system}</td>
                      <td className="px-3 py-2 font-black">{row.countInLookback}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold">{gapLabel(row.hoursSincePrior)}</td>
                      <td className="px-3 py-2">{shortFaultLabel(row.lastRepair)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {targetsOpen && (
        <TargetsDialog
          targets={targets}
          fleetIds={fleetIds}
          onClose={() => setTargetsOpen(false)}
          onSave={saveTargets}
        />
      )}
    </div>
  );
}

function gapLabel(hours: number | null) {
  if (hours == null || !Number.isFinite(hours)) return '—';
  if (hours >= 48) return `${(hours / 24).toFixed(1)}d`;
  return hoursLabel(hours);
}

function targetText(target: number | null, direction: 'higher' | 'lower', unit: '%' | 'h') {
  if (target == null) return 'Target: not set';
  const mark = direction === 'higher' ? '≥' : '≤';
  const shown = unit === '%' ? `${target}%` : hoursLabel(target);
  return `Target: ${mark} ${shown}`;
}

const TONE_COPY: Record<TargetTone, string> = {
  met: 'On target',
  near: 'Close',
  miss: 'Off target',
  none: '',
};

const TONE_CLASS: Record<TargetTone, string> = {
  met: 'border-l-emerald-600 text-emerald-800',
  near: 'border-l-amber-500 text-amber-800',
  miss: 'border-l-rose-700 text-rose-800',
  none: 'border-l-slate-300 text-slate-500',
};

function Kpi({
  label,
  value,
  note,
  target,
  direction,
  unit,
  scope,
  current,
}: {
  label: string;
  value: string;
  note: string;
  target: number | null;
  direction: 'higher' | 'lower';
  unit: '%' | 'h';
  scope: string;
  current: number | null;
}) {
  const tone = targetTone(current, target, direction);
  return (
    <article className={`rounded-xl border border-slate-300 border-l-4 bg-white p-4 ${TONE_CLASS[tone].split(' ')[0]}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-600">{note}</p>
      <p className="mt-2 text-xs font-black text-slate-800">{targetText(target, direction, unit)}</p>
      {tone !== 'none' && <p className={`text-xs font-black ${TONE_CLASS[tone].split(' ').slice(1).join(' ')}`}>{TONE_COPY[tone]}{scope === 'All fleets' ? '' : ` · ${scope}`}</p>}
    </article>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-400 bg-white px-4 py-6 text-sm font-bold text-slate-700">{text}</p>;
}

function StatusPill({ status }: { status: 'Down' | 'Derated' | 'Operational' }) {
  const label = status === 'Down' ? 'Down' : status === 'Derated' ? 'Restricted' : 'Back online';
  const tone = status === 'Down' ? 'bg-rose-700 text-white' : status === 'Derated' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-700 text-white';
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-black ${tone}`}>{label}</span>;
}

function Pareto({ title, rows, onPick }: { title: string; rows: ParetoRow[]; onPick: (row: ParetoRow) => void }) {
  const max = Math.max(...rows.map((row) => row.hours), 1);
  return (
    <div>
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      {rows.length === 0 ? <p className="mt-2 text-sm text-slate-600">Nothing to rank in this filter.</p> : (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li key={row.name}>
              <button type="button" onClick={() => onPick(row)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-slate-900">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-black text-slate-950">{row.name}</span>
                  <span className="shrink-0 text-right">
                    <span className="font-black text-slate-950">{row.count} {row.count === 1 ? 'job' : 'jobs'} · {hoursLabel(row.hours)}</span>
                    <span className="ml-2 text-xs font-medium text-slate-400">{row.cumulative.toFixed(0)}%</span>
                  </span>
                </span>
                <span className="mt-1 block h-2 rounded bg-slate-200">
                  <span className="block h-2 rounded bg-rose-700" style={{ width: `${(row.hours / max) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...points.flatMap((point) => [point.unplanned, point.planned, point.delay]), 1);
  const height = 180;
  const left = 40;
  const group = 52;
  const width = left + Math.max(points.length, 1) * group + 8;
  const bar = 12;
  const point = hover == null ? null : points[hover];
  return (
    <figure className="p-4">
      <figcaption className="mb-3 flex flex-wrap gap-2 text-xs font-black">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2 py-1 text-rose-900"><span className="h-2 w-2 rounded-full bg-rose-700" />Breakdowns</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-1 text-blue-900"><span className="h-2 w-2 rounded-full bg-blue-700" />Scheduled PM</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-1 text-amber-950"><span className="h-2 w-2 rounded-full bg-amber-600" />Waiting</span>
      </figcaption>
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height + 32}`} width={width} height={height + 32} role="img" aria-label="Downtime hours by period">
          <text x="0" y="12" fontSize="11" fill="#334155">{hoursLabel(max)}</text>
          <text x="0" y={height} fontSize="11" fill="#334155">0h</text>
          <line x1={left} y1={height} x2={width - 4} y2={height} stroke="#cbd5e1" />
          {points.map((item, index) => {
            const x = left + index * group + 8;
            const h = (value: number) => (value / max) * height;
            return (
              <g key={`${item.label}-${index}`} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
                <rect x={x - 4} y={0} width={group - 8} height={height} fill="transparent" />
                <rect x={x} y={height - h(item.unplanned)} width={bar} height={h(item.unplanned)} fill="#be123c" />
                <rect x={x + bar + 2} y={height - h(item.planned)} width={bar} height={h(item.planned)} fill="#1d4ed8" />
                <rect x={x + (bar + 2) * 2} y={height - h(item.delay)} width={bar} height={h(item.delay)} fill="#d97706" />
                <text x={x} y={height + 18} fontSize="11" fill="#1e293b">{item.label}</text>
              </g>
            );
          })}
        </svg>
        {point && (
          <p className="mt-1 text-sm font-bold text-slate-900">
            {point.label} · Breakdowns {hoursLabel(point.unplanned)} · Scheduled PM {hoursLabel(point.planned)} · Waiting {hoursLabel(point.delay)}
          </p>
        )}
      </div>
    </figure>
  );
}

function TargetsDialog({
  targets,
  fleetIds,
  onClose,
  onSave,
}: {
  targets: DailyReportTargets;
  fleetIds: string[];
  onClose: () => void;
  onSave: (next: DailyReportTargets) => void;
}) {
  const [draft, setDraft] = useState<DailyReportTargets>(targets);
  const [scope, setScope] = useState('defaults');
  const [assetId, setAssetId] = useState(fleetIds[0] ?? '');

  const editingKey = scope === 'asset' ? assetId.trim().toUpperCase() : scope;
  const current: KpiTargetSet = scope === 'defaults'
    ? draft.defaults
    : scope === 'asset'
      ? draft.byAsset[editingKey] ?? { availability: null, mtbf: null, mttr: null, downtime: null }
      : draft.byClass[scope] ?? { availability: null, mtbf: null, mttr: null, downtime: null };

  function update(field: keyof KpiTargetSet, raw: string) {
    const value = raw.trim() === '' ? null : Number(raw);
    const nextValue = value == null || Number.isFinite(value) ? value : current[field];
    const stored = scope === 'defaults' && field !== 'downtime' && nextValue == null
      ? SUGGESTED_TARGETS[field]
      : nextValue;
    const nextSet = { ...current, [field]: stored };
    if (scope === 'defaults') {
      setDraft({ ...draft, defaults: nextSet });
      return;
    }
    if (scope === 'asset') {
      if (!editingKey) return;
      setDraft({ ...draft, byAsset: { ...draft.byAsset, [editingKey]: nextSet } });
      return;
    }
    setDraft({ ...draft, byClass: { ...draft.byClass, [scope]: nextSet } });
  }

  function clearOverride() {
    if (scope === 'asset') {
      const byAsset = { ...draft.byAsset };
      delete byAsset[editingKey];
      setDraft({ ...draft, byAsset });
      return;
    }
    if (scope !== 'defaults') {
      const byClass = { ...draft.byClass };
      delete byClass[scope];
      setDraft({ ...draft, byClass });
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 print:hidden">
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-300 bg-white p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <h2 className="text-lg font-black text-slate-950">Set targets</h2>
        <p className="mt-1 text-sm text-slate-600">Defaults apply to all fleets. A machine type or asset ID replaces a number only when you fill it in.</p>
        <label className="mt-4 block text-xs font-black uppercase text-slate-700">Applies to
          <select value={scope} onChange={(event) => setScope(event.target.value)} className={fieldClass}>
            <option value="defaults">All fleets</option>
            {MACHINE_CLASSES.map((item) => <option key={item} value={item}>{item}</option>)}
            <option value="Other">Other</option>
            <option value="asset">One asset ID</option>
          </select>
        </label>
        {scope === 'asset' && (
          <label className="mt-3 block text-xs font-black uppercase text-slate-700">Asset ID
            <input list="target-assets" value={assetId} onChange={(event) => setAssetId(event.target.value)} className={fieldClass} />
            <datalist id="target-assets">{fleetIds.map((id) => <option key={id} value={id} />)}</datalist>
          </label>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TargetField label="Availability %" value={current.availability} hint="Higher is better. Default 85" onChange={(value) => update('availability', value)} />
          <TargetField label="MTBF hours" value={current.mtbf} hint="Higher is better. Default 120" onChange={(value) => update('mtbf', value)} />
          <TargetField label="MTTR hours" value={current.mttr} hint="Lower is better. Default 6.0" onChange={(value) => update('mttr', value)} />
          <TargetField label="Total downtime hours" value={current.downtime} hint="Lower is better. Leave blank for no target" onChange={(value) => update('downtime', value)} />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {scope !== 'defaults' && <button type="button" onClick={clearOverride} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-bold">Clear override</button>}
          <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-bold">Cancel</button>
          <button type="submit" className="min-h-10 rounded-lg bg-slate-950 px-3 text-sm font-black text-white">Save targets</button>
        </div>
      </form>
    </div>
  );
}

function TargetField({ label, value, hint, onChange }: { label: string; value: number | null; hint: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-black uppercase text-slate-700">{label}
      <input type="number" min="0" step="0.1" value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={fieldClass} />
      <span className="mt-1 block text-[11px] font-bold normal-case text-slate-500">{hint}</span>
    </label>
  );
}
