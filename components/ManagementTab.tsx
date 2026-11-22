'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Asset, CrewMember, MachineWorkOrder, ShiftRecord } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { CREW_LETTERS, ManagementSnapshot, ModelGap, buildManagementSnapshot, statutoryRollup } from '@/utils/managementGaps';
import { HandoverCheckRow, recordFromRow, shiftRank } from '@/utils/productionHandoverRecord';
import { CrewLetter, crewLetter } from '@/utils/shiftRoster';

type CrewChoice = 'active' | CrewLetter;

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
}: {
  assets: Asset[];
  crew: CrewMember[];
  workOrders: MachineWorkOrder[];
  activeShift: ShiftRecord | null;
  downAssetIds: string[];
}) {
  const activeLetter = crewLetter(activeShift?.crew) ?? 'A';
  const [choice, setChoice] = useState<CrewChoice>('active');
  const [statutory, setStatutory] = useState<ReturnType<typeof statutoryRollup> | null>(null);
  const letter = choice === 'active' ? activeLetter : choice;
  const crewLabel = choice === 'active' ? `Active shift · ${activeShift?.crew || `${activeLetter} Crew`}` : `${letter} Crew`;
  const snapshot = useMemo(
    () => buildManagementSnapshot(assets, crew, workOrders, letter, downAssetIds),
    [assets, crew, workOrders, letter, downAssetIds],
  );

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from('production_handover_checks')
      .select('*')
      .order('shift_date', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        const rows = data ?? [];
        const latest = [...rows].sort((a, b) => shiftRank(b.shift_date, b.shift_name).localeCompare(shiftRank(a.shift_date, a.shift_name)))[0];
        setStatutory(statutoryRollup(latest ? recordFromRow(latest as HandoverCheckRow) : null));
      });
  }, []);

  const print = async () => {
    const { generateManagementSummary } = await import('@/utils/managementSummaryPdf');
    generateManagementSummary(snapshot, crewLabel);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Crew comparison">
          <FilterChip active={choice === 'active'} onClick={() => setChoice('active')}>Active Shift Crew</FilterChip>
          {CREW_LETTERS.map((item) => (
            <FilterChip key={item} active={choice === item} onClick={() => setChoice(item)}>{item}</FilterChip>
          ))}
        </div>
        <button type="button" onClick={() => void print()} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2">
          <Printer className="w-4 h-4" /> Print Management Summary (PDF)
        </button>
      </div>

      <KpiStrip snapshot={snapshot} statutory={statutory} />
      <ManningTable snapshot={snapshot} />
      <CompetencyMatrix snapshot={snapshot} letter={letter} />
      <div className="grid gap-4 lg:grid-cols-2">
        <HoldCard snapshot={snapshot} />
        <StatutoryCard statutory={statutory} />
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`min-h-10 px-3 rounded-full border text-sm font-black ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
      {children}
    </button>
  );
}

function KpiStrip({ snapshot, statutory }: { snapshot: ManagementSnapshot; statutory: ReturnType<typeof statutoryRollup> | null }) {
  const cards = [
    {
      title: 'Fleet physical availability',
      value: `${snapshot.availabilityPct}%`,
      detail: `${snapshot.ready} Ready / ${snapshot.total} Total · ${snapshot.down} Down`,
      tone: 'bg-slate-900 text-white',
    },
    {
      title: 'Active shift manning gap',
      value: `${snapshot.unmanned} Ready Units Unallocated`,
      detail: `${snapshot.ticketedOperators} ticketed operators for ${snapshot.healthy} healthy units · OT/contractor ${snapshot.productionReliancePct}% production, ${snapshot.workshopReliancePct}% workshop`,
      tone: snapshot.unmanned > 0 ? 'bg-amber-500 text-amber-950' : 'bg-emerald-800 text-white',
    },
    {
      title: 'Training bottleneck alerts',
      value: `${snapshot.shortModels + snapshot.noCribModels} models`,
      detail: `${snapshot.shortModels} short of healthy units · ${snapshot.noCribModels} with no crib relief · ${snapshot.zeroTickets} operators with 0 tickets`,
      tone: snapshot.shortModels > 0 ? 'bg-rose-800 text-white' : 'bg-slate-800 text-white',
    },
    {
      title: 'Statutory and workshop risk',
      value: `${snapshot.overdueEtus} OVERDUE ETUs`,
      detail: statutory
        ? `${statutory.tarps.length} active TARPs · ${statutory.openIncidents} open investigations · ${statutory.hpi} HPI`
        : 'Loading TARPs and open investigations',
      tone: snapshot.overdueEtus > 0 ? 'bg-rose-700 text-white' : 'bg-slate-800 text-white',
    },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.title} className={`rounded-xl p-4 ${card.tone}`}>
          <p className="text-[11px] font-black uppercase tracking-wide opacity-80">{card.title}</p>
          <p className="mt-2 text-2xl font-black leading-tight">{card.value}</p>
          <p className="mt-2 text-sm font-bold opacity-90">{card.detail}</p>
        </article>
      ))}
    </div>
  );
}

function ManningTable({ snapshot }: { snapshot: ManagementSnapshot }) {
  return (
    <section className="rounded-xl border border-slate-300 bg-white overflow-x-auto">
      <h2 className="px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-800">Manning and labour reliance</h2>
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] font-black uppercase text-slate-500">
          <tr>
            {['Crew', 'Side', 'Permanent on roster', 'Away / leave', 'Overtime cover', 'Contractors', 'Contractor/OT %', 'Unallocated personnel'].map((heading) => (
              <th key={heading} className="px-3 py-2">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshot.manning.map((row) => (
            <tr key={`${row.letter}-${row.department}`} className="border-t border-slate-100">
              <td className="px-3 py-2 font-black">{row.letter}</td>
              <td className="px-3 py-2">{row.department === 'production' ? 'Production' : 'Workshop'}</td>
              <td className="px-3 py-2">{row.permanent}</td>
              <td className="px-3 py-2">{row.away}</td>
              <td className="px-3 py-2">{row.overtime}</td>
              <td className="px-3 py-2">{row.contractors}</td>
              <td className="px-3 py-2 font-black">{row.reliancePct}%</td>
              <td className="px-3 py-2">{row.unallocated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CompetencyMatrix({ snapshot, letter }: { snapshot: ManagementSnapshot; letter: CrewLetter }) {
  return (
    <section className="rounded-xl border border-slate-300 bg-white overflow-x-auto">
      <h2 className="px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-800">Training and competency gap · {letter} Crew</h2>
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] font-black uppercase text-slate-500">
          <tr>
            {['Model', 'Fleet total', 'Healthy', 'A', 'B', 'C', 'D', 'In training', 'Gap'].map((heading) => (
              <th key={heading} className="px-3 py-2">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshot.models.length === 0 ? (
            <tr><td colSpan={9} className="px-3 py-4 text-slate-500">No operator equipment is on the fleet.</td></tr>
          ) : snapshot.models.map((row) => (
            <tr key={row.model} className="border-t border-slate-100">
              <td className="px-3 py-2 font-black">{row.model}</td>
              <td className="px-3 py-2">{row.total}</td>
              <td className="px-3 py-2">{row.healthy}</td>
              {CREW_LETTERS.map((item) => <td key={item} className={`px-3 py-2 ${item === letter ? 'font-black' : ''}`}>{row.ticketed[item]}</td>)}
              <td className="px-3 py-2">{row.inTraining}</td>
              <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${RISK_CLASS[row.risk]}`}>{row.risk}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
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
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Down fleet and hold breakdown</h2>
      <ul className="mt-3 space-y-2">
        {lines.map(([label, count]) => (
          <li key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold text-slate-700">{label}</span>
            <span className={`font-black ${count > 0 && (label === 'OVERDUE ETUs' || label.startsWith('Waiting') || label === 'P1') ? 'text-rose-700' : 'text-slate-900'}`}>{count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatutoryCard({ statutory }: { statutory: ReturnType<typeof statutoryRollup> | null }) {
  if (!statutory) return <section className="rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-500">Loading the latest statutory record…</section>;
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Latest statutory and production summary</h2>
      <p className="text-sm"><span className="font-black">OCE report:</span> {statutory.oce}</p>
      <p className="text-sm"><span className="font-black">Active TARPs:</span> {statutory.tarps.length === 0 ? 'None' : statutory.tarps.join(', ')}</p>
      <p className="text-sm"><span className="font-black">Open incidents / HPIs:</span> {statutory.openIncidents} open{statutory.hpi > 0 ? ` · ${statutory.hpi} HPI` : ''}</p>
      <p className="text-sm"><span className="font-black">ROM coal tonnes:</span> {statutory.rom}</p>
      <p className="text-sm"><span className="font-black">Prime BCMs:</span> {statutory.bcm}</p>
    </section>
  );
}
