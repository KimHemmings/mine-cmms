'use client';

import { useState } from 'react';
import { Asset, Authorisation, CrewAuthorisation, CrewMember, MachineWorkOrder, STAGE_OPTIONS, personLight } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { AuthLight, PersonAuthorisationsDialog } from '@/components/training/PersonAuthorisations';

export default function ProductionStatus({
  activeShiftName,
  machines,
  workOrders,
  crew,
  onShiftIds,
  authorisations,
  holdings,
}: {
  activeShiftName: string;
  machines: Asset[];
  workOrders: MachineWorkOrder[];
  crew: CrewMember[];
  onShiftIds: Set<string>;
  authorisations: Authorisation[];
  holdings: CrewAuthorisation[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const down = machines.filter((asset) => asset.in_shift && asset.status !== 'OPERATIONAL');
  const onShift = crew.filter((member) => member.active && onShiftIds.has(member.id));
  const openPerson = crew.find((member) => member.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Workshop status</h2>
        <p className="text-sm text-slate-600 mt-1">{activeShiftName}. Machines still in the workshop, and the crew on shift.</p>
        {down.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No machines are down on this shift.</p>
        ) : (
          <table className="mt-3 w-full text-sm text-left">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="py-1 pr-3 font-bold">Unit</th>
                <th className="py-1 pr-3 font-bold">Job</th>
                <th className="py-1 pr-3 font-bold">Stage</th>
                <th className="py-1 pr-3 font-bold">Where</th>
                <th className="py-1 font-bold">Expected back</th>
              </tr>
            </thead>
            <tbody>
              {down.map((asset) => {
                const openJobs = workOrders.filter((order) => order.asset_id === asset.id && order.status !== 'COMPLETED');
                const main = openJobs.find((order) => order.is_main_event) ?? openJobs[0];
                const stage = STAGE_OPTIONS.find((option) => option.value === main?.stage)?.label ?? 'No open job';
                return (
                  <tr key={asset.id} className="border-t border-slate-200">
                    <td className="py-2 pr-3 font-bold">{asset.fleet_id}<span className="block text-xs font-medium text-slate-500">{asset.make_model}</span></td>
                    <td className="py-2 pr-3">
                      {main?.task_description || 'No open job'}
                      {openJobs.length > 1 && <span className="block text-xs text-slate-500">+ {openJobs.length - 1} more</span>}
                    </td>
                    <td className="py-2 pr-3">{main ? stage : 'No open job'}</td>
                    <td className="py-2 pr-3">{asset.location || 'Workshop'}</td>
                    <td className="py-2">{formatDateTime(asset.expected_up)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">Crew on shift ({onShift.length})</h2>
        <p className="text-sm text-slate-600 mt-1">A light means an authorisation is due soon or expired. Open a person to see which ones they hold.</p>
        {onShift.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No one is marked on shift.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 border border-slate-200 rounded-xl">
            {onShift.map((member) => {
              const dates = holdings.filter((row) => row.crew_member_id === member.id).map((row) => row.expires_on);
              return (
                <li key={member.id}>
                  <button type="button" onClick={() => setOpenId(member.id)} className="w-full min-h-12 px-3 py-2 flex items-center justify-between gap-3 text-left hover:bg-slate-50">
                    <span>
                      <span className="block text-sm font-bold text-slate-900">{member.display_name}</span>
                      <span className="text-xs text-slate-500">{member.trade}{member.panel ? ` · ${member.panel}` : ''}</span>
                    </span>
                    <AuthLight light={personLight(dates)} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {openPerson && (
        <PersonAuthorisationsDialog
          person={openPerson}
          authorisations={authorisations}
          holdings={holdings}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
