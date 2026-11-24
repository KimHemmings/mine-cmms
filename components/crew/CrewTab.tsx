'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Printer, UserPlus } from 'lucide-react';
import { useSiteBrand } from '@/components/SiteBrand';
import BulkPasteModal from '@/components/BulkPasteModal';
import { CREW_PANELS, CrewMember, CrewMemberInput, ShiftRecord, Asset, MachineWorkOrder } from '@/types';
import { Department, departmentLabel, normalizeDepartment } from '@/utils/permissions';
import { getShiftClock } from '@/utils/shiftClock';
import { AllocationChoice, defaultAllocationRole, memberAssignments, operatorEquipmentModels, preStartLocation, preStartUnit } from '@/utils/crewAllocation';
import { crewLetter, coveringLetter, rosterRoleNote, visibleOnCrewTab } from '@/utils/shiftRoster';
import { OvertimeReason, fatigueGate } from '@/utils/statutoryCompliance';
import { approvedLeaveOn, shiftDateIso } from '@/utils/crewLeave';
import LeavePlanner from './LeavePlanner';
import { createClient } from '@/utils/supabase/client';
import { latestSafetyAwareness } from '@/utils/productionHandoverRecord';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { useCrewData } from './CrewDataContext';
import CrewMemberForm from './CrewMemberForm';
import AllocationPill from './AllocationPill';
import CompetencyBoard from './CompetencyBoard';
import ShiftExtraModal from './ShiftExtraModal';

interface CrewTabProps {
  activeShift: ShiftRecord | null;
  canManageCrew: boolean;
  crossDepartment?: boolean;
  canManageCompetencies?: boolean;
  accessLevel?: number;
  signerName?: string;
  department: Department;
  rosterTitle?: string;
  matrixOnly?: boolean;
  saveCrewMember: (input: CrewMemberInput, id?: string) => Promise<boolean>;
  setCrewMemberActive: (member: CrewMember, active: boolean) => Promise<void>;
  setCrewMemberAway: (member: CrewMember, away: boolean) => Promise<void>;
  setCrewAllocation: (member: CrewMember, choice: AllocationChoice, workOrders: MachineWorkOrder[], assets: Asset[]) => Promise<void>;
  addOvertimeCover: (member: CrewMember, letter: string, shiftEndsAt: string, reason: string, fatigueOverride?: boolean) => Promise<boolean>;
  addContractor: (input: { name: string; company: string; trade: string; department: string; panel: string; shiftEndsAt: string; passedOut?: string[]; overtimeReason?: string }) => Promise<CrewMember | null>;
  updateOperatorCompetencies?: (member: CrewMember, passed: string[], training: string[], extras?: { voc?: Record<string, string>; medical?: string; standard11?: string }) => Promise<boolean>;
  endShiftExtra: (member: CrewMember, workOrders: MachineWorkOrder[]) => Promise<void>;
  clearExpiredShiftExtras: (members: CrewMember[]) => Promise<void>;
  assets: Asset[];
  fleetAssets?: Asset[];
  downAssetIds?: string[];
  updateMachineLocation?: (assetId: string, location: string) => Promise<boolean>;
  updateMachineCircuit?: (assetId: string, circuit: string) => Promise<boolean>;
  workOrders: MachineWorkOrder[];
  onRefresh?: () => void;
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

export default function CrewTab({
  activeShift,
  canManageCrew,
  crossDepartment = false,
  canManageCompetencies = false,
  accessLevel = 2,
  signerName = 'Training',
  department,
  rosterTitle,
  matrixOnly = false,
  saveCrewMember,
  setCrewMemberActive,
  setCrewMemberAway,
  setCrewAllocation,
  addOvertimeCover,
  addContractor,
  clearExpiredShiftExtras,
  updateOperatorCompetencies,
  assets,
  fleetAssets,
  downAssetIds = [],
  workOrders,
  onRefresh,
}: CrewTabProps) {
  const { crew, leave } = useCrewData();
  const { name: siteName } = useSiteBrand();
  const [showImport, setShowImport] = useState(false);
  const { confirm, showToast } = useFeedback();
  const [pinged, setPinged] = useState<Record<string, true>>({});
  const [pingingId, setPingingId] = useState<string | null>(null);
  const onShiftPanel = shiftCrew(activeShift?.crew);
  const [selected, setSelected] = useState<CrewFilter>(onShiftPanel ?? 'all');
  const [editor, setEditor] = useState<CrewMember | 'new' | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [savingAllocation, setSavingAllocation] = useState<string | null>(null);
  const [showExtra, setShowExtra] = useState(false);
  const [trainingView, setTrainingView] = useState<'passouts' | 'team'>(accessLevel >= 3 ? 'team' : 'passouts');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [showPlanner, setShowPlanner] = useState(false);
  const [loggingLeave, setLoggingLeave] = useState(false);

  const clearExpiredRef = useRef(clearExpiredShiftExtras);
  clearExpiredRef.current = clearExpiredShiftExtras;

  useEffect(() => {
    if (onShiftPanel) setSelected(onShiftPanel);
  }, [onShiftPanel]);

  useEffect(() => {
    void clearExpiredRef.current(crew);
  }, [crew]);

  const inDepartment = (member: CrewMember) => {
    const memberDepartment = normalizeDepartment(member.department);
    if (!crossDepartment) return memberDepartment === department;
    return departmentFilter === 'all' || memberDepartment === departmentFilter;
  };
  const departmentCrew = crew.filter((member) => inDepartment(member));
  const removedCrew = departmentCrew.filter((member) => !member.active && !member.is_contractor);
  const countFor = (panel: CrewFilter) => departmentCrew.filter((member) => visibleOnCrewTab(member, panel)).length;
  const shown = departmentCrew
    .filter((member) => visibleOnCrewTab(member, selected))
    .slice()
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const fleet = fleetAssets ?? assets;
  const production = department === 'production';
  const training = department === 'training';
  const showPassouts = matrixOnly || (training && (accessLevel < 3 || trainingView === 'passouts'));
  const isAssigned = (member: CrewMember) => {
    if (member.allocated_machine_id || member.shift_duty) return true;
    return !production && memberAssignments(member.id, workOrders, assets).length > 0;
  };
  const dueOnSheet = shown.filter((member) => !member.away && !member.on_leave);
  const shiftDay = shiftDateIso(activeShift?.shift_date);
  const onRoster = dueOnSheet;
  const unassigned = onRoster.filter((member) => !isAssigned(member)).length;
  const printLabel = selected === 'all' ? 'Print All Crews Pre-Start (PDF)' : `Print ${selected} Pre-Start (PDF)`;
  const extraPanel = selected === 'all' ? (onShiftPanel ?? 'A Crew') : selected;
  const defaultPanel = selected === 'all' ? (onShiftPanel ?? 'A Crew') : selected;

  const printPreStart = async () => {
    const { generatePreStartSheet } = await import('@/utils/generatePreStartPDF');
    const clock = getShiftClock();
    let safetyAwareness = '';
    if (production) {
      const letter = crewLetter(selected === 'all' ? activeShift?.crew : selected);
      if (letter) {
        const supabase = createClient();
        const { data } = await supabase
          .from('production_handover_checks')
          .select('safety_awareness, shift_date, shift_name, updated_at')
          .eq('crew_group', letter)
          .order('shift_date', { ascending: false })
          .limit(12);
        safetyAwareness = latestSafetyAwareness(data ?? []);
      }
    }
    generatePreStartSheet(
      dueOnSheet.map((member) => ({
        display_name: member.display_name,
        trade: member.trade,
        department: member.department,
        roleNote: rosterRoleNote(member),
        allocated: preStartUnit(member, workOrders, fleet),
        location: preStartLocation(member, workOrders, fleet, downAssetIds),
      })),
      {
        date: new Date(),
        shiftName: clock.shiftName,
        crew: selected === 'all' ? 'All crews' : selected,
        safetyAwareness,
      },
      siteName,
    );
  };

  const saveForDepartment = (input: CrewMemberInput, id?: string) =>
    saveCrewMember({ ...input, department }, id);

  const markSickToday = async (member: CrewMember) => {
    if (approvedLeaveOn(leave, member.id, shiftDay)) {
      showToast({ message: `${member.display_name} is already on approved leave today.` });
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('crew_leave').insert({
      crew_member_id: member.id,
      leave_type: 'Sick / Personal',
      start_date: shiftDay,
      end_date: shiftDay,
      status: 'Approved',
      created_by: signerName,
    });
    if (error) {
      showToast({ message: error.message || 'Sick leave was not saved.', tone: 'error' });
      return;
    }
    showToast({ message: `${member.display_name} is away • Sick / Personal` });
    onRefresh?.();
  };

  const undoLeave = async (member: CrewMember) => {
    const record = approvedLeaveOn(leave, member.id, shiftDay);
    const id = record?.id ?? member.leave_id;
    if (!id) return;
    const supabase = createClient();
    const { error } = await supabase.from('crew_leave').delete().eq('id', id);
    if (error) {
      showToast({ message: error.message || 'Leave was not removed.', tone: 'error' });
      return;
    }
    showToast({ message: `${member.display_name} is back on shift` });
    onRefresh?.();
  };

  const fatigueDecision = async (member: CrewMember) => {
    const gate = fatigueGate(member.last_shift_ended_at);
    if (!gate) return 'clear' as const;
    if (accessLevel <= 3) {
      showToast({ message: `FATIGUE BREACH (< 10h Break) — ${member.display_name} cannot be allocated.`, tone: 'error', durationMs: 8000 });
      return 'blocked' as const;
    }
    const ok = await confirm({
      title: 'FATIGUE BREACH (< 10h Break)',
      message: `${member.display_name} has had ${gate.breakHours.toFixed(1)} hours off. Record a fatigue management override?`,
      confirmLabel: 'Record override',
      tone: 'danger',
    });
    return ok ? 'override' as const : 'blocked' as const;
  };

  const placeOnOvertime = async (member: CrewMember, reason: OvertimeReason) => {
    const letter = crewLetter(extraPanel);
    if (!letter) return;
    const fatigue = await fatigueDecision(member);
    if (fatigue === 'blocked') return;
    const ok = await addOvertimeCover(member, letter, getShiftClock().shiftEnd.toISOString(), reason, fatigue === 'override');
    if (ok) setShowExtra(false);
  };

  const placeContractor = async (input: { name: string; company: string; trade: string; allocation: AllocationChoice | null; passedOut: string[]; overtimeReason: OvertimeReason }) => {
    const panel = selected === 'all' ? (onShiftPanel ?? 'A Crew') : selected;
    const created = await addContractor({
      ...input,
      department,
      panel,
      shiftEndsAt: getShiftClock().shiftEnd.toISOString(),
      passedOut: input.passedOut,
      overtimeReason: input.overtimeReason,
    });
    if (created && input.allocation) {
      const choice = input.allocation.type === 'machine' && production
        ? { ...input.allocation, role: input.allocation.role ?? defaultAllocationRole(input.allocation.assetId, created.id, departmentCrew) }
        : input.allocation;
      await setCrewAllocation(created, choice, workOrders, fleet);
    }
    setShowExtra(false);
  };

  const pingTraining = async (member: CrewMember) => {
    const letter = crewLetter(member.panel) || 'their';
    const message = `@Training — Please verify equipment pass-outs for ${member.display_name} (${letter} Crew).`;
    setPingingId(member.id);
    const supabase = createClient();
    const { error } = await supabase.from('shift_chat').insert({ message, recipient_id: null });
    setPingingId(null);
    if (error) {
      showToast({ message: 'Signal lost — message not sent. Tap Send to retry.', tone: 'error', durationMs: 8000 });
      return;
    }
    setPinged((current) => ({ ...current, [member.id]: true }));
  };

  const assign = async (member: CrewMember, choice: AllocationChoice) => {
    let next = choice;
    if (choice.type === 'machine' || choice.type === 'floater') {
      const fatigue = await fatigueDecision(member);
      if (fatigue === 'blocked') return;
      if (fatigue === 'override') next = { ...choice, fatigueOverride: true };
    }
    setSavingAllocation(member.id);
    await setCrewAllocation(member, next, workOrders, fleet);
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
      {training && accessLevel >= 3 && !matrixOnly && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Training views">
          {([['team', 'Training Team'], ['passouts', 'Production Operator Pass-Outs']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={trainingView === id}
              onClick={() => setTrainingView(id)}
              className={`min-h-11 px-4 rounded-full border text-sm font-black ${trainingView === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {showPassouts && updateOperatorCompetencies ? (
        <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs">
          <CompetencyBoard crew={crew} assets={fleet} onSave={updateOperatorCompetencies} actorName={signerName} readOnly={matrixOnly} hideDirectives={matrixOnly} />
        </section>
      ) : (
      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">{rosterTitle || `${departmentLabel(department)} crew`}</h3>
            <p className="text-sm text-slate-500">{department === 'production' ? 'Operators and the machines they are allocated to.' : 'Trades due on the selected crew. Away stays on the list and off the sign-on sheet.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageCrew && (
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="min-h-11 px-4 rounded-lg border-2 border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Bulk Import (CSV / Paste)
              </button>
            )}
            {accessLevel >= 3 && !showPlanner && (
              <button
                type="button"
                onClick={() => setLoggingLeave(true)}
                className="min-h-11 px-4 rounded-lg border-2 border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                + Log Leave
              </button>
            )}
            <button
              type="button"
              aria-pressed={showPlanner}
              onClick={() => setShowPlanner((open) => !open)}
              className={`min-h-11 px-4 rounded-lg border-2 text-sm font-bold ${showPlanner ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'}`}
            >
              {showPlanner ? 'Crew list' : '14-Day Leave Planner'}
            </button>
            {canManageCrew && (
            <button
              type="button"
              onClick={() => setEditor('new')}
              className="min-h-11 px-4 rounded-lg border-2 border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> + Add Crew
            </button>
            )}
            {canManageCrew && (
              <button
                type="button"
                onClick={() => setShowExtra(true)}
                className="min-h-11 px-4 rounded-lg border-2 border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                + Overtime / Contractor
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

        {crossDepartment && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Department">
            {(['all', 'production', 'workshop', 'training'] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-selected={departmentFilter === item}
                onClick={() => setDepartmentFilter(item)}
                className={`min-h-10 px-3 rounded-full border text-sm font-black ${departmentFilter === item ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
              >
                {item === 'all' ? 'All departments' : departmentLabel(item)}
              </button>
            ))}
          </div>
        )}

        {showPlanner ? (
          <LeavePlanner
            members={accessLevel >= 4 ? crew : departmentCrew}
            leave={leave}
            accessLevel={accessLevel}
            department={department}
            crossDepartment={accessLevel >= 4}
            signerName={signerName}
            onChanged={() => onRefresh?.()}
          />
        ) : null}

        {!showPlanner && <>
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
          <div className="overflow-x-auto">
          <ul className="min-w-[720px] divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {shown.map((member) => {
              const covering = coveringLetter(member);
              return (
              <li key={member.id} className={`px-3 min-h-14 ${member.away ? 'bg-slate-50' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-bold text-slate-900 truncate">{member.display_name}</span>
                    <span className="shrink-0 text-sm text-slate-500">{member.trade}</span>
                    {member.on_leave && member.leave_type && (
                      <span className="shrink-0 rounded-full bg-rose-700 px-2 py-0.5 text-[11px] font-black text-white">Away • {member.leave_type}</span>
                    )}
                    {covering && <span className="shrink-0 text-xs font-bold text-indigo-700">OT</span>}
                    {member.is_contractor && <span className="shrink-0 text-xs font-bold text-violet-700">Contractor</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {accessLevel >= 3 && (member.on_leave ? (
                      <button
                        type="button"
                        onClick={() => void undoLeave(member)}
                        className="min-h-10 px-3 rounded-full border border-slate-400 bg-white text-xs font-black text-slate-800"
                      >
                        Undo Leave
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void markSickToday(member)}
                        className="min-h-10 px-3 rounded-full border border-rose-300 bg-rose-50 text-xs font-black text-rose-800"
                      >
                        Sick Today
                      </button>
                    ))}
                    {canManageCrew && (
                    <button
                      type="button"
                      onClick={() => void setCrewMemberAway(member, !member.away)}
                      className={`min-h-10 px-3 rounded-full text-xs font-black border ${
                        member.away
                          ? 'bg-slate-200 text-slate-600 border-slate-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      }`}
                      aria-pressed={member.away}
                    >
                      {member.away ? 'Away' : 'On Roster'}
                    </button>
                    )}
                    <AllocationPill
                      readOnly={!canManageCrew || !!member.on_leave}
                      member={member}
                      assets={assets}
                      fleetAssets={fleet}
                      downAssetIds={downAssetIds}
                      roster={departmentCrew}
                      workOrders={workOrders}
                      busy={savingAllocation === member.id}
                      variant={production ? 'production' : 'workshop'}
                      onChange={(choice) => void assign(member, choice)}
                      onPingTraining={production ? () => void pingTraining(member) : undefined}
                      pinging={pingingId === member.id}
                      pingSent={!!pinged[member.id]}
                    />
                    {production && (member.passed_out_equipment ?? []).length === 0 && (
                      pinged[member.id] ? (
                        <span className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-800">Sent to Training ✓</span>
                      ) : (
                        <button
                          type="button"
                          disabled={pingingId === member.id}
                          onClick={() => void pingTraining(member)}
                          className="min-h-10 shrink-0 rounded-full border border-amber-400 bg-amber-50 px-3 text-xs font-black text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {pingingId === member.id ? 'Sending...' : 'Ping Training'}
                        </button>
                      )
                    )}
                    {canManageCrew && (
                    <button
                      type="button"
                      onClick={() => setEditor(member)}
                      className="min-h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-amber-50 hover:border-amber-400 flex items-center gap-1.5"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
          </div>
        )}

        {canManageCrew && removedCrew.length > 0 && (
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
        </>}
      </section>
      )}

      {editor && (
        <CrewMemberForm
          key={editor === 'new' ? `new-${defaultPanel}` : editor.id}
          editing={editor === 'new' ? null : editor}
          department={department}
          defaultPanel={defaultPanel}
          equipmentModels={operatorEquipmentModels(fleet)}
          readOnlyCompetencies={production}
          onSave={saveForDepartment}
          onClose={() => setEditor(null)}
          onRemove={editor === 'new' ? undefined : () => void handleRemove(editor)}
        />
      )}
      {showImport && (
        <BulkPasteModal
          kind="crew"
          department={department}
          onClose={() => setShowImport(false)}
          onImported={() => onRefresh?.()}
        />
      )}
      {loggingLeave && (
        <LeavePlanner
          logOnly
          members={accessLevel >= 4 ? crew : departmentCrew}
          leave={leave}
          accessLevel={accessLevel}
          department={department}
          crossDepartment={accessLevel >= 4}
          signerName={signerName}
          onChanged={() => onRefresh?.()}
          onClose={() => setLoggingLeave(false)}
        />
      )}
      {showExtra && (
        <ShiftExtraModal
          crew={departmentCrew}
          targetPanel={extraPanel}
          assets={production ? fleet : assets}
          workOrders={workOrders}
          variant={production ? 'production' : 'workshop'}
          onAddOvertime={placeOnOvertime}
          onAddContractor={placeContractor}
          onClose={() => setShowExtra(false)}
        />
      )}
    </div>
  );
}
