'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Printer, Presentation, RotateCw,
} from 'lucide-react';
import { 
  Asset, 
  MachineWorkOrder, 
  DefectItem, 
  ShiftRecord, 
  HistoryNote, 
  HandoverLogEntry, 
  HandoverLogCategory 
} from '@/types';
import AiHandoverDigest from './handover/AiHandoverDigest';
import ShiftHandoverLog from './handover/ShiftHandoverLog';
import HandoverDocumentView from './handover/HandoverDocumentView';
import HandoverHistory from './handover/HandoverHistory';
import BriefingSlides from './handover/BriefingSlides';
import SafetyBriefingFields from './handover/SafetyBriefingFields';
import OceReportPanel from './handover/OceReportPanel';
import RecordTrail from './training/RecordTrail';
import { formatDateTime } from '@/utils/helpers';
import { formatStartDay, shiftIsPast } from '@/utils/crewStanding';
import { generateHandoverPptx } from '@/utils/handoverPptx';
import { buildHandoverSnapshot, normalizeHandoverDocument } from '@/utils/handoverDocument';
import { CREW_PANELS, HandoverMachineNote, HandoverManning, HandoverSlide, OceReport, SafetyIncident, SavedHandover } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import IncomingCrewDialog from './crew/IncomingCrewDialog';
import { useCrewData } from './crew/CrewDataContext';
import { siteCover } from '@/utils/crewStanding';
import { IncomingCrewPicker } from './handover/IncomingCrewPicker';
import { inWindow, windowFor } from '@/utils/shiftClock';
import { isWorkshopHandoverMember, workshopHandoverManning, workshopSigners } from '@/utils/workshopHandover';
import { fallbackMachineSummaries, HandoverAiMachineContext } from '@/utils/handoverMachineSummaries';

const LOG_CATEGORIES: HandoverLogCategory[] = [
  'SAFETY', 'WEATHER', 'MANNING', 'WATCHLIST', 'BRAKE_TEST', 'TOOLING', 'PRIORITY',
];

interface HandoverReportTabProps {
  activeShift: ShiftRecord | null;
  shiftJobs: Asset[];
  completedJobs: Asset[];
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  notes: HistoryNote[];
  assets: Asset[];
  handoverLog: HandoverLogEntry[];
  loading: boolean;
  onRefresh: () => void;
  onRolloverShift: (nextCrew?: string) => Promise<boolean>;
  readOnly?: boolean;
  accessLevel?: number;
  homeCrew?: string | null;
  coveringCrew?: string | null;
}

function isLogCategory(value: unknown): value is HandoverLogCategory {
  return typeof value === 'string' && LOG_CATEGORIES.includes(value as HandoverLogCategory);
}

function readBrowserLog(storageKey: string): HandoverLogEntry[] {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((entry) => isLogCategory(entry?.category) && entry?.details);
    }
    const legacyWatch = localStorage.getItem('mine_cmms_watchlist');
    if (!legacyWatch) return [];
    const parsed = JSON.parse(legacyWatch);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.issue_description)
      .map((item) => ({
        id: crypto.randomUUID(),
        category: 'WATCHLIST' as const,
        fleet_id: item.fleet_id,
        details: item.issue_description,
        action_required: item.inspection_action || undefined,
        logged_at: new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export default function HandoverReportTab({
  activeShift,
  shiftJobs,
  completedJobs,
  workOrders,
  defects,
  notes,
  assets,
  handoverLog,
  loading,
  onRefresh,
  onRolloverShift,
  readOnly = false,
  accessLevel = 2,
  homeCrew = null,
  coveringCrew = null,
}: HandoverReportTabProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRollover, setShowRollover] = useState(false);
  const [view, setView] = useState<'current' | 'history'>('current');
  const [reportWindow, setReportWindow] = useState<'12h' | '24h'>('12h');
  const [opened, setOpened] = useState<SavedHandover | null>(null);
  const [handovers, setHandovers] = useState<SavedHandover[]>([]);
  const [slides, setSlides] = useState<HandoverSlide[]>([]);
  const [summary, setSummary] = useState('');
  const [machineNotes, setMachineNotes] = useState<HandoverMachineNote[]>([]);
  const [machineSummaries, setMachineSummaries] = useState<Record<string, string[]>>({});
  const [aiRefreshRequest, setAiRefreshRequest] = useState(0);
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [safetyFocus, setSafetyFocus] = useState('');
  const [oceReport, setOceReport] = useState<OceReport | null>(null);
  const importedShift = React.useRef<string | null>(null);
  const slidesLoadedFor = React.useRef<string | null>(null);

  const supabase = React.useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const { crew, onShiftIds, authorisations, holdings, supervision } = useCrewData();
  const workshopCrew = crew.filter((member) => isWorkshopHandoverMember(member));
  const cover = siteCover(
    workshopCrew.filter((member) => onShiftIds.has(member.id)),
    supervision,
    authorisations,
    holdings,
    workshopCrew,
  );
  const [incomingPanel, setIncomingPanel] = useState<string | null>(null);
  const [outgoingId, setOutgoingId] = useState('');
  const [oncomingId, setOncomingId] = useState('');
  const [choiceShiftId, setChoiceShiftId] = useState<string | null>(null);
  const supervisorName = activeShift?.supervisor || 'Workshop Management';
  const handedOver = shiftJobs.filter((asset) => asset.in_shift && asset.status !== 'OPERATIONAL');
  const currentSaved = handovers.find((handover) => handover.shift_id === activeShift?.id) ?? null;

  const bounds = windowFor(reportWindow);
  const inReport = (iso?: string | null) => inWindow(iso, bounds.start, bounds.end);
  const windowedLog = handoverLog.filter((entry) => inReport(entry.logged_at) && entry.department !== 'production' && entry.department !== 'training');
  const shiftLog = handoverLog.filter((entry) =>
    entry.department !== 'production'
    && entry.department !== 'training'
    && (!activeShift?.started_at || entry.logged_at >= activeShift.started_at)
  );
  const windowedReleased = completedJobs.filter((asset) => inReport(asset.actual_up));
  const viewedPanel = incomingPanel ?? activeShift?.crew ?? null;
  const manning = useMemo(
    () => workshopHandoverManning(crew, viewedPanel, workOrders, assets),
    [crew, viewedPanel, workOrders, assets],
  );
  const crewCounts = useMemo(
    () => CREW_PANELS.map((panel) => ({ panel, count: workshopHandoverManning(crew, panel, workOrders, assets).onShift.length })),
    [crew, workOrders, assets],
  );
  const signers = useMemo(() => workshopSigners(crew), [crew]);
  const outgoingSigner = signers.find((person) => person.id === outgoingId)?.name ?? null;
  const oncomingSigner = signers.find((person) => person.id === oncomingId)?.name ?? null;
  const reliefSuffix = coveringCrew && homeCrew && coveringCrew !== homeCrew
    ? ` (Relief Coverage — Home: ${homeCrew})`
    : '';
  const manningRecord: HandoverManning = {
    panel: manning.panel,
    onShift: manning.onShift.map((person) => person.name),
    away: manning.away.map((person) => person.name),
    overtime: manning.overtime.map((person) => person.name),
    unallocated: manning.unallocated.map((person) => person.name),
    assigned: manning.assigned.map((person) => `${person.name} — ${person.detail}`),
    outgoing: outgoingSigner ? `${outgoingSigner}${reliefSuffix}` : null,
    oncoming: oncomingSigner ? `${oncomingSigner}${reliefSuffix}` : null,
  };
  const fallbackMachines: HandoverAiMachineContext[] = [...handedOver, ...windowedReleased]
    .filter((asset, index, list) => list.findIndex((candidate) => candidate.id === asset.id) === index)
    .map((asset) => {
      const released = windowedReleased.some((candidate) => candidate.id === asset.id);
      return {
        machine_id: asset.id,
        fleet_id: asset.fleet_id,
        model: asset.make_model,
        priority: asset.priority ?? 'P3',
        expected_up: asset.expected_up,
        status: released ? 'RELEASED' : 'DOWN',
        jobs: [],
        parts: [],
        shift_notes: notes
          .filter((note) => note.asset_id === asset.id
            && (!activeShift?.started_at || note.created_at >= activeShift.started_at))
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((note) => ({ at: note.created_at, by: note.fitter_name ?? '', note: note.note })),
        updates: shiftLog
          .filter((entry) => entry.fleet_id?.trim().toUpperCase() === asset.fleet_id.toUpperCase())
          .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
          .map((entry) => ({
            at: entry.logged_at,
            category: entry.category,
            details: entry.details,
            action_required: entry.action_required ?? null,
          })),
      };
    });
  const fallbackSummaries = fallbackMachineSummaries(fallbackMachines);
  const populatedMachineSummaries = Object.fromEntries(
    fallbackMachines.map(({ machine_id }) => [
      machine_id,
      machineSummaries[machine_id]?.length ? machineSummaries[machine_id] : fallbackSummaries[machine_id],
    ]),
  );
  const liveSnapshot = buildHandoverSnapshot({
    assets,
    handedOver,
    released: windowedReleased,
    workOrders,
    defects,
    log: shiftLog,
    notes,
    shiftId: activeShift?.id ?? null,
    shiftStartedAt: activeShift?.started_at ?? null,
    summary,
    machineNotes,
    machine_summaries: populatedMachineSummaries,
    customSlides: slides,
    crew: workshopCrew,
    incomingPanel,
    manning: manningRecord,
    safetyIncidents: incidents,
    safetyFocus,
    oce: oceReport ? { fileName: oceReport.file_name, briefing: oceReport.briefing } : null,
    inTraining: cover.inTraining,
    ertOnSite: cover.ertOnSite,
    assessorsOnSite: cover.assessorsOnSite,
  });

  const loadHandovers = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('shift_handovers')
      .select('id, shift_id, shift_name, shift_date, shift_type, crew, supervisor, document, saved_at, saved_by')
      .order('saved_at', { ascending: false });
    if (error) {
      console.error('Handover history load failed:', error.message);
      return;
    }
    const rows = ((data ?? []) as SavedHandover[]).map((handover) => ({
      ...handover,
      document: normalizeHandoverDocument(handover.document),
    }));
    setHandovers(rows);
    const savedForShift = rows.find((handover) => handover.shift_id === activeShift?.id);
    if (savedForShift && slidesLoadedFor.current !== savedForShift.id) {
      slidesLoadedFor.current = savedForShift.id;
      setSlides(savedForShift.document.customSlides ?? []);
      setSummary(savedForShift.document.summary ?? '');
      setMachineNotes(savedForShift.document.machineNotes ?? []);
      setMachineSummaries(savedForShift.document.machine_summaries ?? {});
      setIncidents(savedForShift.document.safetyIncidents ?? []);
      setSafetyFocus(savedForShift.document.safetyFocus ?? '');
    }
  }, [supabase, activeShift?.id]);

  useEffect(() => {
    const channel = supabase
      .channel('shift-handovers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_handovers' }, () => {
        void loadHandovers();
      })
      .subscribe();
    const firstLoad = setTimeout(() => { void loadHandovers(); }, 0);
    return () => {
      clearTimeout(firstLoad);
      supabase.removeChannel(channel);
    };
  }, [loadHandovers, supabase]);

  const shiftId = activeShift?.id ?? null;
  const shiftType = activeShift?.shift_type;
  const [trackedShiftId, setTrackedShiftId] = useState(shiftId);
  if (shiftId !== trackedShiftId) {
    setTrackedShiftId(shiftId);
    setChoiceShiftId(null);
    setIncomingPanel(null);
    setOutgoingId('');
    setOncomingId('');
    setSummary('');
    setMachineNotes([]);
    setMachineSummaries({});
  }

  useEffect(() => {
    if (!shiftId || !shiftType || choiceShiftId === shiftId) return;
    let cancelled = false;
    const nextType = shiftType === 'DAY' ? 'NIGHT' : 'DAY';
    supabase
      .from('shift_records')
      .select('crew')
      .eq('shift_type', nextType)
      .neq('id', shiftId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ crew: string | null }>()
      .then(({ data }) => {
        if (!cancelled && data?.crew) setIncomingPanel(data.crew);
      });
    return () => {
      cancelled = true;
    };
  }, [shiftId, shiftType, choiceShiftId, supabase]);

  const saveHandover = async () => {
    if (!activeShift?.id) {
      alert('There is no active shift to save.');
      return false;
    }
    setSaving(true);
    const { error } = await supabase.from('shift_handovers').upsert(
      {
        shift_id: activeShift.id,
        shift_name: activeShift.shift_name,
        shift_date: activeShift.shift_date,
        shift_type: activeShift.shift_type,
        crew: activeShift.crew,
        supervisor: supervisorName,
        document: liveSnapshot,
      },
      { onConflict: 'shift_id' }
    );
    setSaving(false);
    if (error) {
      alert(`Couldn't save the handover: ${error.message}`);
      return false;
    }
    showToast({ message: 'Handover saved for all supervisors' });
    await loadHandovers();
    return true;
  };

  const exportBriefing = async (handover: { shiftName: string; shiftDate: string | null; crew: string | null; supervisor: string | null; document: typeof liveSnapshot }) => {
    setIsExporting(true);
    try {
      await generateHandoverPptx({
        shiftName: handover.shiftName,
        shiftDate: handover.shiftDate,
        crew: handover.crew,
        supervisor: handover.supervisor,
        document: handover.document,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // One-time copy of a log that was only saved in this browser.
  useEffect(() => {
    const shiftId = activeShift?.id;
    if (!shiftId || loading || importedShift.current === shiftId) return;
    importedShift.current = shiftId;

    const storageKey = `mine_cmms_handover_log_${shiftId}`;
    if (handoverLog.length > 0) {
      localStorage.removeItem(storageKey);
      return;
    }

    const imported = readBrowserLog(storageKey);
    if (imported.length === 0) return;

    supabase
      .from('handover_log_entries')
      .insert(
        imported.map((entry) => ({
          shift_id: shiftId,
          category: entry.category,
          fleet_id: entry.fleet_id || null,
          details: entry.details.trim(),
          action_required: entry.action_required?.trim() || null,
        }))
      )
      .then(({ error }) => {
        if (error) {
          importedShift.current = null;
          console.error('Handover log import failed:', error.message);
          return;
        }
        localStorage.removeItem(storageKey);
        localStorage.removeItem('mine_cmms_watchlist');
        onRefresh();
      });
  }, [activeShift?.id, handoverLog.length, loading, onRefresh, supabase]);

  const handleAddLogEntry = async (entry: Omit<HandoverLogEntry, 'id' | 'logged_at'>) => {
    if (!activeShift?.id) {
      alert('There is no active shift to log against.');
      return false;
    }
    const { error } = await supabase.from('handover_log_entries').insert({
      shift_id: activeShift.id,
      category: entry.category,
      fleet_id: entry.fleet_id || null,
      details: entry.details.trim(),
      action_required: entry.action_required?.trim() || null,
    });
    if (error) {
      alert(`Couldn't save that entry: ${error.message}`);
      return false;
    }
    showToast({ message: 'Handover entry saved' });
    onRefresh();
    return true;
  };

  const handleUpdateCategory = async (id: string, newCategory: HandoverLogCategory) => {
    const { error } = await supabase.from('handover_log_entries').update({ category: newCategory }).eq('id', id);
    if (error) return alert(`Couldn't update that entry: ${error.message}`);
    onRefresh();
  };

  const handleDeleteLogEntry = async (id: string) => {
    const { error } = await supabase.from('handover_log_entries').delete().eq('id', id);
    if (error) return alert(`Couldn't remove that entry: ${error.message}`);
    showToast({ message: 'Entry removed' });
    onRefresh();
  };

  const handleFinalizeAndRoll = async (nextCrew: string) => {
    const saved = await saveHandover();
    if (!saved) return;
    const ok = await onRolloverShift(nextCrew);
    if (ok) setShowRollover(false);
  };

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
        supervisor: supervisorName,
        savedAt: currentSaved?.saved_at ?? null,
        savedBy: currentSaved?.saved_by ?? null,
        document: liveSnapshot,
      };

  const actionClass = 'min-h-11 px-4 rounded-xl text-sm font-bold flex items-center gap-1.5 disabled:opacity-50';

  return (
    <div className="font-sans">
      <div className="hidden print:block">
        <HandoverDocumentView {...printModel} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:hidden">
      
      {/* Handover Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-200 gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-black text-slate-900">Shift handover</h2>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            <strong>{activeShift?.shift_name}{activeShift?.crew ? ` · ${activeShift.crew}` : ''}</strong>
            {' · '}{supervisorName}
            {currentSaved ? ` · Last saved ${formatDateTime(currentSaved.saved_at)}` : ' · Not saved yet'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 p-1" role="group" aria-label="Handover window">
            <button type="button" onClick={() => setReportWindow('12h')} aria-pressed={reportWindow === '12h'} className={`min-h-9 px-3 rounded-full text-xs font-black ${reportWindow === '12h' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}>
              Current 12h Shift
            </button>
            <button type="button" onClick={() => setReportWindow('24h')} aria-pressed={reportWindow === '24h'} className={`min-h-9 px-3 rounded-full text-xs font-black ${reportWindow === '24h' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}>
              Last 24 Hours
            </button>
          </div>
          <button type="button" onClick={() => { setOpened(null); setView('current'); }} className={`${actionClass} ${view === 'current' && !opened ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>
            This shift
          </button>
          <button type="button" onClick={() => { setOpened(null); setView('history'); }} className={`${actionClass} ${view === 'history' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>
            Past handovers ({handovers.length})
          </button>
          {accessLevel >= 3 && (
            <button type="button" onClick={() => window.print()} className={`${actionClass} bg-slate-900 text-white`}>
              <Printer className="w-4 h-4" /> Print Handover
            </button>
          )}
        </div>
      </div>

      {view === 'current' && !opened && !readOnly && (
        <div className="sticky top-0 z-10 bg-white py-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveHandover} disabled={saving} className={`${actionClass} bg-emerald-600 text-white`}>
              {saving ? 'Saving...' : 'Save handover'}
            </button>
            <button type="button" onClick={() => setShowRollover(true)} className={`${actionClass} border-2 border-slate-900 bg-white text-slate-900`}>
              <RotateCw className="w-4 h-4" /> Finish shift
            </button>
          </div>
          <p className="text-sm text-slate-600">Save the handover, then finish the shift for the crew coming on.</p>
        </div>
      )}
      {opened && (
      <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpened(null)} className={`${actionClass} bg-white border border-slate-300 text-slate-800`}>
              Back to history
            </button>
            <button type="button" onClick={() => window.print()} className={`${actionClass} bg-slate-900 text-white`}>
              <Printer className="w-4 h-4" /> Save as PDF
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => exportBriefing({
                shiftName: opened.shift_name,
                shiftDate: opened.shift_date,
                crew: opened.crew,
                supervisor: opened.supervisor,
                document: opened.document,
              })}
              className={`${actionClass} bg-amber-600 text-white`}
            >
              <Presentation className="w-4 h-4" /> {isExporting ? 'Building...' : 'Crew briefing'}
            </button>
      </div>
      )}

      {view === 'history' && !opened && (
        <div className="mt-4 space-y-4">
          <RecordTrail title="Earlier saves of this handover" tables={['shift_handovers']} />
          <HandoverHistory handovers={handovers} activeShiftId={activeShift?.id} onOpen={(handover) => { setOpened(handover); }} />
        </div>
      )}

      {opened && (
        <div className="mt-4">
          <HandoverDocumentView {...printModel} />
        </div>
      )}

      {view === 'current' && !opened && (
        <>
          <details className="mt-4 rounded-xl border border-slate-200 px-4 py-3">
            <summary className="text-sm font-black text-slate-800 cursor-pointer">Make the briefing</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => exportBriefing({
                  shiftName: activeShift?.shift_name || 'Active shift',
                  shiftDate: activeShift?.shift_date ?? null,
                  crew: activeShift?.crew ?? null,
                  supervisor: supervisorName,
                  document: liveSnapshot,
                })}
                className={`${actionClass} bg-amber-600 text-white`}
              >
                <Presentation className="w-4 h-4" /> {isExporting ? 'Building...' : incomingPanel ? `Briefing for ${incomingPanel}` : 'Crew briefing'}
              </button>
              <button type="button" onClick={() => window.print()} className={`${actionClass} bg-white border border-slate-300 text-slate-700`}>
                <Printer className="w-4 h-4" /> Save as PDF
              </button>
            </div>
            <div className="mt-4">
              <BriefingSlides slides={slides} onChange={setSlides} />
            </div>
          </details>
          {shiftIsPast(activeShift?.shift_date) && (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-950">
                This shift is still {formatStartDay(activeShift?.shift_date ?? '')}. Save the handover, then finish it so the next crew can start.
              </p>
            </div>
          )}
          <IncomingCrewPicker
            panel={incomingPanel}
            counts={crewCounts}
            onChange={(panel) => {
              setChoiceShiftId(shiftId);
              setIncomingPanel(panel);
            }}
          />

          <div className="mt-6 space-y-4">
            <SafetyBriefingFields incidents={incidents} focus={safetyFocus} onIncidents={setIncidents} onFocus={setSafetyFocus} />
            <OceReportPanel shiftId={activeShift?.id ?? null} onChange={setOceReport} />
          </div>

          <div className="mt-6">
            <HandoverDocumentView
              shiftName={activeShift?.shift_name || 'Active shift'}
              shiftDate={activeShift?.shift_date ?? null}
              crew={activeShift?.crew ?? null}
              supervisor={supervisorName}
              savedAt={currentSaved?.saved_at}
              savedBy={currentSaved?.saved_by}
              document={liveSnapshot}
              emptyCrewMessage="Choose the crew coming on. Their names and current jobs will show here."
            />
          </div>

          <div className="mt-6">
            <ShiftHandoverLog
              readOnly={readOnly}
              shiftDate={activeShift?.shift_date ?? null}
              shiftName={activeShift?.shift_name ?? null}
              department="workshop"
              entries={windowedLog}
              onAddEntry={handleAddLogEntry}
              onUpdateCategory={handleUpdateCategory}
              onDeleteEntry={handleDeleteLogEntry}
              manning={manningRecord}
              signers={signers}
              outgoingId={outgoingId}
              oncomingId={oncomingId}
              onOutgoing={setOutgoingId}
              onOncoming={setOncomingId}
              actorName={supervisorName}
              canPrint={accessLevel >= 3}
              aiNotesLoading={aiNotesLoading}
              homeCrew={homeCrew}
              coveringCrew={coveringCrew}
              onRefreshAiNotes={() => setAiRefreshRequest((request) => request + 1)}
            >
              <AiHandoverDigest
                activeShift={activeShift}
                shiftJobs={shiftJobs}
                completedJobs={windowedReleased}
                workOrders={workOrders}
                notes={notes}
                logEntries={shiftLog}
                crew={workshopCrew}
                summaryText={summary}
                machineSummaries={machineSummaries}
                generateRequest={aiRefreshRequest}
                onGeneratingChange={setAiNotesLoading}
                onMachineSummariesChange={setMachineSummaries}
                onSummaryGenerated={(text, summaries) => {
                  setSummary(text);
                  setMachineSummaries(summaries);
                  setMachineNotes([]);
                }}
              />
            </ShiftHandoverLog>
          </div>

        </>
      )}

      {showRollover && activeShift && (
        <IncomingCrewDialog
          activeShift={activeShift}
          openJobsCount={workOrders.filter((w) => w.status === 'OPEN').length}
          nextCrew={incomingPanel}
          onNextCrew={(panel) => {
            setChoiceShiftId(shiftId);
            setIncomingPanel(panel);
          }}
          onCancel={() => setShowRollover(false)}
          onConfirm={handleFinalizeAndRoll}
        />
      )}
      </div>
    </div>
  );
}