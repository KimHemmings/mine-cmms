'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Printer, Presentation, Copy, Check, RotateCw,
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
import { formatDateTime } from '@/utils/helpers';
import { copyToClipboard } from '@/utils/sapFormatter';
import { generateHandoverPptx } from '@/utils/handoverPptx';
import { buildHandoverSnapshot, normalizeHandoverDocument, partStatusLabel } from '@/utils/handoverDocument';
import { HandoverMachineNote, HandoverSlide, SavedHandover } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import IncomingCrewDialog from './crew/IncomingCrewDialog';
import { useCrewData } from './crew/CrewDataContext';
import { IncomingCrewPicker } from './handover/IncomingCrewPicker';

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
}: HandoverReportTabProps) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRollover, setShowRollover] = useState(false);
  const [view, setView] = useState<'current' | 'history'>('current');
  const [opened, setOpened] = useState<SavedHandover | null>(null);
  const [handovers, setHandovers] = useState<SavedHandover[]>([]);
  const [slides, setSlides] = useState<HandoverSlide[]>([]);
  const [summary, setSummary] = useState('');
  const [machineNotes, setMachineNotes] = useState<HandoverMachineNote[]>([]);
  const importedShift = React.useRef<string | null>(null);
  const slidesLoadedFor = React.useRef<string | null>(null);

  const supabase = React.useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const { crew } = useCrewData();
  const [incomingPanel, setIncomingPanel] = useState<string | null>(null);
  const [choiceShiftId, setChoiceShiftId] = useState<string | null>(null);
  const supervisorName = activeShift?.supervisor || 'Workshop Management';
  const handedOver = shiftJobs.filter((asset) => asset.in_shift && asset.status !== 'OPERATIONAL');
  const currentSaved = handovers.find((handover) => handover.shift_id === activeShift?.id) ?? null;

  const liveSnapshot = buildHandoverSnapshot({
    assets,
    handedOver,
    released: completedJobs,
    workOrders,
    defects,
    log: handoverLog,
    shiftStartedAt: activeShift?.started_at ?? null,
    summary,
    machineNotes,
    customSlides: slides,
    crew,
    incomingPanel,
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
    if (!activeShift?.id) return alert('There is no active shift to log against.');
    const { error } = await supabase.from('handover_log_entries').insert({
      shift_id: activeShift.id,
      category: entry.category,
      fleet_id: entry.fleet_id || null,
      details: entry.details.trim(),
      action_required: entry.action_required?.trim() || null,
    });
    if (error) return alert(`Couldn't save that entry: ${error.message}`);
    showToast({ message: 'Handover entry saved' });
    onRefresh();
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

  async function handleCopyAllForSap() {
    let report = `================================================================================\n`;
    report += `SHIFT: ${activeShift?.shift_name || 'Active Shift'} | DATE: ${new Date().toLocaleDateString()}\n`;
    report += `SUPERVISOR: ${supervisorName}\n================================================================================\n\n`;
    report += `PREPARED FOR: ${incomingPanel || 'Crew not chosen'}\n\n`;
    report += `1. UNITS HANDED OVER TO INCOMING SHIFT:\n`;
    handedOver.forEach((a) => {
      const orders = workOrders.filter((w) => w.asset_id === a.id);
      report += `\n[${a.priority || 'ROUTINE'}] ${a.fleet_id} (${a.make_model}) - Bay: ${a.location || 'Workshop'}\n`;
      orders.forEach((w) => {
        report += `  • [${w.status}] WO: ${w.wo_number || 'N/A'}: ${w.task_description} [${w.stage}] (Fitter: ${w.fitter_assigned})\n`;
      });
    });
    report += `\n2. PARTS AND HOTSHOTS:\n`;
    if (liveSnapshot.parts.length === 0) report += `None logged.\n`;
    liveSnapshot.parts.forEach((part) => {
      report += `  • ${part.hotshot ? 'HOTSHOT ' : ''}${part.fleetId}: ${part.description} [${partStatusLabel(part.status)}]${part.eta ? ` ETA ${formatDateTime(part.eta)}` : ''}\n`;
    });
    if (await copyToClipboard(report)) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  }

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
          <button type="button" onClick={() => { setOpened(null); setView('current'); }} className={`${actionClass} ${view === 'current' && !opened ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>
            This shift
          </button>
          <button type="button" onClick={() => { setOpened(null); setView('history'); }} className={`${actionClass} ${view === 'history' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>
            Past handovers ({handovers.length})
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {view === 'current' && !opened && (
          <>
            <button type="button" onClick={saveHandover} disabled={saving} className={`${actionClass} bg-slate-900 text-white`}>
              {saving ? 'Saving...' : 'Save handover'}
            </button>
            <button type="button" onClick={() => window.print()} className={`${actionClass} bg-white border border-slate-300 text-slate-800`}>
              <Printer className="w-4 h-4" /> Save as PDF
            </button>
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
            <button type="button" onClick={handleCopyAllForSap} className={`${actionClass} bg-white border border-slate-300 text-slate-700`}>
              {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedAll ? 'Copied' : 'Copy for SAP'}
            </button>
            <button type="button" onClick={() => setShowRollover(true)} className={`${actionClass} bg-emerald-600 text-white`}>
              <RotateCw className="w-4 h-4" /> Finish shift
            </button>
          </>
        )}
        {opened && (
          <>
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
          </>
        )}
      </div>

      {view === 'history' && !opened && (
        <div className="mt-4">
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
          <IncomingCrewPicker
            panel={incomingPanel}
            crew={crew}
            onChange={(panel) => {
              setChoiceShiftId(shiftId);
              setIncomingPanel(panel);
            }}
          />

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

          <details className="mt-6 rounded-xl border border-slate-200 p-4">
            <summary className="text-sm font-black text-slate-800 cursor-pointer">Add a note, an extra slide, or a written summary</summary>
            <div className="mt-4">
              <ShiftHandoverLog
                entries={handoverLog}
                onAddEntry={handleAddLogEntry}
                onUpdateCategory={handleUpdateCategory}
                onDeleteEntry={handleDeleteLogEntry}
              />
            </div>
            <BriefingSlides slides={slides} onChange={setSlides} />
            <div className="mt-4">
              <AiHandoverDigest
                activeShift={activeShift}
                shiftJobs={shiftJobs}
                completedJobs={completedJobs}
                workOrders={workOrders}
                notes={notes}
                logEntries={handoverLog}
                summaryText={summary}
                machineNotes={machineNotes}
                onSummaryGenerated={(text, notesForMachines) => {
                  setSummary(text);
                  setMachineNotes(notesForMachines);
                }}
              />
            </div>
          </details>
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