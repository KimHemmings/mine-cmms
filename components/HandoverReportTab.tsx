// components/HandoverReportTab.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, Printer, Presentation, Copy, Check, AlertCircle, 
  CheckCircle2, RotateCw, CloudRain, ShieldAlert, Users, Target, Plus, Trash2, Zap
} from 'lucide-react';
import { Asset, MachineWorkOrder, DefectItem, ShiftRecord } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { copyToClipboard } from '@/utils/sapFormatter';
import { generateHandoverPptx, CustomSlideData } from '@/utils/handoverPptx';
import { createClient } from '@/utils/supabase/client';

interface HandoverReportTabProps {
  activeShift: ShiftRecord | null;
  shiftJobs: Asset[];
  completedJobs: Asset[];
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  onRolloverShift: () => void;
}

export default function HandoverReportTab({
  activeShift,
  shiftJobs,
  completedJobs,
  workOrders,
  defects,
  onRolloverShift,
}: HandoverReportTabProps) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Situational Form State
  const [weather, setWeather] = useState('');
  const [safetyFocus, setSafetyFocus] = useState('');
  const [manning, setManning] = useState('');
  const [nextPriorities, setNextPriorities] = useState('');
  const [customSlides, setCustomSlides] = useState<CustomSlideData[]>([]);
  const isLoaded = useRef(false);

  const supabase = createClient();
  const supervisorName = activeShift?.supervisor || 'Workshop Management';
  const storageKey = `mine_cmms_handover_${activeShift?.id || 'active'}`;

  // 1. Load persisted handover notes from localStorage or Supabase on initial render
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const localData = localStorage.getItem(storageKey);
      if (localData) {
        const parsed = JSON.parse(localData);
        setWeather(parsed.weather || '');
        setSafetyFocus(parsed.safetyFocus || '');
        setManning(parsed.manning || '');
        setNextPriorities(parsed.nextPriorities || '');
        setCustomSlides(parsed.customSlides || []);
        isLoaded.current = true;
        return;
      }

      if (activeShift?.handover_notes) {
        const parsed = JSON.parse(activeShift.handover_notes);
        setWeather(parsed.weather || '');
        setSafetyFocus(parsed.safetyFocus || '');
        setManning(parsed.manning || '');
        setNextPriorities(parsed.nextPriorities || '');
        setCustomSlides(parsed.customSlides || []);
      }
    } catch {
      if (activeShift?.handover_notes && typeof activeShift.handover_notes === 'string') {
        setNextPriorities(activeShift.handover_notes);
      }
    }
    isLoaded.current = true;
  }, [activeShift, storageKey]);

  // 2. Auto-save to localStorage on every keystroke
  useEffect(() => {
    if (!isLoaded.current || typeof window === 'undefined') return;
    const payload = { weather, safetyFocus, manning, nextPriorities, customSlides };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [weather, safetyFocus, manning, nextPriorities, customSlides, storageKey]);

  const addCustomSlide = () => setCustomSlides((prev) => [...prev, { id: crypto.randomUUID(), title: '', notes: '' }]);
  const updateSlide = (id: string, field: 'title' | 'notes', val: string) => setCustomSlides((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: val } : s)));
  const removeSlide = (id: string) => setCustomSlides((prev) => prev.filter((s) => s.id !== id));

  const handleFinalizeAndRoll = async () => {
    if (!confirm('Finalize and roll current shift? All open jobs and statutory handover notes will transfer automatically.')) {
      return;
    }

    if (activeShift?.id) {
      const summaryPayload = JSON.stringify({
        weather,
        safetyFocus,
        manning,
        nextPriorities,
        customSlides,
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

  const handlePptxExport = async () => {
    try {
      setIsExporting(true);
      await generateHandoverPptx({
        shiftName: activeShift?.shift_name || 'Active Shift',
        supervisor: supervisorName,
        weather,
        safetyFocus,
        manning,
        nextShiftPriorities: nextPriorities,
        activeAssets: shiftJobs,
        workOrders,
        customSlides,
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
          <p className="text-xs text-slate-500 mt-1">Current Shift: <strong className="text-slate-800">{activeShift?.shift_name}</strong> | Supervisor: <strong className="text-slate-800">{supervisorName}</strong></p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={handleCopyAllForSap} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition cursor-pointer">
            {copiedAll ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copiedAll ? 'Copied!' : 'Copy SAP Text'}
          </button>
          <button onClick={handlePptxExport} disabled={isExporting} className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 border border-amber-700 text-white text-xs font-bold rounded-xl hover:bg-amber-500 transition cursor-pointer disabled:opacity-50">
            <Presentation className="w-4 h-4" />
            {isExporting ? 'Building...' : 'Export PPTX'}
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer">
            <Printer className="w-4 h-4 text-amber-400" /> Print PDF
          </button>
          <button onClick={handleFinalizeAndRoll} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 transition cursor-pointer shadow-sm ml-2">
            <RotateCw className="w-4 h-4" /> Finalize Shift
          </button>
        </div>
      </div>

      {/* PRINT HEADER */}
      <div className="hidden print:block pb-4 mb-4 border-b border-black">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-black uppercase tracking-tight">MAINTENANCE SHIFT HANDOVER: {activeShift?.shift_name}</h1>
            <p className="text-xs font-bold text-gray-700">Date: {new Date().toLocaleDateString()} | Supervisor: {supervisorName}</p>
          </div>
          <div className="text-right text-xs font-mono font-bold">Generated: {new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      {/* EDITABLE SITUATIONAL CARDS (With Auto-Save) */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/50 print:border-none print:p-0 print:bg-white">
          <label className="text-[11px] font-black uppercase tracking-wide text-sky-950 flex items-center gap-1.5 mb-1.5"><CloudRain className="w-3.5 h-3.5 text-sky-600" /> Weather & Haul Roads</label>
          <textarea rows={2} value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="Enter weather and pit conditions..." className="w-full text-xs p-2 rounded-lg bg-white border border-sky-300 text-slate-800 focus:outline-none print:border-none print:p-0" />
        </div>
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50 print:border-none print:p-0 print:bg-white">
          <label className="text-[11px] font-black uppercase tracking-wide text-red-950 flex items-center gap-1.5 mb-1.5"><ShieldAlert className="w-3.5 h-3.5 text-red-600" /> Safety & Critical Focus</label>
          <textarea rows={2} value={safetyFocus} onChange={(e) => setSafetyFocus(e.target.value)} placeholder="Enter safety directives..." className="w-full text-xs p-2 rounded-lg bg-white border border-red-300 text-slate-800 focus:outline-none print:border-none print:p-0" />
        </div>
        <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/60 print:border-none print:p-0 print:bg-white">
          <label className="text-[11px] font-black uppercase tracking-wide text-slate-900 flex items-center gap-1.5 mb-1.5"><Users className="w-3.5 h-3.5 text-slate-600" /> Manning & Equipment</label>
          <textarea rows={2} value={manning} onChange={(e) => setManning(e.target.value)} placeholder="Enter crew absenteeism and support gear alloc..." className="w-full text-xs p-2 rounded-lg bg-white border border-slate-300 text-slate-800 focus:outline-none print:border-none print:p-0" />
        </div>
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 print:border-none print:p-0 print:bg-white">
          <label className="text-[11px] font-black uppercase tracking-wide text-emerald-950 flex items-center gap-1.5 mb-1.5"><Target className="w-3.5 h-3.5 text-emerald-700" /> Next Shift Priorities</label>
          <textarea rows={2} value={nextPriorities} onChange={(e) => setNextPriorities(e.target.value)} placeholder="Enter priorities for incoming crew..." className="w-full text-xs p-2 rounded-lg bg-white border border-emerald-300 text-slate-800 focus:outline-none print:border-none print:p-0" />
        </div>
      </div>

      {/* DYNAMIC CUSTOM SLIDES REPEATER */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Custom Handover Topics</span>
          <button type="button" onClick={addCustomSlide} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-black uppercase tracking-wide hover:bg-amber-100 transition print:hidden cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Topic Slide
          </button>
        </div>
        {customSlides.map((slide, i) => (
          <div key={slide.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2 print:border-none print:p-0 print:bg-white">
            <div className="flex items-center gap-2">
              <input type="text" placeholder={`Topic #${i + 1} Title`} value={slide.title} onChange={(e) => updateSlide(slide.id, 'title', e.target.value)} className="flex-1 text-xs font-bold p-1.5 bg-white border border-slate-300 rounded print:border-none print:p-0" />
              <button type="button" onClick={() => removeSlide(slide.id)} className="text-red-500 hover:text-red-700 p-1 print:hidden cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
            <textarea rows={2} placeholder="Bullet points..." value={slide.notes} onChange={(e) => updateSlide(slide.id, 'notes', e.target.value)} className="w-full text-xs p-2 bg-white border border-slate-300 rounded print:border-none print:p-0" />
          </div>
        ))}
      </div>

      {/* TABLE 1: DOWN UNITS & HOTSHOT ALERTS */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> 1. Handed Over to Incoming Shift ({shiftJobs.length} Units Down)
        </h3>
        {shiftJobs.length === 0 ? (
          <p className="text-xs text-slate-500 py-2 italic">Zero machines handed over.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 print:border-black">
            <table className="w-full text-left text-xs text-slate-800 print:text-[11px]">
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
                              <span key={h.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 border border-amber-600">
                                <Zap className="w-3 h-3 fill-slate-950" />
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

      {/* TABLE 2: COMPLETED */}
      <div className="mt-6 pt-4 border-t border-slate-200 print:border-black">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> 2. Units Returned to Production This Shift ({completedJobs.length})
        </h3>
        {completedJobs.length === 0 ? (
          <p className="text-xs text-slate-500 py-1 italic">No units completed yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {completedJobs.map((a) => (
              <span key={a.id} className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs print:border-black">
                {a.fleet_id} ({a.make_model})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: DEFECTS */}
      <div className="mt-6 pt-4 border-t border-slate-200 print:border-black">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">3. Shift Defect Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 print:border-black">
            <span className="font-bold text-emerald-800 block mb-1 text-[11px]">Fixed ({fixedDefects.length}):</span>
            <ul className="space-y-1">{fixedDefects.map((d) => (<li key={d.id} className="text-slate-700 text-[11px]">• <strong className="text-slate-900">[{d.severity}]</strong> {d.description}</li>))}</ul>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 print:border-black">
            <span className="font-bold text-rose-800 block mb-1 text-[11px]">Handed Over ({openDefects.length}):</span>
            <ul className="space-y-1">{openDefects.map((d) => (<li key={d.id} className="text-slate-700 text-[11px]">• <strong className="text-rose-700">[{d.severity}]</strong> {d.description}</li>))}</ul>
          </div>
        </div>
      </div>

    </div>
  );
}