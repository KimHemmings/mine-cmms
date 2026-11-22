'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Clock, HardHat, Pencil, Printer, UserPlus, X } from 'lucide-react';
import { CREW_PANELS, CrewMember, CrewMemberInput, ShiftRecord, Asset, MachineWorkOrder } from '@/types';
import { Department, departmentLabel, normalizeDepartment } from '@/utils/permissions';
import { getShiftClock } from '@/utils/shiftClock';
import { AllocationChoice, allocatedUnitText, memberAssignments } from '@/utils/crewAllocation';
import { crewLetter, coveringLetter, rosterRoleNote, visibleOnCrewTab } from '@/utils/shiftRoster';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { useCrewData } from './CrewDataContext';
import CrewMemberForm from './CrewMemberForm';
import AllocationPill from './AllocationPill';
import OvertimeCrewModal from './OvertimeCrewModal';
import ContractorModal from './ContractorModal';

interface CrewTabProps {
  activeShift: ShiftRecord | null;
  canManageCrew: boolean;
  department: Department;
  saveCrewMember: (input: CrewMemberInput, id?: string) => Promise<boolean>;
  setCrewMemberActive: (member: CrewMember, active: boolean) => Promise<void>;
  setCrewMemberAway: (member: CrewMember, away: boolean) => Promise<void>;
  setCrewAllocation: (member: CrewMember, choice: AllocationChoice, workOrders: MachineWorkOrder[], assets: Asset[]) => Promise<void>;
  addOvertimeCover: (member: CrewMember, letter: string, shiftEndsAt: string) => Promise<boolean>;
  addContractor: (input: { name: string; company: string; trade: string; department: string; panel: string; shiftEndsAt: string }) => Promise<CrewMember | null>;
  endShiftExtra: (member: CrewMember, workOrders: MachineWorkOrder[]) => Promise<void>;
  clearExpiredShiftExtras: (members: CrewMember[]) => Promise<void>;
  assets: Asset[];
  workOrders: MachineWorkOrder[];
}

type CrewPanel = (typeof CREW_PANELS)[number];
type CrewFilter = CrewPanel | 'all';

const FILTERS: { id: CrewFilter; label: string }[] = [
  ...CREW_PANELS.map((panel) => ({ id: panel as CrewFilter, label: panel })),
  { id: 'all', label: 'All' },
];

function shiftCrew(crew: string | null | undefined): CrewPanel | null {
  return (CREW_PANELS as readonly string[]).includes(crew ?? '') ? (crew as CrewPanel) : null;
}

function accessPill(level: number) {
  if (level === 1) return 'L1 Read-Only';
  if (level === 3) return 'L3 Supervisor';
  return 'L2 Crew';
}

export default function CrewTab({
  activeShift,
  canManageCrew,
  department,
  saveCrewMember,
  setCrewMemberActive,
  setCrewMemberAway,
  setCrewAllocation,
  addOvertimeCover,
  addContractor,
  endShiftExtra,
  clearExpiredShiftExtras,
  assets,
  workOrders,
}: CrewTabProps) {
  const { crew } = useCrewData();
  const { confirm } = useFeedback();
  const onShiftPanel = shiftCrew(activeShift?.crew);
  const [selected, setSelected] = useState<CrewFilter>(onShiftPanel ?? 'all');
  const [editor, setEditor] = useState<CrewMember | 'new' | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [savingAllocation, setSavingAllocation] = useState<string | null>(null);
  const [showOvertime, setShowOvertime] = useState(false);
  const [showContractor, setShowContractor] = useState(false);

  const clearExpiredRef = useRef(clearExpiredShiftExtras);
  clearExpiredRef.current = clearExpiredShiftExtras;

  useEffect(() => {
    if (onShiftPanel) setSelected(onShiftPanel);
  }, [onShiftPanel]);

  useEffect(() => {
    void clearExpiredRef.current(crew);
  }, [crew]);

  const inDepartment = (member: CrewMember) => normalizeDepartment(member.department) === department;
  const departmentCrew = crew.filter((member) => inDepartment(member));
  const removedCrew = departmentCrew.filter((member) => !member.active && !member.is_contractor);
  const countFor = (panel: CrewFilter) => departmentCrew.filter((member) => visibleOnCrewTab(member, panel)).length;
  const shown = departmentCrew
    .filter((member) => visibleOnCrewTab(member, selected))
    .slice()
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const dueOnSheet = shown.filter((member) => !member.away);
  const onRoster = dueOnSheet;
  const unassigned = onRoster.filter((member) => !memberAssignments(member.id, workOrders, assets).length && !member.shift_duty).length;
  const printLabel = selected === 'all' ? 'Print Pre-Start Sheet (PDF)' : `Print ${selected} Pre-Start (PDF)`;
  const defaultPanel = selected === 'all' ? (onShiftPanel ?? 'A Crew') : selected;

  const printPreStart = async () => {
    const { generatePreStartSheet } = await import('@/utils/generatePreStartPDF');
    const clock = getShiftClock();
    generatePreStartSheet(
      dueOnSheet.map((member) => ({
        display_name: member.display_name,
        trade: member.trade,
        department: member.department,
        roleNote: rosterRoleNote(member),
        allocated: allocatedUnitText(member, workOrders, assets),
      })),
      {
        date: new Date(),
        shiftName: clock.shiftName,
        crew: selected === 'all' ? 'All crews' : selected,
      },
    );
  };

  const saveForDepartment = (input: CrewMemberInput, id?: string) =>
    saveCrewMember({ ...input, department }, id);

  const placeOnOvertime = async (member: CrewMember) => {
    const letter = crewLetter(selected);
    if (!letter) return;
    const ok = await addOvertimeCover(member, letter, getShiftClock().shiftEnd.toISOString());
    if (ok) setShowOvertime(false);
  };

  const placeContractor = async (input: { name: string; company: string; trade: string; allocation: AllocationChoice | null }) => {
    const panel = selected === 'all' ? (onShiftPanel ?? 'A Crew') : selected;
    const created = await addContractor({
      ...input,
      department,
      panel,
      shiftEndsAt: getShiftClock().shiftEnd.toISOString(),
    });
    if (!created) return;
    if (input.allocation) await setCrewAllocation(created, input.allocation, workOrders, assets);
    setShowContractor(false);
  };

  const assign = async (member: CrewMember, choice: AllocationChoice) => {
    setSavingAllocation(member.id);
    await setCrewAllocation(member, choice, workOrders, assets);
    setSavingAllocation(null);
  };

  const handleRemove = async (member: CrewMember) => {
    const ok = await confirm({
      title: `Remove ${member.display_name} from the crew list?`,
      message: 'They drop off this roster. Their past jobs keep their name. You can restore them later.',
      confirmLabel: 'Yes, remove',
      tone: 'danger',
    });
    if (!ok) return;
    await setCrewMemberActive(member, false);
    setEditor(null);
  };

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">{departmentLabel(department)} crew</h3>
            <p className="text-sm text-slate-500">People due on the selected crew. Away stays on the list and off the sign-on sheet.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditor('new')}
              className="min-h-11 px-4 rounded-lg border-2 border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Add Crew Member
            </button>
            {canManageCrew && selected !== 'all' && (
              <button
                type="button"
                onClick={() => setShowOvertime(true)}
                className="min-h-11 px-4 rounded-lg border-2 border-indigo-200 bg-indigo-50 text-sm font-bold text-indigo-800 hover:bg-indigo-100 flex items-center gap-2"
              >
                <Clock className="w-4 h-4" /> + Overtime Crew
              </button>
            )}
            {canManageCrew && (
              <button
                type="button"
                onClick={() => setShowContractor(true)}
                className="min-h-11 px-4 rounded-lg border-2 border-violet-200 bg-violet-50 text-sm font-bold text-violet-800 hover:bg-violet-100 flex items-center gap-2"
              >
                <HardHat className="w-4 h-4" /> + Contractor
              </button>
            )}
            {canManageCrew && (
              <button
                type="button"
                onClick={() => void printPreStart()}
                className="min-h-11 px-4 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-sm font-bold flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> {printLabel}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Crew">
          {FILTERS.map((filter) => {
            const active = selected === filter.id;
            const onShift = filter.id !== 'all' && filter.id === onShiftPanel;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelected(filter.id)}
                className={`min-h-11 px-3 rounded-full border-2 text-sm font-bold inline-flex items-center gap-2 ${
                  active
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'
                }`}
              >
                {filter.label}
                <span className={`min-w-6 px-1.5 rounded-full text-xs font-black text-center ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {countFor(filter.id)}
                </span>
                {onShift && (
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${active ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    On Shift
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-sm font-black text-slate-800">
          {onRoster.length} On Shift
          <span className="text-slate-300"> • </span>
          <span className={unassigned > 0 ? 'text-amber-700' : 'text-slate-800'}>{unassigned} Unassigned</span>
        </p>

        {shown.length === 0 ? (
          <p className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-300 text-sm text-slate-600">
            No one from {departmentLabel(department)} is on {selected === 'all' ? 'the roster' : selected}.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {shown.map((member) => {
              const covering = coveringLetter(member);
              const temporary = !!covering || member.is_contractor;
              return (
              <li key={member.id} className={`px-3 min-h-14 flex flex-wrap items-center gap-2 ${member.away ? 'bg-slate-50 opacity-60' : ''}`}>
                <span className="text-base font-bold text-slate-900 truncate">{member.display_name}</span>
                {member.is_contractor && (
                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-900 text-xs font-black border border-violet-300">
                    CONTRACTOR • {member.contractor_company || 'Contractor'}
                  </span>
                )}
                {covering && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-xs font-black border border-indigo-300">
                    OVERTIME • {member.panel || 'Home crew'}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">{member.trade}</span>
                {!member.is_contractor && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-950 text-xs font-bold border border-amber-200">
                    {accessPill(member.access_level)}
                  </span>
                )}
                {!member.is_contractor && (
                  <button
                    type="button"
                    onClick={() => void setCrewMemberAway(member, !member.away)}
                    className={`ml-auto min-h-10 px-3 rounded-full text-xs font-black border ${
                      member.away
                        ? 'bg-slate-200 text-slate-600 border-slate-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}
                    aria-pressed={member.away}
                  >
                    {member.away ? 'Away' : 'On Roster'}
                  </button>
                )}
                {!member.away && (
                  <span className={member.is_contractor ? 'ml-auto' : ''}>
                    <AllocationPill
                      member={member}
                      assets={assets}
                      workOrders={workOrders}
                      busy={savingAllocation === member.id}
                      onChange={(choice) => void assign(member, choice)}
                    />
                  </span>
                )}
                {temporary && (
                  <button
                    type="button"
                    onClick={() => void endShiftExtra(member, workOrders)}
                    className="min-h-10 min-w-10 rounded-full border border-slate-300 text-slate-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 inline-flex items-center justify-center"
                    aria-label={`Remove ${member.display_name} from this shift`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditor(member)}
                  className="min-h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-amber-50 hover:border-amber-400 flex items-center gap-1.5"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
              </li>
              );
            })}
          </ul>
        )}

        {removedCrew.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowRemoved((open) => !open)}
              className="min-h-10 text-sm font-bold text-slate-500 hover:text-slate-800"
            >
              {showRemoved ? 'Hide removed people' : `Removed (${removedCrew.length})`}
            </button>
            {showRemoved && (
              <ul className="mt-2 divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {removedCrew.map((member) => (
                  <li key={member.id} className="px-3 min-h-12 flex items-center justify-between gap-2 bg-slate-50">
                    <span className="text-sm font-semibold text-slate-500">{member.display_name}</span>
                    <button
                      type="button"
                      onClick={() => void setCrewMemberActive(member, true)}
                      className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-emerald-50"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {editor && (
        <CrewMemberForm
          key={editor === 'new' ? `new-${defaultPanel}` : editor.id}
          editing={editor === 'new' ? null : editor}
          department={department}
          defaultPanel={defaultPanel}
          onSave={saveForDepartment}
          onClose={() => setEditor(null)}
          onRemove={editor === 'new' ? undefined : () => void handleRemove(editor)}
        />
      )}
      {showOvertime && selected !== 'all' && (
        <OvertimeCrewModal
          crew={departmentCrew}
          targetPanel={selected}
          onAdd={placeOnOvertime}
          onClose={() => setShowOvertime(false)}
        />
      )}
      {showContractor && (
        <ContractorModal
          crewLabel={selected === 'all' ? (onShiftPanel ?? 'A Crew') : selected}
          assets={assets}
          workOrders={workOrders}
          onSave={placeContractor}
          onClose={() => setShowContractor(false)}
        />
      )}
    </div>
  );
}
