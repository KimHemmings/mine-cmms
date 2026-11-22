'use client';

import { ManagementSnapshot } from '@/utils/managementGaps';
import { SiteTargets, formatAud, formatAudExact, labourFormula, outputVarianceFormula } from '@/utils/managementRates';

export interface ShiftBooks {
  mechanical: number;
  mechanicalHours: number;
  manning: number;
  manningHours: number;
  downDiggers: number;
  downTrucks: number;
  unmannedDiggers: number;
  unmannedTrucks: number;
  usePct: number;
  workshopShift: number;
  productionShift: number;
  workshopWeek: number;
  productionWeek: number;
  workshopOt: number;
  workshopContractors: number;
  productionOt: number;
  productionContractors: number;
  coalShifts: number;
  rom: number;
  romTarget: number;
  tonneVariance: number;
  saleable: number;
  saleableTarget: number;
  marginVariance: number;
  bcm: number;
  bcmTarget: number;
  bcmVariance: number;
  bcmDollars: number;
  outputVariance: number;
  forwardExposure: number;
  exposureHours: number;
  exposureLabel: string;
}

export default function AccountabilitySplit({
  snapshot,
  targets,
  books,
  showMoney,
}: {
  snapshot: ManagementSnapshot;
  targets: SiteTargets;
  books: ShiftBooks;
  showMoney: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Departmental Accountability Split</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-3 rounded-xl border-2 border-orange-500 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-orange-700">Workshop · Maintenance responsibility</p>
          <Metric label="Primary fleet physical availability" value={`${snapshot.availabilityPct}% actual vs ${targets.target_primary_pa_pct}% target`} formula="Ready primary units / total primary units. Not a dollar, so it is not added to labour or exposure." />
          <Metric label="Forward Shift Exposure · down units" value={showMoney ? formatAud(books.mechanical) : `${Math.round(books.mechanicalHours)} h`} formula={`${books.downDiggers} down diggers × ${formatAudExact(targets.primary_digger_hr_cost)} × ${books.exposureHours} + ${books.downTrucks} down trucks × ${formatAudExact(targets.primary_truck_hr_cost)} × ${books.exposureHours} = ${formatAudExact(books.mechanical)}. ${books.exposureLabel}. Primary dig and haul only. Down units are excluded from the unmanned count. Not added to ROM or BCM variance.`} />
          <Metric label="OVERDUE ETUs" value={String(snapshot.overdueEtus)} formula="Count of overdue ETUs. No dollar rate is applied." />
          <Metric label="Hold bottlenecks" value={`Parts ${snapshot.holds.parts} · OEM ${snapshot.holds.oem} · Bay ${snapshot.holds.bay}`} formula="Open hold counts. Not priced again on top of the down-unit exposure." />
          <Metric label="Hard cash labour" value={showMoney ? `${formatAud(books.workshopShift)} this shift · ${formatAud(books.workshopWeek)} across A–D` : `${books.workshopOt} OT · ${books.workshopContractors} contractors`} formula={`This shift: ${labourFormula('workshop', books.workshopOt, books.workshopContractors, targets)}. Across A–D ${formatAudExact(books.workshopWeek)}. Wages paid, not machine hours.`} />
        </article>
        <article className="space-y-3 rounded-xl border-2 border-emerald-600 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Production · Pit operations responsibility</p>
          <Metric label="Primary use of availability" value={`${books.usePct}% actual vs ${targets.target_primary_uoa_pct}% target`} formula="Manned healthy diggers and trucks / healthy diggers and trucks. A percent, not a second copy of the unmanned dollars." />
          <Metric label="Forward Shift Exposure · unmanned" value={showMoney ? `${books.unmannedDiggers + books.unmannedTrucks} units · ${formatAud(books.manning)}` : `${Math.round(books.manningHours)} h`} formula={`${books.unmannedDiggers} unmanned diggers × ${formatAudExact(targets.primary_digger_hr_cost)} × ${books.exposureHours} + ${books.unmannedTrucks} unmanned trucks × ${formatAudExact(targets.primary_truck_hr_cost)} × ${books.exposureHours} = ${formatAudExact(books.manning)}. ${books.exposureLabel}. Down units are not in this count. Not added to ROM or BCM variance.`} />
          <Metric label="Output variance · 7-day" value={books.coalShifts === 0 ? 'No pit actuals in the last 7 days.' : showMoney ? formatAud(books.outputVariance) : `${formatQty(books.tonneVariance)} t ROM · ${formatQty(books.bcmVariance)} BCM`} formula={outputVarianceFormula(books, targets)} />
          <Metric label="Hard cash labour" value={showMoney ? `${formatAud(books.productionShift)} this shift · ${formatAud(books.productionWeek)} across A–D` : `${books.productionOt} OT · ${books.productionContractors} contractors`} formula={`This shift: ${labourFormula('production', books.productionOt, books.productionContractors, targets)}. Across A–D ${formatAudExact(books.productionWeek)}. Wages paid, separate from unmanned machine hours.`} />
        </article>
      </div>
    </section>
  );
}

function Metric({ label, value, formula }: { label: string; value: string; formula: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="cursor-help text-sm font-black text-slate-900 underline decoration-dotted underline-offset-2" title={formula}>{value}</p>
    </div>
  );
}

function formatQty(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 }).format(value)}`;
}
