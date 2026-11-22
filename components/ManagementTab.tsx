'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Asset, CrewMember, MachineWorkOrder, ShiftRecord } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { CREW_LETTERS, ManagementSnapshot, ModelGap, buildManagementSnapshot, statutoryRollup } from '@/utils/managementGaps';
import {
  BOWEN_TARGETS,
  SiteTargets,
  coalMargin,
  exposureHorizon,
  formatAud,
  formatAudExact,
  forwardExposureFormula,
  labourFormula,
  lostMachineHours,
  manningLoss,
  mechanicalLoss,
  modelForwardExposure,
  outputVarianceFormula,
  primaryClass,
  primaryFleetCount,
  shiftLabour,
  targetsFromRow,
  unmannedByModel,
  unmannedHours,
  useOfAvailability,
} from '@/utils/managementRates';
import { HandoverCheckRow, recordFromRow, shiftRank } from '@/utils/productionHandoverRecord';
import { Department, departmentLabel } from '@/utils/permissions';
import { CrewLetter, crewLetter } from '@/utils/shiftRoster';
import AccountabilitySplit, { ShiftBooks } from '@/components/AccountabilitySplit';
import ManagementDirectives from '@/components/ManagementDirectives';
import TargetsRatesPanel from '@/components/TargetsRatesPanel';

type CrewChoice = 'active' | CrewLetter;
type SiteScope = 'all' | Department;

const RISK_CLASS: Record<ModelGap['risk'], string> = {
  SHORTFALL: 'bg-rose-700 text-white',
  'NO CRIB RELIEF': 'bg-amber-500 text-amber-950',
  COVERED: 'bg-emerald-700 text-white',
};

export default function ManagementTab({
  assets,
  crew,
  workOrders,
  activeShift,
  downAssetIds,
  actorName,
  accessLevel = 5,
}: {
  assets: Asset[];
  crew: CrewMember[];
  workOrders: MachineWorkOrder[];
  activeShift: ShiftRecord | null;
  downAssetIds: string[];
  actorName: string;
  accessLevel?: number;
}) {
  const activeLetter = crewLetter(activeShift?.crew) ?? 'A';
  const [choice, setChoice] = useState<CrewChoice>('active');
  const [scope, setScope] = useState<SiteScope>('all');
  const [targets, setTargets] = useState<SiteTargets>(BOWEN_TARGETS);
  const [rateStamp, setRateStamp] = useState<{ by: string | null; at: string | null }>({ by: null, at: null });
  const [now, setNow] = useState(() => Date.now());
  const [weekActuals, setWeekActuals] = useState<{ rom: string; bcm: string }[]>([]);
  const [action, setAction] = useState<'directive' | 'rates' | null>(null);
  const [statutory, setStatutory] = useState<ReturnType<typeof statutoryRollup> | null>(null);
  const letter = choice === 'active' ? activeLetter : choice;
  const crewLabel = choice === 'active' ? `Active shift · ${activeShift?.crew || `${activeLetter} Crew`}` : `${letter} Crew`;
  const showMoney = targets.show_financials;
  const snapshot = useMemo(
    () => buildManagementSnapshot(assets, crew, workOrders, letter, downAssetIds),
    [assets, crew, workOrders, letter, downAssetIds],
  );
  const unmannedModels = useMemo(() => unmannedByModel(assets, crew, letter, downAssetIds), [assets, crew, letter, downAssetIds]);
  const horizon = useMemo(() => exposureHorizon(new Date(now)), [now]);
  const books = useMemo(
    () => buildBooks(snapshot, assets, crew, letter, downAssetIds, targets, weekActuals, horizon),
    [snapshot, assets, crew, letter, downAssetIds, targets, weekActuals, horizon],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const sinceDate = since.toISOString().slice(0, 10);
    void supabase
      .from('production_handover_checks')
      .select('*')
      .order('shift_date', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const rows = (data ?? []) as HandoverCheckRow[];
        const latest = [...rows].sort((a, b) => shiftRank(b.shift_date ?? '', b.shift_name ?? '').localeCompare(shiftRank(a.shift_date ?? '', a.shift_name ?? '')))[0];
        setStatutory(statutoryRollup(latest ? recordFromRow(latest) : null));
        setWeekActuals(rows.filter((row) => String(row.shift_date ?? '') >= sinceDate).map((row) => {
          const production = row.shift_production && typeof row.shift_production === 'object' ? row.shift_production as { romCoal?: string; primeOverburden?: string } : {};
          return { rom: production.romCoal ?? '', bcm: production.primeOverburden ?? '' };
        }));
      });
    void supabase.from('site_targets_rates').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (!data) return;
      const row = data as Record<string, unknown>;
      setTargets(targetsFromRow(row));
      setRateStamp({
        by: typeof row.updated_by === 'string' && row.updated_by.trim() ? row.updated_by : null,
        at: typeof row.updated_at === 'string' ? row.updated_at : null,
      });
    });
  }, []);

  const setMoneyMode = (next: boolean) => {
    setTargets((current) => ({ ...current, show_financials: next }));
    if (accessLevel !== 5) return;
    const supabase = createClient();
    void supabase.from('site_targets_rates').upsert({
      id: 1,
      ...targets,
      show_financials: next,
      updated_by: actorName || 'SSE / GM',
      updated_at: new Date().toISOString(),
    });
  };

  const print = async () => {
    const { generateManagementSummary } = await import('@/utils/managementSummaryPdf');
    generateManagementSummary({ ...snapshot, manning: snapshot.manning, models: snapshot.models.filter((row) => row.risk !== 'COVERED') }, crewLabel);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Site scope">
          {(['all', 'workshop', 'production', 'training'] as const).map((item) => (
            <FilterChip key={item} active={scope === item} onClick={() => setScope(item)}>{item === 'all' ? 'All Site' : departmentLabel(item)}</FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-300 bg-white p-1" role="group" aria-label="Display">
            <span className="px-2 text-xs font-black uppercase tracking-wide text-slate-500">Display</span>
            <button type="button" aria-pressed={showMoney} onClick={() => setMoneyMode(true)} className={`min-h-9 rounded-full px-3 text-sm font-black ${showMoney ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>$ AUD</button>
            <button type="button" aria-pressed={!showMoney} onClick={() => setMoneyMode(false)} className={`min-h-9 rounded-full px-3 text-sm font-black ${showMoney ? 'text-slate-600' : 'bg-slate-900 text-white'}`}>Units</button>
          </div>
          <button type="button" onClick={() => setAction((current) => current === 'directive' ? null : 'directive')} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-black text-slate-900">Flag Directive</button>
          <button type="button" onClick={() => setAction('rates')} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-black text-slate-900">Set Targets & Rates ($)</button>
          <p className="text-xs font-bold text-slate-500">{rateStampText(rateStamp.by, rateStamp.at)}</p>
          <button type="button" onClick={() => void print()} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
      {action === 'directive' && <ManagementDirectives actorName={actorName} canIssue submitLabel="Flag directive" />}
      {action === 'rates' && (
        <TargetsRatesPanel
          actorName={actorName}
          readOnly={accessLevel < 4}
          onClose={() => setAction(null)}
          onSaved={(next) => {
            setTargets({ ...next, show_financials: targets.show_financials });
            setRateStamp({ by: actorName || 'Superintendent', at: new Date().toISOString() });
          }}
        />
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Crew comparison">
        <FilterChip active={choice === 'active'} onClick={() => setChoice('active')}>Active Shift Crew</FilterChip>
        {CREW_LETTERS.map((item) => (
          <FilterChip key={item} active={choice === item} onClick={() => setChoice(item)}>{item}</FilterChip>
        ))}
      </div>

      <KpiStrip snapshot={snapshot} targets={targets} books={books} showMoney={showMoney} exposureFormula={forwardExposureFormula(primaryFleetCount(assets, crew, letter, downAssetIds), targets, horizon.hours, horizon.label)} />
      <SevenDayRollup books={books} targets={targets} showMoney={showMoney} />
      {scope === 'all' && <AccountabilitySplit snapshot={snapshot} targets={targets} books={books} showMoney={showMoney} />}
      <ManningTable rows={snapshot.manning} targets={targets} showMoney={showMoney} />
      <CompetencyMatrix rows={snapshot.models.filter((row) => row.risk !== 'COVERED')} letter={letter} targets={targets} showMoney={showMoney} unmannedModels={unmannedModels} horizon={horizon} />
      <div className="grid gap-4 lg:grid-cols-2">
        <HoldCard snapshot={snapshot} />
        <StatutoryCard statutory={statutory} />
      </div>
    </div>
  );
}

function buildBooks(
  snapshot: ManagementSnapshot,
  assets: Asset[],
  crew: CrewMember[],
  letter: CrewLetter,
  downAssetIds: string[],
  targets: SiteTargets,
  weekActuals: { rom: string; bcm: string }[],
  horizon: { hours: number; label: string },
): ShiftBooks {
  const counts = primaryFleetCount(assets, crew, letter, downAssetIds);
  const coal = coalMargin(weekActuals, targets);
  const hours = horizon.hours;
  const labour = (department: 'workshop' | 'production', crewLetter: CrewLetter) => {
    const row = snapshot.manning.find((item) => item.letter === crewLetter && item.department === department);
    return shiftLabour(department, row?.overtime ?? 0, row?.contractors ?? 0, targets);
  };
  const heads = (department: 'workshop' | 'production') => snapshot.manning.find((item) => item.letter === letter && item.department === department);
  const week = (department: 'workshop' | 'production') => CREW_LETTERS.reduce((sum, item) => sum + labour(department, item), 0);
  const workshop = heads('workshop');
  const production = heads('production');
  return {
    mechanical: mechanicalLoss(counts, targets, hours),
    mechanicalHours: lostMachineHours(counts, hours),
    manning: manningLoss(counts, targets, hours),
    manningHours: unmannedHours(counts, hours),
    exposureHours: hours,
    exposureLabel: horizon.label,
    downDiggers: counts.downDiggers,
    downTrucks: counts.downTrucks,
    unmannedDiggers: counts.unmannedDiggers,
    unmannedTrucks: counts.unmannedTrucks,
    usePct: useOfAvailability(counts),
    workshopShift: labour('workshop', letter),
    productionShift: labour('production', letter),
    workshopWeek: week('workshop'),
    productionWeek: week('production'),
    workshopOt: workshop?.overtime ?? 0,
    workshopContractors: workshop?.contractors ?? 0,
    productionOt: production?.overtime ?? 0,
    productionContractors: production?.contractors ?? 0,
    coalShifts: coal.shifts,
    rom: coal.rom,
    romTarget: coal.romTarget,
    tonneVariance: coal.tonneVariance,
    saleable: coal.saleable,
    saleableTarget: coal.saleableTarget,
    marginVariance: coal.marginVariance,
    bcm: coal.bcm,
    bcmTarget: coal.bcmTarget,
    bcmVariance: coal.bcmVariance,
    bcmDollars: coal.bcmDollars,
    outputVariance: coal.outputVariance,
    forwardExposure: mechanicalLoss(counts, targets, hours) + manningLoss(counts, targets, hours),
  };
}

function rateStampText(by: string | null, at: string | null) {
  if (!by) return 'Rates still on initial defaults';
  return `Rates set by ${by} • ${relativeTime(at)}`;
}

function relativeTime(iso: string | null) {
  if (!iso) return 'just now';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'just now';
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`min-h-10 px-3 rounded-full border text-sm font-black ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
      {children}
    </button>
  );
}

function KpiStrip({ snapshot, targets, books, showMoney, exposureFormula }: { snapshot: ManagementSnapshot; targets: SiteTargets; books: ShiftBooks; showMoney: boolean; exposureFormula: string }) {
  const workshopLabour = labourFormula('workshop', books.workshopOt, books.workshopContractors, targets);
  const productionLabour = labourFormula('production', books.productionOt, books.productionContractors, targets);
  const cards = [
    {
      title: 'Hard cash labour spend',
      value: showMoney ? formatAud(books.workshopShift + books.productionShift) : `${books.workshopOt + books.productionOt} OT · ${books.workshopContractors + books.productionContractors} contractors`,
      detail: showMoney
        ? `Workshop ${formatAud(books.workshopShift)} · Production ${formatAud(books.productionShift)} this shift`
        : `Workshop ${books.workshopOt} OT / ${books.workshopContractors} contractors · Production ${books.productionOt} OT / ${books.productionContractors} contractors`,
      formula: `Workshop: ${workshopLabour}. Production: ${productionLabour}. Hard cash labour ${formatAudExact(books.workshopShift + books.productionShift)}. Machine hours are not included.`,
      tone: 'bg-slate-900 text-white',
    },
    {
      title: 'Output variance',
      value: books.coalShifts === 0 ? 'No pit actuals' : showMoney ? formatAud(books.outputVariance) : `${formatSigned(books.tonneVariance)} t · ${formatSigned(books.bcmVariance)} BCM`,
      detail: books.coalShifts === 0
        ? `Each logged shift is measured against ${formatQty(targets.target_rom_tonnes_shift)} t ROM at ${targets.chpp_wash_yield_pct}% yield`
        : showMoney
          ? `Saleable ${formatAud(books.marginVariance)} · waste ${formatAud(books.bcmDollars)}`
          : `${formatQty(books.saleable)} saleable t vs ${formatQty(books.saleableTarget)} t`,
      formula: outputVarianceFormula(books, targets),
      tone: books.outputVariance < 0 ? 'bg-rose-800 text-white' : 'bg-slate-800 text-white',
    },
    {
      title: 'Forward Shift Exposure ($)',
      value: showMoney ? formatAud(books.forwardExposure) : `${Math.round(books.mechanicalHours + books.manningHours)} h`,
      detail: showMoney
        ? `Down ${formatAud(books.mechanical)} · unmanned ${formatAud(books.manning)} · ${books.exposureLabel}`
        : `${books.downDiggers + books.downTrucks} down · ${books.unmannedDiggers + books.unmannedTrucks} unmanned · ${books.exposureLabel}`,
      formula: exposureFormula,
      tone: books.forwardExposure > 0 ? 'bg-amber-500 text-amber-950' : 'bg-emerald-800 text-white',
    },
    {
      title: 'Primary availability',
      value: `${snapshot.availabilityPct}% vs ${targets.target_primary_pa_pct}%`,
      detail: `Use of availability ${books.usePct}% vs ${targets.target_primary_uoa_pct}%`,
      formula: 'Physical availability is ready units / fleet. Use of availability is manned healthy diggers and trucks / healthy diggers and trucks. Neither percent is turned into a second dollar on top of forward exposure.',
      tone: 'bg-slate-800 text-white',
    },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.title} className={`rounded-xl p-4 ${card.tone}`}>
          <p className="text-[11px] font-black uppercase tracking-wide opacity-80">{card.title}</p>
          <p className="mt-2 cursor-help text-2xl font-black leading-tight underline decoration-dotted underline-offset-4" title={card.formula}>{card.value}</p>
          <p className="mt-2 text-sm font-bold opacity-90">{card.detail}</p>
        </article>
      ))}
    </div>
  );
}

function SevenDayRollup({ books, targets, showMoney }: { books: ShiftBooks; targets: SiteTargets; showMoney: boolean }) {
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">7-day production rollup</h2>
      {books.coalShifts === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No pit actuals in the last 7 days. Each logged shift is measured against {formatQty(targets.target_rom_tonnes_shift)} t ROM and {formatQty(targets.target_prime_bcm_shift)} BCM.</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <p className="text-sm"><span className="block text-[11px] font-black uppercase text-slate-500">Logged shifts</span><span className="font-black">{books.coalShifts}</span></p>
          <p className="text-sm"><span className="block text-[11px] font-black uppercase text-slate-500">Saleable coal</span><span className="cursor-help font-black underline decoration-dotted" title={outputVarianceFormula(books, targets)}>{formatQty(books.saleable)} t vs {formatQty(books.saleableTarget)} t{showMoney ? ` · ${formatAud(books.marginVariance)}` : ''}</span></p>
          <p className="text-sm"><span className="block text-[11px] font-black uppercase text-slate-500">Prime BCM</span><span className="cursor-help font-black underline decoration-dotted" title={outputVarianceFormula(books, targets)}>{formatQty(books.bcm)} vs {formatQty(books.bcmTarget)} · {formatSigned(books.bcmVariance)} BCM{showMoney ? ` · ${formatAud(books.bcmDollars)}` : ''}</span></p>
          <p className="text-sm"><span className="block text-[11px] font-black uppercase text-slate-500">Output variance</span><span className="cursor-help font-black underline decoration-dotted" title={outputVarianceFormula(books, targets)}>{showMoney ? formatAud(books.outputVariance) : `${formatSigned(books.tonneVariance)} t · ${formatSigned(books.bcmVariance)} BCM`}</span></p>
        </div>
      )}
    </section>
  );
}

function ManningTable({ rows, targets, showMoney }: { rows: ManagementSnapshot['manning']; targets: SiteTargets; showMoney: boolean }) {
  return (
    <section className="rounded-xl border border-slate-300 bg-white overflow-x-auto">
      <h2 className="px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-800">Crew comparison · A–D</h2>
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] font-black uppercase text-slate-500">
          <tr>
            {['Crew', 'Side', 'Permanent on roster', 'Away / leave', 'Overtime cover', 'Contractors', 'Contractor/OT %', 'Unallocated personnel', showMoney ? 'Shift labour spend ($)' : 'Shift labour'].map((heading) => (
              <th key={heading} className="px-3 py-2">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const side = row.department === 'workshop' ? 'workshop' : 'production';
            const spend = shiftLabour(side, row.overtime, row.contractors, targets);
            const formula = labourFormula(side, row.overtime, row.contractors, targets);
            return (
              <tr key={`${row.letter}-${row.department}`} className={`border-t border-slate-100 ${row.unallocated > 0 ? 'bg-amber-50' : ''}`}>
                <td className="px-3 py-2 font-black">{row.letter}</td>
                <td className="px-3 py-2">{row.department === 'production' ? 'Production' : 'Workshop'}</td>
                <td className="px-3 py-2">{row.permanent}</td>
                <td className="px-3 py-2">{row.away}</td>
                <td className="px-3 py-2">{row.overtime}</td>
                <td className="px-3 py-2">{row.contractors}</td>
                <td className="px-3 py-2 font-black">{row.reliancePct}%</td>
                <td className="px-3 py-2">{row.unallocated}</td>
                <td className="cursor-help px-3 py-2 font-black underline decoration-dotted" title={formula}>{showMoney ? formatAud(spend) : `${row.overtime} OT · ${row.contractors} contractors`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function CompetencyMatrix({ rows, letter, targets, showMoney, unmannedModels, horizon }: { rows: ModelGap[]; letter: CrewLetter; targets: SiteTargets; showMoney: boolean; unmannedModels: Map<string, number>; horizon: { hours: number; label: string } }) {
  return (
    <section className="rounded-xl border border-slate-300 bg-white overflow-x-auto">
      <h2 className="px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-800">Training shortfalls · {letter} Crew</h2>
      {rows.length === 0 ? <p className="px-4 pb-4 text-sm text-slate-500">No shortfall or missing crib relief on this crew.</p> : (
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] font-black uppercase text-slate-500">
          <tr>
            {['Model', 'Fleet total', 'Healthy', 'A', 'B', 'C', 'D', 'In training', 'Gap', showMoney ? `Est. exposure (${horizon.label})` : 'Lost machine hours'].map((heading) => (
              <th key={heading} className="px-3 py-2">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const parked = unmannedModels.get(row.model) ?? 0;
            const digHaul = row.risk === 'SHORTFALL' && primaryClass({ make_model: row.model });
            const exposure = digHaul ? modelForwardExposure(row.model, parked, targets, horizon.hours) : 0;
            const rate = primaryClass({ make_model: row.model }) === 'digger' ? targets.primary_digger_hr_cost : targets.primary_truck_hr_cost;
            const exposureFormula = digHaul
              ? `${parked} unmanned ${row.model} × ${formatAudExact(rate)} × ${horizon.hours} (${horizon.label}) = ${formatAudExact(exposure)}. Already inside Forward Shift Exposure. A crewed unit with a ticket gap is not priced again.`
              : 'Not a primary digger or truck, so no fleet-hour price is applied.';
            return (
              <tr key={row.model} className="border-t border-slate-100">
                <td className="px-3 py-2 font-black">{row.model}</td>
                <td className="px-3 py-2">{row.total}</td>
                <td className="px-3 py-2">{row.healthy}</td>
                {CREW_LETTERS.map((item) => <td key={item} className={`px-3 py-2 ${item === letter ? 'font-black' : ''}`}>{row.ticketed[item]}</td>)}
                <td className="px-3 py-2">{row.inTraining}</td>
                <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${RISK_CLASS[row.risk]}`}>{row.risk}</span></td>
                <td className="cursor-help px-3 py-2 font-black underline decoration-dotted" title={exposureFormula}>{digHaul && parked > 0 ? (showMoney ? formatAud(exposure) : `${Math.round(parked * horizon.hours)} h`) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      )}
    </section>
  );
}

function HoldCard({ snapshot }: { snapshot: ManagementSnapshot }) {
  const lines = [
    ['P1', snapshot.priority.P1],
    ['P2', snapshot.priority.P2],
    ['P3', snapshot.priority.P3],
    ['P4', snapshot.priority.P4],
    ['OVERDUE ETUs', snapshot.overdueEtus],
    ['Waiting on Parts', snapshot.holds.parts],
    ['Waiting on OEM', snapshot.holds.oem],
    ['Waiting on Bay / Crane', snapshot.holds.bay],
  ] as const;
  const open = lines.filter(([, count]) => count > 0);
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Down fleet and holds</h2>
      {open.length === 0 ? <p className="mt-3 text-sm text-slate-500">No priority or hold exceptions.</p> : (
      <ul className="mt-3 space-y-2">
        {open.map(([label, count]) => (
          <li key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold text-slate-700">{label}</span>
            <span className={`font-black ${label === 'OVERDUE ETUs' || label.startsWith('Waiting') || label === 'P1' ? 'text-rose-700' : 'text-slate-900'}`}>{count}</span>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}

function StatutoryCard({ statutory }: { statutory: ReturnType<typeof statutoryRollup> | null }) {
  if (!statutory) return <section className="rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-500">Loading the latest statutory record…</section>;
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Statutory exceptions</h2>
      {statutory.oce === 'Completed & Uploaded' && statutory.tarps.length === 0 && statutory.openIncidents === 0 ? (
        <p className="text-sm text-slate-500">No open statutory exceptions.</p>
      ) : (
        <>
          {statutory.oce !== 'Completed & Uploaded' && <p className="text-sm"><span className="font-black">OCE report:</span> {statutory.oce}</p>}
          {statutory.tarps.length > 0 && <p className="text-sm"><span className="font-black">Active TARPs:</span> {statutory.tarps.join(', ')}</p>}
          {statutory.openIncidents > 0 && <p className="text-sm"><span className="font-black">Open incidents / HPIs:</span> {statutory.openIncidents} open{statutory.hpi > 0 ? ` · ${statutory.hpi} HPI` : ''}</p>}
        </>
      )}
    </section>
  );
}

function formatQty(value: number) {
  return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 }).format(value);
}

function formatSigned(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatQty(value)}`;
}
