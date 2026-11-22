'use client';

import { useEffect, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import DictationMicButton, { useDictationTarget } from '@/components/ui/DictationMicButton';
import TidyNotesButton from '@/components/ui/TidyNotesButton';
import {
  HandoverIncident,
  HandoverRecord,
  HandoverTarp,
  INCIDENT_CATEGORIES,
  IncidentCategory,
  OCE_INSPECTION_STATUSES,
  SERVICE_STATUSES,
  TARP_LEVELS,
} from '@/utils/productionHandoverRecord';
import { formatDateTime } from '@/utils/helpers';
import HandoverAddendum from '@/components/production/HandoverAddendum';

function levelClass(level: string) {
  if (level === 'Level 3') return 'bg-rose-700 text-white border-rose-700';
  if (level === 'Level 2') return 'bg-orange-600 text-white border-orange-600';
  if (level === 'Level 1') return 'bg-amber-500 text-amber-950 border-amber-500';
  return 'bg-white text-slate-800 border-slate-300';
}

export default function OceHandoverSections({
  record,
  crewGroup,
  supervisorName,
  onEdit,
  onSave,
  onUpload,
  onOpenReport,
  part = 'fields',
  statutoryLocked = false,
  handoverId = null,
  accessLevel = 3,
}: {
  record: HandoverRecord;
  crewGroup: string | null;
  supervisorName: string;
  onEdit: (partial: Partial<HandoverRecord>) => void;
  onSave: (partial?: Partial<HandoverRecord>) => Promise<boolean>;
  onUpload: (file: File) => Promise<boolean>;
  onOpenReport: () => Promise<void>;
  part?: 'fields' | 'signoff';
  statutoryLocked?: boolean;
  handoverId?: string | null;
  accessLevel?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const safetyRef = useRef<HTMLTextAreaElement>(null);
  const safety = useDictationTarget();
  const incidentNote = useDictationTarget();
  const [category, setCategory] = useState<IncidentCategory>('Near Miss');
  const [location, setLocation] = useState('');
  const [openInvestigation, setOpenInvestigation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (document.activeElement === safetyRef.current) return;
    safety.setValue(record.safety_awareness || '');
    // setValue is recreated each render. Sync only when the saved note changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.safety_awareness]);

  const locked = !crewGroup || statutoryLocked;

  const addIncident = async () => {
    const summary = incidentNote.hold().trim();
    if (!location.trim() || !summary) return;
    const entry: HandoverIncident = {
      id: crypto.randomUUID(),
      category,
      location: location.trim(),
      summary,
      openInvestigation,
      carried: false,
    };
    const saved = await onSave({ incidents: [...record.incidents, entry] });
    if (!saved) return;
    setLocation('');
    setOpenInvestigation(false);
    setCategory('Near Miss');
    incidentNote.setValue('');
    setShowForm(false);
  };

  const setIncident = (id: string, patch: Partial<HandoverIncident>) => {
    const incidents = record.incidents.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      if (next.openInvestigation === false) next.carried = false;
      return next;
    });
    void onSave({ incidents });
  };

  const setTarp = (name: HandoverTarp['name'], patch: Partial<HandoverTarp>) => {
    const active_tarps = record.active_tarps.map((item) => {
      if (item.name !== name) return item;
      const next = { ...item, ...patch };
      if (next.level === 'Normal') next.carried = false;
      return next;
    });
    if (patch.note !== undefined && patch.level === undefined) onEdit({ active_tarps });
    else void onSave({ active_tarps });
  };

  const signoff = (
    <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-3">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Statutory Outgoing & Oncoming OCE Sign-Off</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3 space-y-2">
          <button type="button" disabled={locked || Boolean(record.outgoing_signed_at)} onClick={() => void onSave({ outgoing_signed_by: supervisorName || 'Production Supervisor', outgoing_signed_at: new Date().toISOString() })} className="min-h-11 w-full rounded-lg bg-slate-900 text-white text-sm font-black disabled:opacity-50">Sign Off as Outgoing Supervisor / OCE</button>
          <p className="text-sm font-bold text-slate-700">{record.outgoing_signed_by ? `${record.outgoing_signed_by} · ${formatDateTime(record.outgoing_signed_at)}` : 'Not signed'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 space-y-2">
          <button type="button" disabled={locked || Boolean(record.oncoming_signed_at)} onClick={() => void onSave({ oncoming_signed_by: supervisorName || 'Production Supervisor', oncoming_signed_at: new Date().toISOString() })} className="min-h-11 w-full rounded-lg bg-amber-600 text-white text-sm font-black disabled:opacity-50">Acknowledge as Oncoming Supervisor / OCE</button>
          <p className="text-sm font-bold text-slate-700">{record.oncoming_signed_by ? `${record.oncoming_signed_by} · ${formatDateTime(record.oncoming_signed_at)}` : 'Not signed'}</p>
        </div>
      </div>
      {statutoryLocked && (
        <HandoverAddendum handoverId={handoverId} actorName={supervisorName || 'Supervisor'} canAdd={accessLevel >= 3} />
      )}
    </section>
  );

  if (part === 'signoff') return signoff;

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">OCE Statutory Inspection Report</h3>
          <p className="text-sm text-slate-500">Upload the inspection PDF or photo, or record that the hardcopy is in the tray.</p>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Inspection status</span>
          <select
            value={record.oce_inspection_status}
            disabled={locked}
            onChange={(event) => void onSave({ oce_inspection_status: event.target.value })}
            className="w-full min-h-11 rounded-lg border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-900"
          >
            {OCE_INSPECTION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setUploading(true);
            void onUpload(file).finally(() => setUploading(false));
          }}
        />
        {record.oce_report_filename ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <p className="text-sm font-black text-slate-900">{record.oce_report_filename}</p>
            <p className="text-xs font-bold text-slate-500">{record.oce_report_uploaded_at ? formatDateTime(record.oce_report_uploaded_at) : 'Uploaded'}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void onOpenReport()} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-black">View / Download OCE Report</button>
              <button type="button" disabled={locked || uploading} onClick={() => fileRef.current?.click()} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-black text-slate-800 disabled:opacity-50">{uploading ? 'Uploading...' : 'Replace'}</button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={locked || uploading} onClick={() => fileRef.current?.click()} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-black inline-flex items-center gap-2 disabled:opacity-50">
            <FileUp className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload OCE report'}
          </button>
        )}
      </section>

      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Incidents, Near Misses & HPIs</h3>
          <button type="button" disabled={locked} onClick={() => setShowForm((open) => !open)} className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-black text-slate-800 disabled:opacity-50">+ Log Incident / Near Miss</button>
        </div>
        {showForm && !locked && (
          <div className="rounded-lg border border-slate-200 p-3 space-y-2">
            <select value={category} onChange={(event) => setCategory(event.target.value as IncidentCategory)} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-sm font-bold">
              {INCIDENT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Unit / Pit Location, e.g. RD-104 / North Ramp" className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-sm" />
            <textarea value={incidentNote.value} onChange={incidentNote.onChange} rows={3} placeholder="Summary and immediate action" className="w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-sm" />
            <div className="flex flex-wrap items-center gap-2">
              <DictationMicButton {...incidentNote.mic} />
              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
                <input type="checkbox" checked={openInvestigation} onChange={(event) => setOpenInvestigation(event.target.checked)} className="h-4 w-4" />
                Open Investigation / Scene Preserved
              </label>
              <button type="button" onClick={() => void addIncident()} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-black">Add to handover</button>
            </div>
          </div>
        )}
        {record.incidents.length === 0 ? <p className="text-sm text-slate-500">No incidents logged for this shift.</p> : (
          <ul className="space-y-2">
            {record.incidents.map((item) => {
              const hpi = item.category.startsWith('HPI');
              return (
                <li key={item.id} className={`rounded-lg border p-3 ${hpi || item.openInvestigation ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${hpi ? 'bg-rose-700 text-white' : 'bg-slate-900 text-white'}`}>{item.category}</span>
                    {item.openInvestigation && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase text-amber-950">Open Investigation</span>}
                    {item.carried && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">CARRIED OVER</span>}
                  </div>
                  <p className="mt-2 text-sm font-black text-slate-900">{item.location || 'Location not set'}</p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{item.summary}</p>
                  <button type="button" disabled={locked} onClick={() => setIncident(item.id, { openInvestigation: !item.openInvestigation })} className="mt-2 min-h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-black text-slate-800 disabled:opacity-50">
                    {item.openInvestigation ? 'Mark investigation closed' : 'Reopen investigation'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Safety Awareness & Oncoming Muster Focus</h3>
          <p className="text-sm text-slate-500">This note prints in a callout on the Production Pre-Start Sign-On Sheet.</p>
        </div>
        <textarea
          ref={safetyRef}
          value={safety.value}
          onChange={safety.onChange}
          onBlur={() => void onSave({ safety_awareness: safety.hold() })}
          rows={4}
          disabled={locked}
          placeholder="Fatigue, heat, traffic changes, or the focus for the oncoming pre-start..."
          className="w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
        />
        {!locked && <div className="flex flex-wrap items-center gap-2">
          <DictationMicButton {...safety.mic} />
          <TidyNotesButton
            rawNotes={safety.value}
            isSingleNote
            prepare={() => safety.hold()}
            onTidied={(text) => {
              safety.setValue(text);
              void onSave({ safety_awareness: text });
            }}
          />
        </div>}
      </section>

      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Active TARPs</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {record.active_tarps.map((tarp) => (
            <div key={tarp.name} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-slate-900">{tarp.name}</p>
                {tarp.carried && tarp.level !== 'Normal' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">CARRIED OVER</span>}
              </div>
              <select
                value={tarp.level}
                disabled={locked}
                onChange={(event) => setTarp(tarp.name, { level: event.target.value as HandoverTarp['level'] })}
                className={`min-h-11 w-full rounded-lg border-2 px-2 text-sm font-black ${levelClass(tarp.level)}`}
              >
                {TARP_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
              <input
                value={tarp.note}
                disabled={locked}
                onChange={(event) => setTarp(tarp.name, { note: event.target.value })}
                onBlur={(event) => void onSave({ active_tarps: record.active_tarps.map((item) => item.name === tarp.name ? { ...item, note: event.target.value } : item) })}
                placeholder="Trigger note"
                className="min-h-11 w-full rounded-lg border-2 border-slate-300 px-3 text-sm"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Shift Production Actuals & Pit Services</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">ROM Coal (Tonnes)</span>
            <input value={record.shift_production.romCoal} disabled={locked} onChange={(event) => onEdit({ shift_production: { ...record.shift_production, romCoal: event.target.value } })} onBlur={() => void onSave()} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">Prime Overburden (BCMs)</span>
            <input value={record.shift_production.primeOverburden} disabled={locked} onChange={(event) => onEdit({ shift_production: { ...record.shift_production, primeOverburden: event.target.value } })} onBlur={() => void onSave()} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-sm" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Major Non-Mechanical Delays</span>
          <input value={record.shift_production.delays} disabled={locked} onChange={(event) => onEdit({ shift_production: { ...record.shift_production, delays: event.target.value } })} onBlur={() => void onSave()} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-sm" />
        </label>
        <div className="grid gap-3 md:grid-cols-[0.8fr_1.4fr]">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">Pit Services (Water Fill / Comms / Fuel)</span>
            <select value={record.services_status} disabled={locked} onChange={(event) => void onSave({ services_status: event.target.value })} className="w-full min-h-11 rounded-lg border-2 border-slate-300 bg-white px-2 text-sm font-bold">
              {SERVICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">Services notes</span>
            <input value={record.services_notes} disabled={locked} onChange={(event) => onEdit({ services_notes: event.target.value })} onBlur={(event) => void onSave({ services_notes: event.target.value })} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-sm" />
          </label>
        </div>
      </section>

    </div>
  );
}
