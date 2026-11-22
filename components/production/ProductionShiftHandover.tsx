'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Asset, CrewMember, HandoverLogEntry, MachineWorkOrder, ShiftRecord } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { getEventConfig, getPriorityConfig, STAGE_THEMES } from '@/components/workboard/workboardTheme';
import { holdBadge } from '@/utils/jobHold';
import { mainOpenJob, productionSeatLines } from '@/utils/crewAllocation';
import { formatDateTime, getEtuStatus } from '@/utils/helpers';
import { getShiftClock, inWindow } from '@/utils/shiftClock';
import { crewLetter, visibleOnCrewTab } from '@/utils/shiftRoster';
import PitChecksCard from '@/components/production/PitChecksCard';
import OceHandoverSections from '@/components/production/OceHandoverSections';
import { useProductionHandoverRecord } from '@/hooks/useProductionHandoverRecord';
import { pitCheckLines } from '@/utils/productionHandoverRecord';
import { isProductionDepartment } from '@/utils/permissions';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import DictationMicButton, { useDictationTarget } from '@/components/ui/DictationMicButton';
import { FileText, Presentation } from 'lucide-react';
import { generateProductionShiftPptx } from '@/utils/productionShiftPptx';
import TidyNotesButton from '@/components/ui/TidyNotesButton';
import ManagementDirectives from '@/components/ManagementDirectives';
import StatutoryDueBadge from '@/components/StatutoryDueBadge';
import { serviceDue } from '@/utils/statutoryCompliance';
import HandoverAddendum from '@/components/production/HandoverAddendum';
import { handoverDraftKey, readHandoverDraft, updateHandoverDraft } from '@/utils/handoverDraft';

function isReleased(asset: Asset) {
  return asset.status === 'OPERATIONAL' && !asset.in_shift;
}

export default function ProductionShiftHandover({
  activeShift,
  shiftJobs,
  assets,
  workOrders,
  crew,
  handoverLog,
  onRefresh,
  supervisorName,
  readOnly = false,
  accessLevel = 3,
}: {
  activeShift: ShiftRecord | null;
  shiftJobs: Asset[];
  assets: Asset[];
  workOrders: MachineWorkOrder[];
  crew: CrewMember[];
  handoverLog: HandoverLogEntry[];
  onRefresh: () => void;
  supervisorName: string;
  readOnly?: boolean;
  accessLevel?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showReport, setShowReport] = useState(readOnly);
  const note = useDictationTarget();
  const clock = getShiftClock(new Date(now));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const down = shiftJobs
    .filter((asset) => !isReleased(asset))
    .slice()
    .sort((a, b) => (a.priority || 'P9').localeCompare(b.priority || 'P9') || a.fleet_id.localeCompare(b.fleet_id, undefined, { numeric: true }));

  const operators = crew
    .filter((member) => member.active && !member.away && isProductionDepartment(member.department))
    .filter((member) => visibleOnCrewTab(member, activeShift?.crew || 'all', now))
    .slice()
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  const notes = handoverLog.filter(
    (entry) => entry.department === 'production' && inWindow(entry.logged_at, clock.shiftStart, clock.shiftEnd),
  );

  const saveNote = async () => {
    const details = note.hold().trim();
    if (!details) return;
    if (!activeShift?.id) {
      alert('There is no active shift to log against.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('handover_log_entries').insert({
      shift_id: activeShift.id,
      category: 'PRIORITY',
      details,
      department: 'production',
    });
    setSaving(false);
    if (error) {
      alert(`Couldn't save that note: ${error.message}`);
      return;
    }
    note.setValue('');
    updateHandoverDraft(handoverDraftKey(shiftDate, clock.shiftName, 'production'), { note: null });
    showToast({ message: 'Pit note saved' });
    onRefresh();
  };

  const removeNote = async (id: string) => {
    const { error } = await supabase.from('handover_log_entries').delete().eq('id', id);
    if (error) {
      alert(`Couldn't remove that note: ${error.message}`);
      return;
    }
    showToast({ message: 'Note removed' });
    onRefresh();
  };

  const seats = productionSeatLines(operators, assets, down.map((asset) => asset.id));
  const dateLabel = activeShift?.shift_date
    ? new Date(`${activeShift.shift_date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(now).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const downRows = down.map((asset) => {
    const orders = workOrders.filter((order) => order.asset_id === asset.id && order.status !== 'COMPLETED');
    const main = mainOpenJob(orders);
    const event = getEventConfig(main?.order_type, asset.status === 'DOWN_PLANNED').label;
    const etu = getEtuStatus(asset.expected_up, now);
    const overdue = Boolean(etu?.overdue && orders.length > 0);
    return {
      fleetId: asset.fleet_id,
      makeModel: asset.make_model,
      priority: `${getPriorityConfig(asset.priority).label} · ${event}`,
      reason: main?.task_description?.trim() || 'No fault logged.',
      hold: holdBadge(main?.stage, main?.hold_eta) || '—',
      eta: `${formatDateTime(asset.expected_up)}${overdue ? ' · OVERDUE' : etu ? ` · ${etu.label}` : ''}`,
    };
  });

  const crewGroup = crewLetter(activeShift?.crew);
  const shiftDate = activeShift?.shift_date || `${clock.shiftStart.getFullYear()}-${String(clock.shiftStart.getMonth() + 1).padStart(2, '0')}-${String(clock.shiftStart.getDate()).padStart(2, '0')}`;
  const handover = useProductionHandoverRecord({
    shiftDate,
    shiftName: clock.shiftName,
    crewGroup,
    supervisorName,
  });
  const noteDraftKey = handoverDraftKey(shiftDate, clock.shiftName, 'production');
  const skipNoteWrite = useRef(0);
  useEffect(() => {
    if (handover.signedOff) {
      skipNoteWrite.current += 1;
      note.setValue('');
      return;
    }
    const draft = readHandoverDraft<{ note?: string }>(noteDraftKey);
    if (!draft?.note) return;
    skipNoteWrite.current += 1;
    note.setValue(draft.note);
    // setValue is a new function each render. Restore only when the shift key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteDraftKey, handover.signedOff]);
  useEffect(() => {
    if (handover.signedOff) {
      skipNoteWrite.current = 0;
      return;
    }
    if (skipNoteWrite.current > 0) {
      skipNoteWrite.current -= 1;
      return;
    }
    updateHandoverDraft(noteDraftKey, { note: note.value });
  }, [note.value, noteDraftKey, handover.signedOff]);
  const checkLines = pitCheckLines(handover.record, handover.record.carried_fields);
  const stamp = (name: string, at: string) => name ? `${name} · ${formatDateTime(at)}` : 'Not signed';

  const exportDeck = async () => {
    setExporting(true);
    try {
      await generateProductionShiftPptx({
        shiftName: clock.shiftName,
        shiftWindow: clock.shiftName === 'Day Shift' ? '06:00–18:00' : '18:00–06:00',
        dateLabel,
        crew: activeShift?.crew || 'Crew not set',
        supervisor: supervisorName || 'Production Supervisor',
        down: downRows,
        seats: seats.map((line) => ({ unit: line.unit, people: line.people, location: line.location })),
        checks: checkLines,
        notes: notes.map((entry) => ({ when: formatDateTime(entry.logged_at), details: entry.details })),
        oce: {
          status: handover.record.oce_inspection_status,
          file: handover.record.oce_report_filename || '',
        },
        tarps: handover.record.active_tarps.map((tarp) => ({
          name: tarp.name,
          level: tarp.carried && tarp.level !== 'Normal' ? `${tarp.level} · CARRIED OVER` : tarp.level,
          note: tarp.note,
        })),
        incidents: handover.record.incidents.map((item) => ({
          category: item.category,
          location: item.location,
          summary: item.summary,
          flags: [item.openInvestigation ? 'Open investigation' : 'Closed', item.carried ? 'CARRIED OVER' : ''].filter(Boolean).join(' · '),
        })),
        safety: handover.record.safety_awareness,
        production: {
          rom: handover.record.shift_production.romCoal,
          overburden: handover.record.shift_production.primeOverburden,
          delays: handover.record.shift_production.delays,
          services: handover.record.services_status,
          servicesNotes: handover.record.services_notes,
        },
        signoff: {
          outgoing: stamp(handover.record.outgoing_signed_by, handover.record.outgoing_signed_at),
          oncoming: stamp(handover.record.oncoming_signed_by, handover.record.oncoming_signed_at),
        },
      });
    } finally {
      setExporting(false);
    }
  };

  if (showReport) {
    return (
      <div className="space-y-4 font-sans">
        <div className="print:hidden flex flex-wrap gap-2">
          {!readOnly && <button type="button" onClick={() => setShowReport(false)} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-800">Back to handover</button>}
          <button type="button" onClick={() => window.print()} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-black">Print report</button>
          <button type="button" onClick={() => void exportDeck()} disabled={exporting} className="min-h-11 px-4 rounded-lg bg-amber-600 text-white text-sm font-black disabled:opacity-50 inline-flex items-center gap-1.5">
            <Presentation className="w-4 h-4" /> {exporting ? 'Building...' : 'Export PowerPoint'}
          </button>
        </div>
        <article className="bg-white border border-slate-300 rounded-xl p-6 space-y-6">
          <header>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Production Shift Handover</p>
            <h2 className="text-2xl font-black text-slate-900">{clock.shiftName}</h2>
            <p className="text-sm font-bold text-slate-600">{clock.shiftName === 'Day Shift' ? '06:00–18:00' : '18:00–06:00'} · {dateLabel} · {activeShift?.crew || 'Crew not set'} · {supervisorName || 'Production Supervisor'}</p>
          </header>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">OCE report status</h3>
            <p className="mt-2 text-sm"><span className="font-black">{handover.record.oce_inspection_status}</span>{handover.record.oce_report_filename ? ` — ${handover.record.oce_report_filename}` : ''}</p>
          </section>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Active TARPs</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {handover.record.active_tarps.map((tarp) => (
                <li key={tarp.name}><span className="font-black">{tarp.name}:</span> {tarp.level}{tarp.carried && tarp.level !== 'Normal' ? ' · CARRIED OVER' : ''}{tarp.note ? ` — ${tarp.note}` : ''}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Incidents / HPIs</h3>
            {handover.record.incidents.length === 0 ? <p className="mt-2 text-sm text-slate-500">No incidents logged for this shift.</p> : (
              <ul className="mt-2 space-y-2 text-sm">
                {handover.record.incidents.map((item) => (
                  <li key={item.id}><span className="font-black">{item.category}</span> — {item.location}. {item.summary} {item.openInvestigation ? '· Open investigation' : '· Closed'}{item.carried ? ' · CARRIED OVER' : ''}</li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Safety awareness</h3>
            <p className="mt-2 text-sm whitespace-pre-wrap">{handover.record.safety_awareness.trim() || 'No safety awareness note for this shift.'}</p>
          </section>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Shift production actuals</h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li><span className="font-black">ROM coal (tonnes):</span> {handover.record.shift_production.romCoal || '—'}</li>
              <li><span className="font-black">Prime overburden (BCMs):</span> {handover.record.shift_production.primeOverburden || '—'}</li>
              <li><span className="font-black">Major non-mechanical delays:</span> {handover.record.shift_production.delays || '—'}</li>
              <li><span className="font-black">Pit services:</span> {handover.record.services_status}{handover.record.services_notes ? ` — ${handover.record.services_notes}` : ''}</li>
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Statutory pit and OCE checks</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {checkLines.map((line) => (
                <li key={line.label}><span className="font-black">{line.label}:</span> {line.status}{line.notes ? ` — ${line.notes}` : ''}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Down fleet and workshop ETAs</h3>
            {downRows.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nothing is down in the workshop.</p> : (
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-[11px] font-black uppercase text-slate-500"><tr><th className="py-1 pr-2">Fleet</th><th className="py-1 pr-2">Make / Model</th><th className="py-1 pr-2">Priority</th><th className="py-1 pr-2">Down for</th><th className="py-1 pr-2">Hold</th><th className="py-1">Expected back up</th></tr></thead>
                <tbody>{downRows.map((row) => <tr key={row.fleetId} className="border-t border-slate-100"><td className="py-2 pr-2 font-black">{row.fleetId}</td><td className="py-2 pr-2">{row.makeModel}</td><td className="py-2 pr-2">{row.priority}</td><td className="py-2 pr-2">{row.reason}</td><td className="py-2 pr-2">{row.hold}</td><td className="py-2">{row.eta}</td></tr>)}</tbody>
              </table>
            )}
          </section>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Shift operator and equipment allocations</h3>
            {seats.length === 0 ? <p className="mt-2 text-sm text-slate-500">No production operators are on this crew.</p> : (
              <ul className="mt-2 space-y-1 text-sm">{seats.map((line) => <li key={line.key}><span className="font-black">{line.unit}</span> — {line.people}{line.location ? ` · ${line.location}` : ''}</li>)}</ul>
            )}
          </section>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Pit and production handover notes</h3>
            {notes.length === 0 ? <p className="mt-2 text-sm text-slate-500">No pit notes for this shift yet.</p> : (
              <ul className="mt-2 space-y-2">{notes.map((entry) => <li key={entry.id}><p className="text-sm text-slate-900 whitespace-pre-wrap">{entry.details}</p><p className="text-[11px] font-bold text-slate-400">{formatDateTime(entry.logged_at)}</p></li>)}</ul>
            )}
          </section>
          <section>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">OCE sign-off</h3>
            <p className="mt-2 text-sm"><span className="font-black">Outgoing:</span> {stamp(handover.record.outgoing_signed_by, handover.record.outgoing_signed_at)}</p>
            <p className="text-sm"><span className="font-black">Oncoming:</span> {stamp(handover.record.oncoming_signed_by, handover.record.oncoming_signed_at)}</p>
          </section>
          {handover.signedOff && (
            <HandoverAddendum handoverId={handover.handoverId} actorName={supervisorName || 'Supervisor'} canAdd={accessLevel >= 3} />
          )}
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Production shift</p>
        <h2 className="text-xl font-black text-slate-900">{clock.shiftName}</h2>
        <p className="text-sm font-bold text-slate-600">
          {clock.shiftName === 'Day Shift' ? '06:00–18:00' : '18:00–06:00'}
          <span className="text-slate-400"> • </span>
          {clock.timeRemaining}
          {activeShift?.crew ? <span> • {activeShift.crew}</span> : null}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowReport(true)} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-black inline-flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Generate Report
          </button>
          <button type="button" onClick={() => void exportDeck()} disabled={exporting} className="min-h-11 px-4 rounded-lg bg-amber-600 text-white text-sm font-black disabled:opacity-50 inline-flex items-center gap-1.5">
            <Presentation className="w-4 h-4" /> {exporting ? 'Building...' : 'Export PowerPoint'}
          </button>
        </div>
      </section>

      <ManagementDirectives actorName={supervisorName} department="production" />

      {handover.signedOff && (
        <p className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-black uppercase tracking-wide text-amber-950">STATUTORY RECORD LOCKED (SIGNED OFF)</p>
      )}
      {handover.error && <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">{handover.error}</p>}
      {!handover.ready ? <p className="text-sm font-bold text-slate-500">Loading handover...</p> : null}
      {handover.ready && <OceHandoverSections
        record={handover.record}
        crewGroup={crewGroup}
        supervisorName={supervisorName}
        onEdit={handover.edit}
        onSave={handover.save}
        onUpload={handover.uploadOceReport}
        onOpenReport={handover.openOceReport}
        statutoryLocked={handover.signedOff}
        handoverId={handover.handoverId}
        accessLevel={accessLevel}
      />}
      {handover.ready && <PitChecksCard
        shiftDate={shiftDate}
        shiftName={clock.shiftName}
        crewGroup={crewGroup}
        values={handover.record}
        carried={handover.record.carried_fields}
        onEdit={handover.edit}
        onCommit={handover.commitPit}
        locked={handover.signedOff}
      />}

      <section className="bg-white border border-slate-300 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Live down fleet and ETAs</h3>
        </div>
        {down.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Nothing is down in the workshop.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Fleet</th>
                  <th className="px-4 py-2">Down for</th>
                  <th className="px-4 py-2">Hold</th>
                  <th className="px-4 py-2">Expected back up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {down.map((asset) => {
                  const orders = workOrders.filter((order) => order.asset_id === asset.id && order.status !== 'COMPLETED');
                  const main = mainOpenJob(orders);
                  const event = getEventConfig(main?.order_type, asset.status === 'DOWN_PLANNED').label;
                  const hold = holdBadge(main?.stage, main?.hold_eta);
                  const status = main ? STAGE_THEMES[main.stage]?.label : null;
                  const etu = getEtuStatus(asset.expected_up, now);
                  const overdue = Boolean(etu?.overdue && orders.length > 0);
                  return (
                    <tr key={asset.id}>
                      <td className="px-4 py-3 font-black text-slate-900">
                        {asset.fleet_id}
                        {serviceDue(asset) ? <span className="ml-2"><StatutoryDueBadge /></span> : null}
                        <span className="block text-xs font-bold text-slate-500">{event}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {main?.task_description?.trim() || 'No fault logged.'}
                        {status && <span className="block text-xs font-bold text-slate-500">{status}</span>}
                      </td>
                      <td className="px-4 py-3 font-bold text-amber-800">{hold || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-black text-slate-900">{formatDateTime(asset.expected_up)}</span>
                        {overdue && (
                          <span className="ml-2 inline-flex rounded bg-red-600 px-2 py-0.5 text-[11px] font-black uppercase text-white">OVERDUE</span>
                        )}
                        {etu && !etu.overdue && (
                          <span className="ml-2 inline-flex rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-black uppercase text-emerald-800">{etu.label}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Shift operator allocations</h3>
        {seats.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No production operators are on this crew.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {seats.map((line) => (
              <li key={line.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-black text-slate-900">{line.unit}</span>
                <span className="text-slate-700"> — {line.people}</span>
                {line.location && <span className="text-slate-500"> · {line.location}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Pit and production handover notes</h3>
          <p className="text-sm text-slate-500">Dig-face priorities, dump and ramp conditions, weather or blast delays, and what the oncoming shift needs to do.</p>
        </div>
        <label className="block space-y-1">
          <span className="sr-only">Handover note</span>
          <textarea
            value={note.value}
            onChange={note.onChange}
            rows={4}
            readOnly={handover.signedOff}
            placeholder="Dig face, dumps, ramps, weather, blast delays, oncoming actions..."
            className="w-full rounded-lg border-2 border-slate-300 bg-slate-50 px-3 py-2 text-base text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white read-only:bg-slate-100"
          />
        </label>
        {!handover.signedOff && <div className="flex flex-wrap items-center gap-2">
          <DictationMicButton {...note.mic} />
          <TidyNotesButton
            rawNotes={note.value}
            isSingleNote
            prepare={() => note.hold()}
            onTidied={(text) => note.setValue(text)}
          />
          <button
            type="button"
            onClick={() => void saveNote()}
            disabled={saving || !note.value.trim()}
            className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-black disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save note'}
          </button>
        </div>}
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">No pit notes for this shift yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm text-slate-900 whitespace-pre-wrap">{entry.details}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-400">{formatDateTime(entry.logged_at)}</span>
                  {!handover.signedOff && <button type="button" onClick={() => void removeNote(entry.id)} className="text-xs font-bold text-rose-700">Remove</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {handover.ready && <OceHandoverSections
        part="signoff"
        record={handover.record}
        crewGroup={crewGroup}
        supervisorName={supervisorName}
        onEdit={handover.edit}
        onSave={handover.save}
        onUpload={handover.uploadOceReport}
        onOpenReport={handover.openOceReport}
        statutoryLocked={handover.signedOff}
        handoverId={handover.handoverId}
        accessLevel={accessLevel}
      />}
    </div>
  );
}
