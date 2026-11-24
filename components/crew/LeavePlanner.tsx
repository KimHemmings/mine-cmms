'use client';

import { Fragment, useMemo, useState } from 'react';
import { CrewMember } from '@/types';
import { Department, departmentLabel, normalizeDepartment } from '@/utils/permissions';
import { crewLetter } from '@/utils/shiftRoster';
import { CrewLeave, LEAVE_TYPES, LeaveType, addDays, leaveCovers, leaveTone, localDateIso, shortDay } from '@/utils/crewLeave';
import { createClient } from '@/utils/supabase/client';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import {
  DEFAULT_CREW_ROTATION_ORDER,
  DEFAULT_ROSTER_ANCHOR,
  addRosterWeeks,
  getCrewStatusForDate,
  getNextWorkingSwing,
  getSwingStartWednesday,
  RosterCrewName,
} from '@/utils/rosterCycle';

interface LeavePlannerProps {
  members: CrewMember[];
  leave: CrewLeave[];
  accessLevel: number;
  department: Department;
  crossDepartment?: boolean;
  signerName: string;
  onChanged: () => void;
  logOnly?: boolean;
  initialMemberId?: string;
  onClose?: () => void;
  personalOnly?: boolean;
  anchorDate?: string;
  rotationOrder?: readonly RosterCrewName[];
  crewScope?: string | null;
}

interface Draft {
  id: string | null;
  memberId: string;
  leaveType: LeaveType;
  start: string;
  end: string;
  notes: string;
  status: string;
}

const PANELS = ['all', 'A Crew', 'B Crew', 'C Crew', 'D Crew'] as const;

function shortMonth(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { month: 'short' });
}

function leaveBadgeLabel(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes('long service') || normalized.includes('lsl')) return 'Long Service';
  if (normalized.includes('annual')) return 'Annual';
  if (normalized.includes('sick') || normalized.includes('personal')) return 'Sick';
  if (normalized.includes('training') || normalized.includes('medical')) return 'Training';
  return type;
}

function countWorkingShifts(panel: string | null, start: string, end: string, anchorDate: string, rotationOrder: readonly RosterCrewName[]) {
  if (!panel || end < start) return 0;
  let count = 0;
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (getCrewStatusForDate(panel, date, anchorDate, rotationOrder) !== 'R&R') count += 1;
  }
  return count;
}

export default function LeavePlanner({
  members,
  leave,
  accessLevel,
  department,
  signerName,
  onChanged,
  logOnly = false,
  initialMemberId,
  onClose,
  personalOnly = false,
  anchorDate = DEFAULT_ROSTER_ANCHOR,
  rotationOrder = DEFAULT_CREW_ROTATION_ORDER,
  crewScope,
}: LeavePlannerProps) {
  const { showToast } = useFeedback();
  const canEdit = accessLevel >= 3;
  const today = localDateIso();
  const currentWednesday = getSwingStartWednesday(today);
  const [viewStart, setViewStart] = useState(currentWednesday);
  const [jumpDate, setJumpDate] = useState(today);
  const days = useMemo(
    () => Array.from({ length: 28 }, (_, index) => addDays(viewStart, index)),
    [viewStart],
  );
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>(department);
  const [panelFilter, setPanelFilter] = useState<(typeof PANELS)[number]>('all');
  const [draft, setDraft] = useState<Draft | null>(logOnly ? { id: null, memberId: initialMemberId ?? '', leaveType: 'Annual Leave', start: today, end: today, notes: '', status: 'Approved' } : null);
  const [saving, setSaving] = useState(false);
  const [datePreset, setDatePreset] = useState<'today' | 'swing' | 'custom'>('custom');

  const visible = members.filter((member) => {
    if (!member.active) return false;
    if (accessLevel === 3 && member.panel !== crewScope) return false;
    const memberDepartment = normalizeDepartment(member.department);
    if (accessLevel <= 3 && memberDepartment !== department) return false;
    if (accessLevel >= 4 && departmentFilter !== 'all' && memberDepartment !== departmentFilter) return false;
    if (accessLevel >= 4 && panelFilter !== 'all' && member.panel !== panelFilter) return false;
    return true;
  }).sort((a, b) => {
    if (accessLevel >= 4 && panelFilter === 'all') {
      const statusRank = (member: CrewMember) => {
        const status = getCrewStatusForDate(member.panel ?? '', days[0], anchorDate, rotationOrder);
        return status === 'Day' ? 0 : status === 'Night' ? 1 : 2;
      };
      const rankDifference = statusRank(a) - statusRank(b);
      if (rankDifference) return rankDifference;
      const panelDifference = rotationOrder.indexOf(a.panel as RosterCrewName) - rotationOrder.indexOf(b.panel as RosterCrewName);
      if (panelDifference) return panelDifference;
    }
    return a.display_name.localeCompare(b.display_name);
  });
  const visibleMemberIds = new Set(visible.map((member) => member.id));
  const visibleLeave = leave.filter((row) => visibleMemberIds.has(row.crew_member_id));
  const upcomingLeave = visibleLeave
    .filter((row) => row.end_date.slice(0, 10) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const groupedAll = accessLevel >= 4 && panelFilter === 'all';
  const visibleGroups = groupedAll
    ? [...new Set(visible.map((member) => member.panel || 'No panel'))].map((panel) => ({
        panel,
        members: visible.filter((member) => (member.panel || 'No panel') === panel),
      }))
    : [{ panel: '', members: visible }];

  const choices = accessLevel >= 4 && departmentFilter !== 'all'
    ? members.filter((member) => member.active && normalizeDepartment(member.department) === departmentFilter)
    : visible;

  function openNew(memberId: string, start: string) {
    if (!canEdit) return;
    setDatePreset('custom');
    setDraft({ id: null, memberId, leaveType: 'Annual Leave', start, end: start, notes: '', status: 'Approved' });
  }

  function openExisting(row: CrewLeave) {
    if (!canEdit) return;
    setDatePreset('custom');
    setDraft({
      id: row.id,
      memberId: row.crew_member_id,
      leaveType: (LEAVE_TYPES as readonly string[]).includes(row.leave_type) ? row.leave_type as LeaveType : 'Other',
      start: row.start_date.slice(0, 10),
      end: row.end_date.slice(0, 10),
      notes: row.notes ?? '',
      status: row.status,
    });
  }

  function applyDatePreset(preset: 'today' | 'swing' | 'custom') {
    setDatePreset(preset);
    if (!draft || preset === 'custom') return;
    if (preset === 'today') {
      setDraft({ ...draft, start: today, end: today });
      return;
    }
    const member = choices.find((person) => person.id === draft.memberId);
    const panel = DEFAULT_CREW_ROTATION_ORDER.find((crewName) => crewName === member?.panel);
    if (!panel) {
      showToast({ message: 'Select a crew with a configured roster cycle.', tone: 'error' });
      return;
    }
    const swing = getNextWorkingSwing(panel, today, anchorDate, rotationOrder);
    setDraft({ ...draft, start: swing.startDate, end: swing.endDate });
  }

  function navigateWeeks(weeks: number) {
    const nextStart = addRosterWeeks(viewStart, weeks);
    setViewStart(nextStart);
    setJumpDate(nextStart);
  }

  async function save(status = draft?.status || 'Approved') {
    if (!draft) return;
    if (!draft.memberId) {
      showToast({ message: 'Choose a crew member.', tone: 'error' });
      return;
    }
    if (draft.end < draft.start) {
      showToast({ message: 'The end date is before the start date.', tone: 'error' });
      return;
    }
    const member = choices.find((person) => person.id === draft.memberId);
    const workingShifts = countWorkingShifts(member?.panel ?? null, draft.start, draft.end, anchorDate, rotationOrder);
    if (workingShifts === 0) {
      showToast({ message: 'This date range has no rostered working shifts.', tone: 'error' });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const row = {
      crew_member_id: draft.memberId,
      leave_type: draft.leaveType,
      start_date: draft.start,
      end_date: draft.end,
      status,
      notes: draft.notes.trim() || null,
      created_by: signerName,
    };
    const result = draft.id
      ? await supabase.from('crew_leave').update(row).eq('id', draft.id)
      : await supabase.from('crew_leave').insert(row);
    setSaving(false);
    if (result.error) {
      showToast({ message: result.error.message || 'Leave was not saved.', tone: 'error' });
      return;
    }
    setDraft(null);
    showToast({ message: status === 'Approved' ? 'Leave approved' : 'Leave saved' });
    onChanged();
    if (logOnly) onClose?.();
  }

  async function remove() {
    if (!draft?.id) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('crew_leave').delete().eq('id', draft.id);
    setSaving(false);
    if (error) {
      showToast({ message: error.message || 'Leave was not cancelled.', tone: 'error' });
      return;
    }
    setDraft(null);
    showToast({ message: 'Leave cancelled' });
    onChanged();
    if (logOnly) onClose?.();
  }

  if (logOnly) {
    return draft ? (
      <LeaveDialog
        draft={draft}
        setDraft={setDraft}
        choices={choices}
        leave={leave}
        crewMembers={members}
        saving={saving}
        datePreset={datePreset}
        anchorDate={anchorDate}
        rotationOrder={rotationOrder}
        onDatePreset={applyDatePreset}
        onSave={save}
        onRemove={remove}
        onClose={() => onClose?.()}
      />
    ) : null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-slate-900">{personalOnly ? 'My Leave & Roster' : '28-Day Leave Planner'}</h3>
          <p className="text-sm text-slate-500">Four Wednesday-to-Tuesday swings. R&amp;R is shaded; leave affects rostered working shifts only.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => navigateWeeks(-1)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700">◀ Prev</button>
          <button type="button" onClick={() => { setViewStart(currentWednesday); setJumpDate(today); }} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700">Current</button>
          <button type="button" onClick={() => navigateWeeks(1)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700">Next ▶</button>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-600">
            Jump to Date
            <input
              type="date"
              value={jumpDate}
              onChange={(event) => {
                const date = event.target.value;
                setJumpDate(date);
                if (date) setViewStart(getSwingStartWednesday(date));
              }}
              className="min-h-9 bg-transparent text-xs font-bold text-slate-900"
              aria-label="Jump to Date"
            />
          </label>
          <details className="relative">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center rounded-full border border-slate-300 bg-white px-3 text-xs font-black text-slate-700">
              Upcoming Leave ({upcomingLeave.length}) ▾
            </summary>
            <div className="absolute left-0 top-full z-30 mt-2 max-h-80 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {upcomingLeave.length ? upcomingLeave.map((row) => {
                const member = visible.find((person) => person.id === row.crew_member_id);
                const targetDate = row.start_date.slice(0, 10) < today ? today : row.start_date.slice(0, 10);
                return (
                  <div key={row.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-2 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-900">{member?.display_name ?? 'Crew member'} · {member?.trade ?? 'Trade not recorded'}</p>
                      <p className="truncate text-[11px] text-slate-600">{row.leave_type} · {row.start_date.slice(0, 10)} – {row.end_date.slice(0, 10)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        setJumpDate(targetDate);
                        setViewStart(getSwingStartWednesday(targetDate));
                        event.currentTarget.closest('details')?.removeAttribute('open');
                      }}
                      className="min-h-8 shrink-0 rounded-lg bg-slate-900 px-2 text-[11px] font-black text-white"
                    >
                      Jump
                    </button>
                  </div>
                );
              }) : <p className="px-2 py-3 text-xs text-slate-500">No active or future leave.</p>}
            </div>
          </details>
        </div>
        {canEdit && (
          <button type="button" onClick={() => openNew(visible[0]?.id ?? '', today)} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-black text-white">
            + Log Leave
          </button>
        )}
      </div>
      {accessLevel >= 4 && (
        <div className="flex flex-wrap gap-2">
          {(['all', 'workshop', 'production', 'training'] as const).map((item) => (
            <button key={item} type="button" aria-pressed={departmentFilter === item} onClick={() => setDepartmentFilter(item)} className={`min-h-10 px-3 rounded-full border text-sm font-black ${departmentFilter === item ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
              {item === 'all' ? 'All departments' : departmentLabel(item)}
            </button>
          ))}
          {PANELS.map((item) => (
            <button key={item} type="button" aria-pressed={panelFilter === item} onClick={() => setPanelFilter(item)} className={`min-h-10 px-3 rounded-full border text-sm font-black ${panelFilter === item ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
              {item === 'all' ? 'All panels' : item}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${220 + 28 * 46}px` }}>
          <div className="grid items-end gap-1" style={{ gridTemplateColumns: '220px repeat(28, minmax(42px, 1fr))' }}>
            <div className="sticky left-0 z-20 bg-white pr-2 text-[11px] font-black uppercase text-slate-500">Crew / Trade</div>
            {days.map((day, index) => {
              const scheduled = visible.filter((member) => member.active
                && getCrewStatusForDate(member.panel ?? '', day, anchorDate, rotationOrder) !== 'R&R');
              const off = scheduled.filter((member) => visibleLeave.some((row) =>
                row.crew_member_id === member.id && leaveCovers(row, day, true),
              ));
              const netActive = scheduled.length - off.length;
              const rr = scheduled.length === 0;
              const full = off.length === 0;
              const manningTone = full
                ? 'border-slate-300 bg-slate-100 text-slate-700'
                : off.length === 1
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-rose-300 bg-rose-50 text-rose-900';
              return (
                <div key={day} title={day} className={`rounded-md px-1 py-1 text-center ${index % 7 === 0 ? 'border-l-2 border-slate-300' : ''} bg-slate-50 text-slate-700`}>
                  <div className="text-[10px] font-bold">{shortDay(day)}</div>
                  <div className="text-[8px] font-bold text-slate-500">{shortMonth(day)}</div>
                  {accessLevel >= 3 && !personalOnly && !rr && (
                    <div className={`mt-1 rounded-full border px-1 py-0.5 text-[9px] font-black ${manningTone}`} title={`${netActive} of ${scheduled.length} rostered crew on`}>
                      {netActive}/{scheduled.length} on
                    </div>
                  )}
                  {rr && <div className="mt-1 text-[9px] font-black text-slate-400">R&amp;R</div>}
                </div>
              );
            })}
            {visibleGroups.map((group) => (
              <Fragment key={group.panel || 'all'}>
                {groupedAll && (
                  <div className="col-span-full rounded bg-slate-100 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-slate-700">
                    {group.panel}
                  </div>
                )}
                {group.members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    days={days}
                    leave={visibleLeave}
                    canEdit={canEdit}
                    personalOnly={personalOnly}
                    anchorDate={anchorDate}
                    rotationOrder={rotationOrder}
                    onEmpty={openNew}
                    onLeave={openExisting}
                  />
                ))}
              </Fragment>
            ))}
          </div>
          {visible.length === 0 && <p className="mt-3 text-sm text-slate-500">{personalOnly ? 'No linked crew roster was found. Ask your supervisor to link your crew profile.' : 'No one in this department is on the roster.'}</p>}
        </div>
      </div>
      {draft && (
        <LeaveDialog
          draft={draft}
          setDraft={setDraft}
          choices={choices}
          leave={leave}
          crewMembers={members}
          saving={saving}
          datePreset={datePreset}
          anchorDate={anchorDate}
          rotationOrder={rotationOrder}
          onDatePreset={applyDatePreset}
          onSave={save}
          onRemove={remove}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}

function LeaveDialog({
  draft,
  setDraft,
  choices,
  leave,
  crewMembers,
  saving,
  datePreset,
  anchorDate,
  rotationOrder,
  onDatePreset,
  onSave,
  onRemove,
  onClose,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  choices: CrewMember[];
  leave: CrewLeave[];
  crewMembers: CrewMember[];
  saving: boolean;
  datePreset: 'today' | 'swing' | 'custom';
  anchorDate: string;
  rotationOrder: readonly RosterCrewName[];
  onDatePreset: (preset: 'today' | 'swing' | 'custom') => void;
  onSave: (status?: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const member = choices.find((person) => person.id === draft.memberId);
  const memberHasRoster = DEFAULT_CREW_ROTATION_ORDER.some((crewName) => crewName === member?.panel);
  const workingShifts = countWorkingShifts(member?.panel ?? null, draft.start, draft.end, anchorDate, rotationOrder);
  const conflicts = member
    ? leave
      .filter((row) => row.id !== draft.id
        && row.end_date.slice(0, 10) >= draft.start
        && row.start_date.slice(0, 10) <= draft.end)
      .flatMap((row) => {
        const offMember = crewMembers.find((person) => person.id === row.crew_member_id);
        return offMember?.active && offMember.panel === member.panel
          ? [{ row, member: offMember }]
          : [];
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave('Approved');
        }}
      >
        <h3 className="text-lg font-black text-slate-900">{draft.id ? 'Edit leave' : '+ Log Leave'}</h3>
        <label className="block text-xs font-black uppercase text-slate-600">
          Crew member
          <select value={draft.memberId} onChange={(event) => { onDatePreset('custom'); setDraft({ ...draft, memberId: event.target.value }); }} className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 px-2 text-sm font-bold normal-case text-slate-900">
            <option value="">Choose a person</option>
            {choices.map((member) => <option key={member.id} value={member.id}>{member.display_name} · {member.panel || 'No panel'}</option>)}
          </select>
        </label>
        <label className="block text-xs font-black uppercase text-slate-600">
          Leave type
          <select value={draft.leaveType} onChange={(event) => setDraft({ ...draft, leaveType: event.target.value as LeaveType })} className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 px-2 text-sm font-bold normal-case text-slate-900">
            {LEAVE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <div>
          <p className="mb-1 text-xs font-black uppercase text-slate-600">Date preset</p>
          <div className="flex flex-wrap gap-2">
            {([
              ['today', 'Today Only'],
              ['swing', 'Full Swing (Wed–Tue)'],
              ['custom', 'Custom Dates'],
            ] as const).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                aria-pressed={datePreset === preset}
                disabled={preset === 'swing' && !memberHasRoster}
                onClick={() => onDatePreset(preset)}
                className={`min-h-9 rounded-lg border px-3 text-xs font-black disabled:opacity-40 ${datePreset === preset ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-black uppercase text-slate-600">
            Start date
            <input type="date" value={draft.start} onChange={(event) => { onDatePreset('custom'); setDraft({ ...draft, start: event.target.value }); }} className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 px-2 text-sm font-bold normal-case" required />
          </label>
          <label className="block text-xs font-black uppercase text-slate-600">
            End date
            <input type="date" value={draft.end} onChange={(event) => { onDatePreset('custom'); setDraft({ ...draft, end: event.target.value }); }} className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 px-2 text-sm font-bold normal-case" required />
          </label>
        </div>
        <p className="text-xs font-bold text-slate-600">
          {workingShifts} rostered working {workingShifts === 1 ? 'shift' : 'shifts'} affected; R&amp;R days excluded.
        </p>
        {conflicts.length > 0 && (
          <div className="rounded-lg border border-amber-400 bg-amber-50 p-3" role="alert">
            <p className="text-xs font-black text-amber-950">Crew leave overlaps these dates:</p>
            <ul className="mt-1 space-y-1">
              {conflicts.map(({ row, member: offMember }) => (
                <li key={row.id} className="text-xs font-bold text-rose-800">
                  {offMember.display_name} ({offMember.trade}) — {row.leave_type}, {row.start_date.slice(0, 10)} to {row.end_date.slice(0, 10)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="block text-xs font-black uppercase text-slate-600">
          Notes
          <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm font-bold normal-case" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-black disabled:opacity-50">Save</button>
          {draft.id && draft.status === 'Pending' && (
            <button type="button" disabled={saving} onClick={() => void onSave('Approved')} className="min-h-11 px-4 rounded-lg bg-emerald-700 text-white text-sm font-black disabled:opacity-50">Approve</button>
          )}
          {draft.id && (
            <button type="button" disabled={saving} onClick={() => void onRemove()} className="min-h-11 px-4 rounded-lg border border-rose-300 text-rose-700 text-sm font-black disabled:opacity-50">Cancel leave</button>
          )}
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-lg border border-slate-300 text-sm font-bold text-slate-700">Close</button>
        </div>
      </form>
    </div>
  );
}

function MemberRow({
  member,
  days,
  leave,
  canEdit,
  personalOnly,
  anchorDate,
  rotationOrder,
  onEmpty,
  onLeave,
}: {
  member: CrewMember;
  days: string[];
  leave: CrewLeave[];
  canEdit: boolean;
  personalOnly: boolean;
  anchorDate: string;
  rotationOrder: readonly RosterCrewName[];
  onEmpty: (memberId: string, day: string) => void;
  onLeave: (row: CrewLeave) => void;
}) {
  const mine = leave.filter((row) => row.crew_member_id === member.id);
  return (
    <>
      <div className="sticky left-0 z-10 truncate bg-white pr-2 text-sm font-bold text-slate-900" title={member.display_name}>
        {member.display_name}
        <span className="block truncate text-[11px] font-bold text-slate-500">{member.trade} · {crewLetter(member.panel) ? member.panel : 'No panel'}</span>
      </div>
      {days.map((day) => {
        const index = days.indexOf(day);
        const boundaryClass = index % 7 === 0 ? 'border-l-2 border-slate-300' : '';
        const rosterStatus = getCrewStatusForDate(member.panel ?? '', day, anchorDate, rotationOrder);
        if (rosterStatus === 'R&R') {
          return (
            <div
              key={day}
              title={`${member.panel ?? 'Unassigned crew'} R&R`}
              aria-label={`${member.display_name} R&R on ${day}`}
              className={`flex h-9 items-center justify-center rounded bg-slate-100 text-[9px] font-black text-slate-400 ${boundaryClass}`}
            >
              R&amp;R
            </div>
          );
        }
        const row = mine.find((item) => leaveCovers(item, day));
        if (!row) {
          if (personalOnly) {
            return (
              <div
                key={day}
                title={rosterStatus === 'Day' ? 'Day Shift' : 'Night Shift'}
                aria-label={`${member.display_name} ${rosterStatus === 'Day' ? 'Day Shift' : 'Night Shift'} on ${day}`}
                className={`flex h-9 items-center justify-center rounded border border-slate-200 bg-white text-[9px] font-black text-slate-500 ${boundaryClass}`}
              >
                {rosterStatus === 'Day' ? 'Day' : 'Night'}
              </div>
            );
          }
          return (
            <button key={day} type="button" disabled={!canEdit} onClick={() => onEmpty(member.id, day)} aria-label={`Log leave for ${member.display_name} on ${day}`} className={`h-9 rounded border border-dashed border-slate-200 bg-white hover:bg-slate-50 disabled:hover:bg-white ${boundaryClass}`} />
          );
        }
        const continued = index > 0 && leaveCovers(row, days[index - 1]);
        const continues = index < days.length - 1 && leaveCovers(row, days[index + 1]);
        return (
          <button
            key={day}
            type="button"
            disabled={!canEdit}
            onClick={() => onLeave(row)}
            title={`${row.leave_type}${row.status === 'Pending' ? ' · Pending' : ''}`}
            aria-label={`${member.display_name} ${row.leave_type} on ${day}`}
            className={`h-9 px-1 text-[10px] font-black truncate ${boundaryClass} ${leaveTone(row.leave_type)} ${row.status === 'Pending' ? 'opacity-60' : ''} ${continued ? 'rounded-l-none' : 'rounded-l'} ${continues ? 'rounded-r-none' : 'rounded-r'}`}
          >
            {continued ? '' : leaveBadgeLabel(row.leave_type)}
          </button>
        );
      })}
    </>
  );
}
