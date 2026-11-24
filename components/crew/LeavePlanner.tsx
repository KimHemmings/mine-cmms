'use client';

import { useMemo, useState } from 'react';
import { CrewMember } from '@/types';
import { Department, departmentLabel, normalizeDepartment } from '@/utils/permissions';
import { crewLetter } from '@/utils/shiftRoster';
import { CrewLeave, LEAVE_TYPES, LeaveType, addDays, leaveCovers, leaveTone, localDateIso, shortDay } from '@/utils/crewLeave';
import { createClient } from '@/utils/supabase/client';
import { useFeedback } from '@/components/ui/FeedbackProvider';

interface LeavePlannerProps {
  members: CrewMember[];
  leave: CrewLeave[];
  accessLevel: number;
  department: Department;
  crossDepartment?: boolean;
  signerName: string;
  onChanged: () => void;
  logOnly?: boolean;
  onClose?: () => void;
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

export default function LeavePlanner({ members, leave, accessLevel, department, signerName, onChanged, logOnly = false, onClose }: LeavePlannerProps) {
  const { showToast } = useFeedback();
  const canEdit = accessLevel >= 3;
  const today = localDateIso();
  const days = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(today, index)), [today]);
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>(department);
  const [panelFilter, setPanelFilter] = useState<(typeof PANELS)[number]>('all');
  const [draft, setDraft] = useState<Draft | null>(logOnly ? { id: null, memberId: '', leaveType: 'Annual Leave', start: today, end: today, notes: '', status: 'Approved' } : null);
  const [saving, setSaving] = useState(false);

  const visible = members.filter((member) => {
    if (!member.active) return false;
    const memberDepartment = normalizeDepartment(member.department);
    if (accessLevel <= 3 && memberDepartment !== department) return false;
    if (accessLevel >= 4 && departmentFilter !== 'all' && memberDepartment !== departmentFilter) return false;
    if (accessLevel >= 4 && panelFilter !== 'all' && member.panel !== panelFilter) return false;
    return true;
  }).sort((a, b) => a.display_name.localeCompare(b.display_name));

  const choices = accessLevel >= 4 && departmentFilter !== 'all'
    ? members.filter((member) => member.active && normalizeDepartment(member.department) === departmentFilter)
    : visible;

  function openNew(memberId: string, start: string) {
    if (!canEdit) return;
    setDraft({ id: null, memberId, leaveType: 'Annual Leave', start, end: start, notes: '', status: 'Approved' });
  }

  function openExisting(row: CrewLeave) {
    if (!canEdit) return;
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
    return draft ? <LeaveDialog draft={draft} setDraft={setDraft} choices={choices} saving={saving} onSave={save} onRemove={remove} onClose={() => onClose?.()} /> : null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-slate-900">14-Day Leave Planner</h3>
          <p className="text-sm text-slate-500">Approved leave takes the person off the live shift. Pending leave stays on the grid until a supervisor approves it.</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => openNew(visible[0]?.id ?? '', today)} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-black">
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
        <div className="min-w-[860px]">
          <div className="grid items-end gap-1" style={{ gridTemplateColumns: '180px repeat(14, minmax(42px, 1fr))' }}>
            <div className="text-[11px] font-black uppercase text-slate-500">Crew off</div>
            {days.map((day) => {
              const off = visible.filter((member) => leave.some((row) => row.crew_member_id === member.id && leaveCovers(row, day, true)));
              const byPanel = new Map<string, number>();
              for (const member of off) {
                const panel = member.panel || 'No panel';
                byPanel.set(panel, (byPanel.get(panel) ?? 0) + 1);
              }
              const cover = [...byPanel.values()].some((count) => count >= 2);
              return (
                <div key={day} className={`rounded-md px-1 py-1 text-center ${cover ? 'bg-amber-100 text-amber-950' : 'bg-slate-50 text-slate-700'}`}>
                  <div className="text-[10px] font-bold">{shortDay(day)}</div>
                  <div className="text-sm font-black">{off.length}</div>
                  {cover && <div className="text-[9px] font-black leading-tight">⚠️ Cover Needed</div>}
                </div>
              );
            })}
            {visible.map((member) => (
              <MemberRow key={member.id} member={member} days={days} leave={leave} canEdit={canEdit} onEmpty={openNew} onLeave={openExisting} />
            ))}
          </div>
          {visible.length === 0 && <p className="mt-3 text-sm text-slate-500">No one in this department is on the roster.</p>}
        </div>
      </div>
      {draft && <LeaveDialog draft={draft} setDraft={setDraft} choices={choices} saving={saving} onSave={save} onRemove={remove} onClose={() => setDraft(null)} />}
    </div>
  );
}

function LeaveDialog({
  draft,
  setDraft,
  choices,
  saving,
  onSave,
  onRemove,
  onClose,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  choices: CrewMember[];
  saving: boolean;
  onSave: (status?: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
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
          <select value={draft.memberId} onChange={(event) => setDraft({ ...draft, memberId: event.target.value })} className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 px-2 text-sm font-bold normal-case text-slate-900">
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
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-black uppercase text-slate-600">
            Start date
            <input type="date" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 px-2 text-sm font-bold normal-case" required />
          </label>
          <label className="block text-xs font-black uppercase text-slate-600">
            End date
            <input type="date" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 px-2 text-sm font-bold normal-case" required />
          </label>
        </div>
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
  onEmpty,
  onLeave,
}: {
  member: CrewMember;
  days: string[];
  leave: CrewLeave[];
  canEdit: boolean;
  onEmpty: (memberId: string, day: string) => void;
  onLeave: (row: CrewLeave) => void;
}) {
  const mine = leave.filter((row) => row.crew_member_id === member.id);
  return (
    <>
      <div className="truncate pr-2 text-sm font-bold text-slate-900" title={member.display_name}>
        {member.display_name}
        <span className="block text-[11px] font-bold text-slate-500">{crewLetter(member.panel) ? member.panel : 'No panel'}</span>
      </div>
      {days.map((day) => {
        const row = mine.find((item) => leaveCovers(item, day));
        if (!row) {
          return (
            <button key={day} type="button" disabled={!canEdit} onClick={() => onEmpty(member.id, day)} aria-label={`Log leave for ${member.display_name} on ${day}`} className="h-9 rounded border border-dashed border-slate-200 bg-white hover:bg-slate-50 disabled:hover:bg-white" />
          );
        }
        const index = days.indexOf(day);
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
            className={`h-9 px-1 text-[10px] font-black truncate ${leaveTone(row.leave_type)} ${row.status === 'Pending' ? 'opacity-60' : ''} ${continued ? 'rounded-l-none' : 'rounded-l'} ${continues ? 'rounded-r-none' : 'rounded-r'}`}
          >
            {continued ? '' : row.leave_type}
          </button>
        );
      })}
    </>
  );
}
