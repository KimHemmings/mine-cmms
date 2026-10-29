'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Printer, Presentation, Copy, Check, AlertCircle, 
  CheckCircle2, RotateCw, Zap
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
import { formatDateTime } from '@/utils/helpers';
import { copyToClipboard } from '@/utils/sapFormatter';
import { generateHandoverPptx } from '@/utils/handoverPptx';
import { createClient } from '@/utils/supabase/client';

interface HandoverReportTabProps {
  activeShift: ShiftRecord | null;
  shiftJobs: Asset[];
  completedJobs: Asset[];
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  notes: HistoryNote[];
  onRolloverShift: () => void;
}

export default function HandoverReportTab({
  activeShift,
  shiftJobs,
  completedJobs,
  workOrders,
  defects,
  notes,
  onRolloverShift,
}: HandoverReportTabProps) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [logEntries, setLogEntries] = useState<HandoverLogEntry[]>([]);

  const supabase = createClient();
  const supervisorName = activeShift?.supervisor || 'Workshop Management';
  const storageKey = `mine_cmms_handover_log_${activeShift?.id || 'active'}`;

  // 1. Load persisted unified log on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setLogEntries(JSON.parse(saved));
        return;
      }
      // Migrate any legacy watchlist items if found
      const legacyWatch = localStorage.getItem('mine_cmms_watchlist');
      if (legacyWatch) {
        const parsed = JSON.parse(legacyWatch);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated: HandoverLogEntry[] = parsed.map((w: any) => ({
            id: w.id || crypto.randomUUID(),
            category: 'WATCHLIST',
            fleet_id: w.fleet_id,
            details: w.issue_description || '',
            action_required: w.inspection_action || '',
            logged_at: w.date_logged || new Date().toLocaleDateString(),
          }));
          setLogEntries(migrated);
        }
      }
    } catch {
      console.error('Failed to load handover log');
    }
  }, [storageKey]);

  // 2. Auto-save log entries on every change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(logEntries));
  }, [logEntries, storageKey]);

  const handleAddLogEntry = (entry: Omit<HandoverLogEntry, 'id' | 'logged_at'>) => {
    const newEntry: HandoverLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      logged_at: new Date().toLocaleDateString(),
    };
    setLogEntries((prev) => [...prev, newEntry]);
  };

  const handleUpdateCategory = (id: string, newCategory: HandoverLogCategory) => {
    setLogEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, category: newCategory } : item))
    );
  };

  const handleDeleteLogEntry = (id: string) => {
    setLogEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const handleFinalizeAndRoll = async () => {
    if (!confirm('Finalize and roll current shift? All open jobs and compliance logs will transfer automatically.')) {
      return;
    }

    if (activeShift?.id) {
      const summaryPayload = JSON.stringify({
        logEntries,
        finalizedAt: new Date().toISOString(),
        finalizedBy: supervisorName,
      });

      await supabase
        .from('shift_records')
        .update({ handover_notes: summaryPayload })
        .eq('id', activeShift.id);
    }

    onRolloverShift();
  };

  async function handleCopyAllForSap() {
    let report = `================================================================================\n`;
    report += `SHIFT: ${activeShift?.shift_name || 'Active Shift'} | DATE: ${new Date().toLocaleDateString()}\n`;
    report += `SUPERVISOR: ${supervisorName}\n================================================================================\n\n`;
    report += `1. UNITS HANDED OVER TO INCOMING SHIFT:\n`;
    shiftJobs.forEach((a) => {
      const orders = workOrders.filter((w) => w.asset_id === a.id);
      report += `\n[${a.priority || 'ROUTINE'}] ${a.fleet_id} (${a.make_model}) - Bay: ${a.location || 'Workshop'}\n`;
      orders.forEach((w) => {
        report += `  • [${w.status}] WO: ${w.wo_number || 'N/A'}: ${w.task_description} [${w.stage}] (Fitter: ${w.fitter_assigned})\n`;
      });
    });
    if (await copyToClipboard(report)) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  }

  // Pre-start PowerPoint generator maps the unified log categories into slides
  const handlePptxExport = async () => {
    try {
      setIsExporting(true);
      const weatherNotes = logEntries
        .filter((e) => e.category === 'WEATHER')
        .map((e) => e.details)
        .join('; ');
      const safetyNotes = logEntries
        .filter((e) => e.category === 'SAFETY')
        .map((e) => e.details)
        .join('; ');
      const manningNotes = logEntries
        .filter((e) => e.category === 'MANNING')
        .map((e) => e.details)
        .join('; ');
      const prioritiesNotes = logEntries
        .filter((e) => e.category === 'PRIORITY')
        .map((e) => `${e.fleet_id ? `[${e.fleet_id}] ` : ''}${e.details}`)
        .join('; ');

      await generateHandoverPptx({
        shiftName: activeShift?.shift_name || 'Active Shift',
        supervisor: supervisorName,
        weather: weatherNotes,
        safetyFocus: safetyNotes,
        manning: manningNotes,
        nextShiftPriorities: prioritiesNotes,
        activeAssets: shiftJobs,
        workOrders,
        customSlides: [],
      });
    } finally {
      setIsExporting(false);
    }
  };

  const fixedDefects = defects.filter((d) => d.status === 'FIXED_THIS_SHIFT');
  const openDefects = defects.filter((d) => d.status === 'OPEN');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:p-0 print:border-none print:shadow-none font-sans">
      
      {/* Handover Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-200 gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-bold text-slate-900">Shift Handover Dispatch Sheet</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Current Shift: <strong className="text-slate-800">{activeShift?.shift_name}</strong> | Supervisor: <strong className="text-slate-800">{supervisorName}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={handleCopyAllForSap} 
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition cursor-pointer"
          >
            {copiedAll ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copiedAll ? 'Copied!' : 'Copy SAP Text'}
          </button>
          <button 
            onClick={handlePptxExport} 
            disabled={isExporting} 
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 border border-amber-700 text-white text-xs font-bold rounded-xl hover:bg-amber-500 transition cursor-pointer disabled:opacity-50"
          >
            <Presentation className="w-4 h-4" />
            {isExporting ? 'Building...' : 'Export PPTX'}
          </button>
          <button 
            onClick={() => window.print()} 
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" /> Print PDF
          </button>
          <button 
            onClick={handleFinalizeAndRoll} 
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 transition cursor-pointer shadow-sm ml-2"
          >
            <RotateCw className="w-4 h-4" /> Finalize Shift
          </button>
        </div>
      </div>

      {/* STATUTORY PRINT HEADER */}
      <div className="hidden print:block pb-4 mb-4">
        <h1 className="text-xl font-black text-black uppercase tracking-tight text-center mb-2">
          HME MAINTENANCE SHIFT HANDOVER
        </h1>
        <div className="flex justify-between items-start text-xs font-bold text-gray-900 border-t border-b border-black py-2">
          <div>
            <p>OUTGOING: {activeShift?.shift_name || 'Day Crew'} | {supervisorName}</p>
            <p>DATE: {new Date().toLocaleDateString()} | 06:00 - 18:00</p>
          </div>
          <div className="text-right">
            <p>INCOMING: Cross-Shift | Relief Supervisor</p>
            <p>LOCATION: Mobile Equipment Workshop</p>
          </div>
        </div>
      </div>

      {/* 1. UNIFIED SHIFT HANDOVER & COMPLIANCE REGISTER */}
      <div className="mt-4">
        <ShiftHandoverLog
          entries={logEntries}
          onAddEntry={handleAddLogEntry}
          onUpdateCategory={handleUpdateCategory}
          onDeleteEntry={handleDeleteLogEntry}
        />
      </div>

      {/* 2. SHIFT OPERATIONAL BRIEFING */}
      <div className="mt-4">
        <AiHandoverDigest
          activeShift={activeShift}
          shiftJobs={shiftJobs}
          completedJobs={completedJobs}
          workOrders={workOrders}
          notes={notes}
          logEntries={logEntries}
        />
      </div>

      {/* 3. TABLE: DOWN FLEET & BREAKDOWN STATUS */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2 flex items-center gap-1.5 print:text-black">
          <AlertCircle className="w-4 h-4 text-rose-600 print:hidden" /> Handed Over to Incoming Shift ({shiftJobs.length} Units Down)
        </h3>
        {shiftJobs.length === 0 ? (
          <p className="text-xs text-slate-500 py-2 italic">Zero machines handed over.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 print:border-black">
            <table className="w-full text-left text-xs text-slate-800 print:text-[10px]">
              <thead className="bg-slate-50 print:bg-gray-100 text-[10px] font-black uppercase text-slate-600 print:text-black border-b border-slate-200 print:border-black">
                <tr>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5">WO / Notif</th>
                  <th className="p-2.5">Scope & Parts Alerts</th>
                  <th className="p-2.5">Fitter(s)</th>
                  <th className="p-2.5">Stage</th>
                  <th className="p-2.5">ETU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 print:divide-black">
                {shiftJobs.map((asset) => {
                  const orders = workOrders.filter((w) => w.asset_id === asset.id);
                  const hotshots = orders.flatMap((w) => w.parts || []).filter((p) => p.is_special_run);

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-black text-slate-900 print:text-black whitespace-nowrap">
                        {asset.fleet_id}
                        <span className="block text-[10px] font-normal text-slate-500">{asset.make_model}</span>
                      </td>
                      <td className="p-2.5 font-mono text-[10px] font-bold">
                        {orders.map((w) => w.wo_number || 'N/A').join(', ')}
                      </td>
                      <td className="p-2.5">
                        <div>{orders.map((w) => w.task_description).join('; ')}</div>
                        {hotshots.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {hotshots.map((h) => (
                              <span key={h.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 border border-amber-600 print:bg-transparent print:border-black">
                                <Zap className="w-3 h-3 fill-slate-950 print:hidden" />
                                HOTSHOT: {(h as any).description || h.part_number} (ETA {h.eta ? formatDateTime(h.eta) : 'TBD'})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 font-medium whitespace-nowrap">
                        {orders.map((w) => w.fitter_assigned).filter(Boolean).join(', ') || 'Unassigned'}
                      </td>
                      <td className="p-2.5 font-bold text-amber-700 print:text-black uppercase text-[10px] whitespace-nowrap">
                        {orders[0]?.stage?.replace('_', ' ') || 'DIAGNOSING'}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatDateTime(asset.expected_up)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. UNITS RETURNED TO PRODUCTION */}
      <div className="mt-6 pt-4 border-t border-slate-200 print:border-black">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1.5 print:text-black">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 print:hidden" /> Units Returned to Production This Shift ({completedJobs.length})
        </h3>
        {completedJobs.length === 0 ? (
          <p className="text-xs text-slate-500 py-1 italic">No units completed yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {completedJobs.map((a) => (
              <span key={a.id} className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs print:border-black print:bg-transparent print:text-black">
                {a.fleet_id} ({a.make_model})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 5. SHIFT DEFECT SUMMARY */}
      <div className="mt-6 pt-4 border-t border-slate-200 print:border-black">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 print:text-black">Shift Defect Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 print:border-black print:bg-transparent">
            <span className="font-bold text-emerald-800 print:text-black block mb-1 text-[11px]">Fixed ({fixedDefects.length}):</span>
            <ul className="space-y-1">
              {fixedDefects.map((d) => (
                <li key={d.id} className="text-slate-700 print:text-black text-[11px]">
                  <strong className="text-slate-900 print:text-black">[{d.severity}]</strong> {d.description}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 print:border-black print:bg-transparent">
            <span className="font-bold text-rose-800 print:text-black block mb-1 text-[11px]">Handed Over ({openDefects.length}):</span>
            <ul className="space-y-1">
              {openDefects.map((d) => (
                <li key={d.id} className="text-slate-700 print:text-black text-[11px]">
                  <strong className="text-rose-700 print:text-black">[{d.severity}]</strong> {d.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}