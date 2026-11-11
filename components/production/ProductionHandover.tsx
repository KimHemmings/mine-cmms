'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Plus, Presentation, Printer, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import {
  Asset,
  CrewMember,
  Authorisation,
  CrewAuthorisation,
  CrewSupervision,
  OceReport,
  PRODUCTION_PLANT,
  ProductionDelay,
  ProductionHandoverDocument,
  SafetyIncident,
  ShiftMachineOperator,
  ShiftRecord,
} from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { normalizeOceBriefing } from '@/utils/oce';
import { siteCover } from '@/utils/crewStanding';
import { generateProductionHandoverPptx } from '@/utils/productionHandoverPptx';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import SafetyBriefingFields from '@/components/handover/SafetyBriefingFields';
import OceReportPanel from '@/components/handover/OceReportPanel';
import ProductionHandoverView from './ProductionHandoverView';
import RecordTrail from '@/components/training/RecordTrail';

interface SavedProductionHandover {
  id: string;
  shift_id: string;
  shift_name: string;
  shift_date: string | null;
  crew: string | null;
  supervisor: string | null;
  document: ProductionHandoverDocument;
  saved_at: string;
  saved_by: string | null;
}

function normalizeDocument(document: Partial<ProductionHandoverDocument> | null | undefined): ProductionHandoverDocument {
  return {
    summary: document?.summary ?? null,
    delays: document?.delays ?? [],
    safetyIncidents: document?.safetyIncidents ?? [],
    safetyFocus: document?.safetyFocus ?? null,
    oce: document?.oce
      ? { fileName: document.oce.fileName ?? null, briefing: normalizeOceBriefing(document.oce.briefing) }
      : null,
    inTraining: document?.inTraining ?? [],
    ertOnSite: document?.ertOnSite ?? [],
    assessorsOnSite: document?.assessorsOnSite ?? [],
    allocations: document?.allocations ?? [],
    notCrewed: document?.notCrewed ?? [],
    inWorkshop: document?.inWorkshop ?? [],
  };
}

export default function ProductionHandover({
  activeShift,
  machines,
  crew,
  allocations,
  supervision,
  authorisations,
  holdings,
}: {
  activeShift: ShiftRecord | null;
  machines: Asset[];
  crew: CrewMember[];
  allocations: ShiftMachineOperator[];
  supervision: CrewSupervision[];
  authorisations: Authorisation[];
  holdings: CrewAuthorisation[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<'current' | 'history'>('current');
  const [opened, setOpened] = useState<SavedProductionHandover | null>(null);
  const [saved, setSaved] = useState<SavedProductionHandover[]>([]);
  const [summary, setSummary] = useState('');
  const [delays, setDelays] = useState<ProductionDelay[]>([]);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [safetyFocus, setSafetyFocus] = useState('');
  const [oceReport, setOceReport] = useState<OceReport | null>(null);
  const loadedFor = useRef<string | null>(null);

  const plant = machines.filter((asset) => (PRODUCTION_PLANT as readonly string[]).includes(asset.asset_type));
  const shiftAllocations = allocations.filter((row) => row.shift_id === activeShift?.id);
  const crewed = plant.flatMap((asset) => {
    const row = shiftAllocations.find((item) => item.asset_id === asset.id);
    const person = crew.find((member) => member.id === row?.crew_member_id);
    if (!person) return [];
    return [{ fleetId: asset.fleet_id, machine: asset.make_model, operator: person.display_name, location: asset.location || '' }];
  });
  const notCrewed = plant
    .filter((asset) => asset.status === 'OPERATIONAL' && !asset.in_shift && !shiftAllocations.some((row) => row.asset_id === asset.id))
    .map((asset) => ({ fleetId: asset.fleet_id, machine: asset.make_model, location: asset.location || '' }));
  const onCrew = crew.filter((member) => member.active && member.department === 'Production' && (!activeShift?.crew || member.panel === activeShift.crew));
  const cover = siteCover(onCrew, supervision, authorisations, holdings, crew);
  const inWorkshop = plant
    .filter((asset) => asset.status !== 'OPERATIONAL')
    .map((asset) => ({ fleetId: asset.fleet_id, location: asset.location || '', expected: formatDateTime(asset.expected_up) }));

  const liveDocument: ProductionHandoverDocument = {
    summary: summary.trim() || null,
    delays: delays.filter((row) => row.reason.trim()),
    safetyIncidents: incidents.filter((row) => row.what.trim() || row.where.trim() || row.action.trim()),
    safetyFocus: safetyFocus.trim() || null,
    oce: oceReport ? { fileName: oceReport.file_name, briefing: oceReport.briefing } : null,
    inTraining: cover.inTraining,
    ertOnSite: cover.ertOnSite,
    assessorsOnSite: cover.assessorsOnSite,
    allocations: crewed,
    notCrewed,
    inWorkshop,
  };

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('production_handovers')
      .select('id, shift_id, shift_name, shift_date, crew, supervisor, document, saved_at, saved_by')
      .order('saved_at', { ascending: false });
    if (error) {
      console.error('Production handover load failed:', error.message);
      return;
    }
    const rows = ((data ?? []) as SavedProductionHandover[]).map((row) => ({
      ...row,
      document: normalizeDocument(row.document),
    }));
    setSaved(rows);
    const current = rows.find((row) => row.shift_id === activeShift?.id);
    if (current && loadedFor.current !== current.id) {
      loadedFor.current = current.id;
      setSummary(current.document.summary ?? '');
      setDelays(current.document.delays);
      setIncidents(current.document.safetyIncidents);
      setSafetyFocus(current.document.safetyFocus ?? '');
    }
  }, [supabase, activeShift?.id]);

  useEffect(() => {
    const first = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(first);
  }, [load]);

  async function save() {
    if (!activeShift) {
      showToast({ message: 'There is no active shift to save.', tone: 'error' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('production_handovers').upsert(
      {
        shift_id: activeShift.id,
        shift_name: activeShift.shift_name,
        shift_date: activeShift.shift_date,
        shift_type: activeShift.shift_type,
        crew: activeShift.crew,
        supervisor: activeShift.supervisor,
        document: liveDocument,
      },
      { onConflict: 'shift_id' },
    );
    setSaving(false);
    if (error) {
      showToast({ message: 'Could not save the handover.', tone: 'error' });
      return;
    }
    showToast({ message: 'Production handover saved' });
    await load();
  }

  async function download(document: ProductionHandoverDocument, shift: { shiftName: string; shiftDate: string | null; crew: string | null; supervisor: string | null }) {
    setExporting(true);
    try {
      await generateProductionHandoverPptx({ ...shift, document });
    } finally {
      setExporting(false);
    }
  }

  const currentSaved = saved.find((row) => row.shift_id === activeShift?.id) ?? null;
  const printModel = opened
    ? {
        shiftName: opened.shift_name,
        shiftDate: opened.shift_date,
        crew: opened.crew,
        supervisor: opened.supervisor,
        savedAt: opened.saved_at,
        savedBy: opened.saved_by,
        document: opened.document,
      }
    : {
        shiftName: activeShift?.shift_name || 'Active shift',
        shiftDate: activeShift?.shift_date ?? null,
        crew: activeShift?.crew ?? null,
        supervisor: activeShift?.supervisor ?? null,
        savedAt: currentSaved?.saved_at ?? null,
        savedBy: currentSaved?.saved_by ?? null,
        document: liveDocument,
      };
  const actionClass = 'min-h-11 px-4 rounded-xl text-sm font-bold flex items-center gap-1.5 disabled:opacity-50';

  return (
    <div>
      <div className="hidden print:block">
        <ProductionHandoverView {...printModel} />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:hidden space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-600" />
              <h2 className="text-xl font-black text-slate-900">Production handover</h2>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {activeShift ? `${activeShift.shift_name}${activeShift.crew ? ` · ${activeShift.crew}` : ''}` : 'No active shift'}
              {currentSaved ? ` · Last saved ${formatDateTime(currentSaved.saved_at)}` : ' · Not saved yet'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setOpened(null); setView('current'); }} className={`${actionClass} ${view === 'current' && !opened ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300'}`}>This shift</button>
            <button type="button" onClick={() => { setOpened(null); setView('history'); }} className={`${actionClass} ${view === 'history' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300'}`}>Past handovers ({saved.length})</button>
          </div>
        </div>

        {view === 'current' && !opened && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={saving} className={`${actionClass} bg-slate-900 text-white`}>{saving ? 'Saving...' : 'Save handover'}</button>
            <button type="button" onClick={() => window.print()} className={`${actionClass} bg-white border border-slate-300`}><Printer className="w-4 h-4" /> Save as PDF</button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void download(liveDocument, {
                shiftName: activeShift?.shift_name || 'Shift',
                shiftDate: activeShift?.shift_date ?? null,
                crew: activeShift?.crew ?? null,
                supervisor: activeShift?.supervisor ?? null,
              })}
              className={`${actionClass} bg-amber-600 text-white`}
            >
              <Presentation className="w-4 h-4" /> {exporting ? 'Building...' : 'Crew briefing'}
            </button>
          </div>
        )}

        {view === 'history' && !opened && (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
            {saved.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">No production handovers saved yet.</li>}
            {saved.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => setOpened(row)} className="w-full text-left px-3 py-3 hover:bg-slate-50">
                  <span className="font-bold">{row.shift_name}{row.crew ? ` · ${row.crew}` : ''}</span>
                  <span className="block text-xs text-slate-500">{formatDateTime(row.saved_at)}{row.saved_by ? ` · ${row.saved_by}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {opened && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setOpened(null)} className={`${actionClass} bg-white border border-slate-300`}>Back to history</button>
              <button type="button" onClick={() => window.print()} className={`${actionClass} bg-slate-900 text-white`}><Printer className="w-4 h-4" /> Save as PDF</button>
              <button
                type="button"
                disabled={exporting}
                onClick={() => void download(opened.document, {
                  shiftName: opened.shift_name,
                  shiftDate: opened.shift_date,
                  crew: opened.crew,
                  supervisor: opened.supervisor,
                })}
                className={`${actionClass} bg-amber-600 text-white`}
              >
                <Presentation className="w-4 h-4" /> {exporting ? 'Building...' : 'Crew briefing'}
              </button>
            </div>
            <ProductionHandoverView {...printModel} />
          </div>
        )}

        {view === 'current' && !opened && (
          <>
            <RecordTrail title="Earlier saves of this handover" tables={['production_handovers']} />
            <SafetyBriefingFields incidents={incidents} focus={safetyFocus} onIncidents={setIncidents} onFocus={setSafetyFocus} />
            <OceReportPanel shiftId={activeShift?.id ?? null} onChange={setOceReport} />
            <label className="block space-y-1">
              <span className="text-sm font-black text-slate-900">Shift briefing</span>
              <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} placeholder="What the oncoming crew needs in one pass" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Delays</h3>
                <button type="button" onClick={() => setDelays([...delays, { id: crypto.randomUUID(), fleetId: '', reason: '' }])} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add delay
                </button>
              </div>
              {delays.length === 0 ? <p className="text-sm text-slate-500">No delays recorded.</p> : (
                <ul className="space-y-2">
                  {delays.map((row) => (
                    <li key={row.id} className="grid gap-2 md:grid-cols-[8rem_1fr_auto]">
                      <input value={row.fleetId} onChange={(event) => setDelays(delays.map((item) => item.id === row.id ? { ...item, fleetId: event.target.value } : item))} placeholder="Unit" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold" />
                      <input value={row.reason} onChange={(event) => setDelays(delays.map((item) => item.id === row.id ? { ...item, reason: event.target.value } : item))} placeholder="What is holding it" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" />
                      <button type="button" onClick={() => setDelays(delays.filter((item) => item.id !== row.id))} className="min-h-11 px-3 rounded-lg border border-slate-300 text-slate-500" aria-label="Remove delay"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <ProductionHandoverView {...printModel} />
          </>
        )}
      </div>
    </div>
  );
}
