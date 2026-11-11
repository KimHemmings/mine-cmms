'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Asset,
  Authorisation,
  CrewAuthorisation,
  CrewMember,
  MachineWorkOrder,
  CrewSupervision,
  OperatorPassout,
  PRODUCTION_PLANT,
  STAGE_OPTIONS,
  ShiftMachineOperator,
  ShiftRecord,
  authorisationState,
  personLight,
} from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { generatePrestartPptx } from '@/utils/prestartPptx';
import { siteCover, supervisionFor } from '@/utils/crewStanding';
import { CrewMarks, SiteCoverList } from '@/components/training/CrewMarks';
import { AuthLight, PersonAuthorisationsDialog } from '@/components/training/PersonAuthorisations';
import { useFeedback } from '@/components/ui/FeedbackProvider';

const STATE_WORD = { current: 'Current', due: 'Due soon', expired: 'Expired', not_held: 'Not passed out' };

export default function ProductionStatus({
  activeShift,
  machines,
  workOrders,
  crew,
  authorisations,
  holdings,
  passouts,
  allocations,
  supervision,
  onChanged,
}: {
  activeShift: ShiftRecord | null;
  machines: Asset[];
  workOrders: MachineWorkOrder[];
  crew: CrewMember[];
  authorisations: Authorisation[];
  holdings: CrewAuthorisation[];
  passouts: OperatorPassout[];
  allocations: ShiftMachineOperator[];
  supervision: CrewSupervision[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useFeedback();
  const [exporting, setExporting] = useState(false);
  const [showCrewed, setShowCrewed] = useState(false);
  const [openPerson, setOpenPerson] = useState<CrewMember | null>(null);
  const operators = crew.filter((member) => member.active && member.department === 'Production');
  const onCrew = operators.filter((member) => !activeShift?.crew || member.panel === activeShift.crew);
  const cover = siteCover(onCrew, supervision, authorisations, holdings, crew);
  const plant = machines.filter((asset) => (PRODUCTION_PLANT as readonly string[]).includes(asset.asset_type));
  const available = plant.filter((asset) => asset.status === 'OPERATIONAL' && !asset.in_shift);
  const unavailable = plant.filter((asset) => asset.in_shift && asset.status !== 'OPERATIONAL');
  const shiftAllocations = allocations.filter((row) => row.shift_id === activeShift?.id);

  const passoutFor = (memberId: string, assetId: string) =>
    passouts.find((row) => row.crew_member_id === memberId && row.asset_id === assetId) ?? null;

  const suitableFor = (assetId: string) =>
    operators.filter((member) => {
      const held = passoutFor(member.id, assetId);
      const state = authorisationState(held?.expires_on ?? null);
      return state === 'current' || state === 'due';
    });

  const staleAuthorisations = useMemo(() => {
    const rows: { personId: string; person: string; item: string; expires: string; state: string }[] = [];
    for (const member of operators) {
      for (const item of authorisations) {
        const expires = holdings.find((row) => row.crew_member_id === member.id && row.authorisation_id === item.id)?.expires_on ?? null;
        const state = authorisationState(expires);
        if (state === 'due' || state === 'expired') {
          rows.push({ personId: member.id, person: member.display_name, item: item.name, expires: expires?.slice(0, 10) ?? '', state: STATE_WORD[state] });
        }
      }
    }
    return rows;
  }, [operators, authorisations, holdings]);

  const stalePassouts = passouts.flatMap((row) => {
    const state = authorisationState(row.expires_on);
    if (state !== 'due' && state !== 'expired') return [];
    const person = crew.find((member) => member.id === row.crew_member_id);
    const asset = machines.find((item) => item.id === row.asset_id);
    if (!person || person.department !== 'Production') return [];
    return [{ personId: person.id, person: person.display_name, fleetId: asset?.fleet_id ?? 'Machine', expires: row.expires_on.slice(0, 10), state: STATE_WORD[state] }];
  });

  async function allocate(assetId: string, crewMemberId: string) {
    if (!activeShift) return;
    if (crewMemberId && !suitableFor(assetId).some((member) => member.id === crewMemberId)) {
      showToast({ message: 'Training has not passed that operator out on this machine.', tone: 'error' });
      return;
    }
    const query = crewMemberId
      ? supabase.from('shift_machine_operators').upsert(
          { shift_id: activeShift.id, asset_id: assetId, crew_member_id: crewMemberId },
          { onConflict: 'shift_id,asset_id' },
        )
      : supabase.from('shift_machine_operators').delete().eq('shift_id', activeShift.id).eq('asset_id', assetId);
    const { error } = await query;
    if (error) {
      showToast({ message: 'Could not save that operator.', tone: 'error' });
      return;
    }
    onChanged();
  }

  async function downloadPrestart() {
    setExporting(true);
    try {
      await generatePrestartPptx({
        shiftName: activeShift?.shift_name ?? 'Shift',
        shiftDate: activeShift?.shift_date ?? null,
        allocations: available.flatMap((asset) => {
          const row = shiftAllocations.find((item) => item.asset_id === asset.id);
          const person = operators.find((member) => member.id === row?.crew_member_id);
          if (!person) return [];
          const held = passoutFor(person.id, asset.id);
          return [{
            fleetId: asset.fleet_id,
            machine: asset.make_model,
            operator: person.display_name,
            passout: STATE_WORD[authorisationState(held?.expires_on ?? null)],
          }];
        }),
        unallocated: available.flatMap((asset) => {
          if (shiftAllocations.some((row) => row.asset_id === asset.id)) return [];
          const suitable = suitableFor(asset.id);
          return [{
            fleetId: asset.fleet_id,
            machine: asset.make_model,
            reason: suitable.length === 0 ? 'No one is currently passed out on this unit' : 'Not allocated yet',
          }];
        }),
        unavailable: unavailable.map((asset) => ({
          fleetId: asset.fleet_id,
          where: asset.location || 'Workshop',
          expected: formatDateTime(asset.expected_up),
        })),
        staleAuthorisations,
        stalePassouts,
      });
    } finally {
      setExporting(false);
    }
  }

  const onCrewIds = new Set(onCrew.map((member) => member.id));
  const allocatedIds = new Set(shiftAllocations.map((row) => row.asset_id));
  const crewed = available.filter((asset) => allocatedIds.has(asset.id));
  const openMachines = available.filter((asset) => !allocatedIds.has(asset.id));
  const noPassout = openMachines.filter((asset) => suitableFor(asset.id).length === 0);
  const needsOperator = openMachines.filter((asset) => suitableFor(asset.id).length > 0);
  const dueHereAuth = staleAuthorisations.filter((row) => onCrewIds.has(row.personId));
  const dueHerePassouts = stalePassouts.filter((row) => onCrewIds.has(row.personId));
  const dueElsewhere = (staleAuthorisations.length - dueHereAuth.length) + (stalePassouts.length - dueHerePassouts.length);

  const shiftLabel = activeShift
    ? `${activeShift.shift_name}${activeShift.crew ? ` · ${activeShift.crew}` : ''}`
    : 'No active shift';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">Who is on each machine</h2>
          <p className="text-sm text-slate-600 mt-1">{shiftLabel}. Only an operator training has passed out on that machine can be allocated.</p>
        </div>
        <button
          type="button"
          onClick={() => void downloadPrestart()}
          disabled={exporting}
          className="min-h-11 px-4 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-bold disabled:opacity-50"
        >
          {exporting ? 'Building...' : 'Prestart PowerPoint'}
        </button>
      </div>

      <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-2">
        <h3 className="text-lg font-black text-slate-900">Operators on this crew</h3>
        <p className="text-sm text-slate-600">Tap a name to see current tickets and anything due or expired.</p>
        {onCrew.length === 0 ? (
          <p className="text-sm text-slate-500">No production operators are on this crew.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {onCrew.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => setOpenPerson(member)}
                  className="min-h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-900 inline-flex items-center gap-2 hover:border-slate-500"
                >
                  {member.display_name}
                  <AuthLight light={personLight(holdings.filter((row) => row.crew_member_id === member.id).map((row) => row.expires_on))} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SiteCoverList {...cover} onOpen={(name) => {
        const person = crew.find((member) => member.display_name === name);
        if (person) setOpenPerson(person);
      }} />

      <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Still in the workshop</h3>
        {unavailable.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No production machines are down on this shift.</p>
        ) : (
          <table className="mt-3 w-full text-sm text-left">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="py-1 pr-3 font-bold">Unit</th>
                <th className="py-1 pr-3 font-bold">Job</th>
                <th className="py-1 pr-3 font-bold">Stage</th>
                <th className="py-1 font-bold">Expected back</th>
              </tr>
            </thead>
            <tbody>
              {unavailable.map((asset) => {
                const openJobs = workOrders.filter((order) => order.asset_id === asset.id && order.status !== 'COMPLETED');
                const main = openJobs.find((order) => order.is_main_event) ?? openJobs[0];
                const stage = STAGE_OPTIONS.find((option) => option.value === main?.stage)?.label;
                return (
                  <tr key={asset.id} className="border-t border-slate-200">
                    <td className="py-2 pr-3 font-bold">{asset.fleet_id}<span className="block text-xs font-medium text-slate-500">{asset.make_model}</span></td>
                    <td className="py-2 pr-3">{main?.task_description || 'No open job'}</td>
                    <td className="py-2 pr-3">{stage || 'No open job'}</td>
                    <td className="py-2">{formatDateTime(asset.expected_up)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
        <h3 className="text-lg font-black text-slate-900">Needs an operator</h3>
        <p className="text-sm text-slate-600">Someone whose pass-out is missing or expired is not in the list. Training sets those dates.</p>
        {operators.length === 0 ? (
          <p className="text-sm text-slate-500">No one is in the Production department yet. Set that on the person in Crew.</p>
        ) : needsOperator.length === 0 && noPassout.length === 0 ? (
          <p className="text-sm text-slate-500">Every available machine has an operator.</p>
        ) : (
          <AllocationTable
            assets={[...noPassout, ...needsOperator]}
            shiftAllocations={shiftAllocations}
            operators={operators}
            suitableFor={suitableFor}
            passoutFor={passoutFor}
            supervision={supervision}
            crew={crew}
            activeShift={activeShift}
            allocate={allocate}
            onOpen={setOpenPerson}
          />
        )}
      </section>

      <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
        <h3 className="text-lg font-black text-slate-900">Due on this crew</h3>
        <p className="text-sm text-slate-600">
          Authorisations and machine pass-outs for {activeShift?.crew || 'this crew'} that are due within 30 days or already expired.
          {dueElsewhere > 0 ? ` ${dueElsewhere} on other crews.` : ''}
        </p>
        {dueHereAuth.length === 0 && dueHerePassouts.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing is due or expired on this crew.</p>
        ) : (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
            {dueHereAuth.map((row) => (
              <li key={`${row.personId}-${row.item}`} className="px-3 py-2 flex justify-between gap-3 text-sm">
                <button type="button" onClick={() => {
                  const person = crew.find((member) => member.id === row.personId);
                  if (person) setOpenPerson(person);
                }} className="font-bold text-left hover:underline">
                  {row.person}<span className="block font-medium text-slate-500">{row.item}</span>
                </button>
                <span className={row.state === 'Expired' ? 'text-rose-700 font-black' : 'text-amber-700 font-black'}>{row.state} {row.expires}</span>
              </li>
            ))}
            {dueHerePassouts.map((row) => (
              <li key={`${row.personId}-${row.fleetId}`} className="px-3 py-2 flex justify-between gap-3 text-sm">
                <button type="button" onClick={() => {
                  const person = crew.find((member) => member.id === row.personId);
                  if (person) setOpenPerson(person);
                }} className="font-bold text-left hover:underline">
                  {row.person}<span className="block font-medium text-slate-500">{row.fleetId} pass-out</span>
                </button>
                <span className={row.state === 'Expired' ? 'text-rose-700 font-black' : 'text-amber-700 font-black'}>{row.state} {row.expires}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-slate-900">Already crewed ({crewed.length})</h3>
          {crewed.length > 0 && (
            <button type="button" onClick={() => setShowCrewed((open) => !open)} className="min-h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-700">
              {showCrewed ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
        {showCrewed && crewed.length > 0 && (
          <AllocationTable
            assets={crewed}
            shiftAllocations={shiftAllocations}
            operators={operators}
            suitableFor={suitableFor}
            passoutFor={passoutFor}
            supervision={supervision}
            crew={crew}
            activeShift={activeShift}
            allocate={allocate}
            onOpen={setOpenPerson}
          />
        )}
      </section>
      {openPerson && (
        <PersonAuthorisationsDialog
          person={openPerson}
          authorisations={authorisations}
          holdings={holdings}
          supervision={supervision}
          crew={crew}
          onClose={() => setOpenPerson(null)}
        />
      )}
    </div>
  );
}

function AllocationTable({
  assets,
  shiftAllocations,
  operators,
  suitableFor,
  passoutFor,
  supervision,
  crew,
  activeShift,
  allocate,
  onOpen,
}: {
  assets: Asset[];
  shiftAllocations: ShiftMachineOperator[];
  operators: CrewMember[];
  suitableFor: (assetId: string) => CrewMember[];
  passoutFor: (memberId: string, assetId: string) => OperatorPassout | null;
  supervision: CrewSupervision[];
  crew: CrewMember[];
  activeShift: ShiftRecord | null;
  allocate: (assetId: string, crewMemberId: string) => void;
  onOpen: (person: CrewMember) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-xs uppercase text-slate-500">
            <th className="py-1 pr-3 font-bold">Unit</th>
            <th className="py-1 font-bold">Operator</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const current = shiftAllocations.find((row) => row.asset_id === asset.id);
            const suitable = suitableFor(asset.id);
            const chosen = operators.find((member) => member.id === current?.crew_member_id);
            const chosenIsSuitable = !!chosen && suitable.some((member) => member.id === chosen.id);
            const trainees = suitable.filter((member) => supervisionFor(member.id, supervision));
            return (
              <tr key={asset.id} className="border-t border-slate-200">
                <td className="py-2 pr-3 font-bold whitespace-nowrap align-top">
                  {asset.fleet_id}
                  <span className="block text-xs font-medium text-slate-500">{asset.make_model}</span>
                  {trainees.length > 0 && (
                    <span className="mt-1 flex flex-col gap-1">
                      {trainees.map((member) => (
                        <span key={member.id} className="flex flex-wrap items-center gap-1 text-xs font-medium text-slate-600">
                          <button type="button" onClick={() => onOpen(member)} className="font-bold underline decoration-slate-300 hover:decoration-slate-900">{member.display_name}</button>
                          <CrewMarks person={member} supervision={supervision} authorisations={[]} holdings={[]} />
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <select
                    value={chosenIsSuitable ? chosen.id : ''}
                    onChange={(event) => allocate(asset.id, event.target.value)}
                    disabled={!activeShift}
                    className="min-h-11 w-full max-w-md rounded-lg border-2 border-slate-300 bg-white px-3 text-sm font-bold"
                  >
                    <option value="">{suitable.length === 0 ? 'No one is passed out on this unit' : 'Choose an operator'}</option>
                    {suitable.map((member) => {
                      const state = authorisationState(passoutFor(member.id, asset.id)?.expires_on ?? null);
                      const training = supervisionFor(member.id, supervision);
                      const level = training?.level === 'close' ? ' · close supervision' : training?.level === 'minimal' ? ' · minimal supervision' : '';
                      return (
                        <option key={member.id} value={member.id}>
                          {member.display_name}{state === 'due' ? ' · due soon' : ''}{level}
                        </option>
                      );
                    })}
                  </select>
                  {chosen && (
                    <p className="mt-1 text-xs font-bold text-slate-700">
                      <button type="button" onClick={() => onOpen(chosen)} className="underline decoration-slate-300 hover:decoration-slate-900">{chosen.display_name}</button>
                      {supervisionFor(chosen.id, supervision) && (
                        <>
                          {' · '}{supervisionFor(chosen.id, supervision)?.level === 'close' ? 'Close supervision' : 'Minimal supervision'}
                          {' for '}{supervisionFor(chosen.id, supervision)?.skill}
                          {'. Assessor '}
                          {(() => {
                            const assessor = crew.find((member) => member.id === supervisionFor(chosen.id, supervision)?.assessor_id);
                            return assessor
                              ? <button type="button" onClick={() => onOpen(assessor)} className="underline decoration-slate-300 hover:decoration-slate-900">{assessor.display_name}</button>
                              : 'not named';
                          })()}
                        </>
                      )}
                    </p>
                  )}
                  {chosen && !chosenIsSuitable && (
                    <p className="mt-1 text-xs font-bold text-rose-700">
                      {chosen.display_name} is on this machine, but their pass-out is not current.
                      <button type="button" onClick={() => allocate(asset.id, '')} className="ml-2 underline">Take them off</button>
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
