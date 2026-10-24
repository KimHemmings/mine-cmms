// components/ShiftHandoverView.tsx - Under 150 lines
'use client';

import React, { useState } from 'react';
import { CloudRain, ShieldAlert, Users, Target, Printer, Presentation, CheckCircle, Clock, Plus, Trash2 } from 'lucide-react';
import { Asset, MachineWorkOrder } from '@/types';
import { generateHandoverPptx, CustomSlideData } from '@/utils/handoverPptx';

interface ShiftHandoverViewProps {
  shiftName: string;
  activeFitter: string;
  shiftJobs: Asset[];
  workOrders: MachineWorkOrder[];
}

export default function ShiftHandoverView({
  shiftName,
  activeFitter,
  shiftJobs,
  workOrders,
}: ShiftHandoverViewProps) {
  const [weather, setWeather] = useState('');
  const [safetyFocus, setSafetyFocus] = useState('');
  const [manning, setManning] = useState('');
  const [nextPriorities, setNextPriorities] = useState('');
  const [customSlides, setCustomSlides] = useState<CustomSlideData[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const activeFleet = shiftJobs.filter((a) => a.status !== 'OPERATIONAL');
  const releasedFleet = shiftJobs.filter((a) => a.status === 'OPERATIONAL');

  const addCustomSlide = () => {
    setCustomSlides((prev) => [...prev, { id: crypto.randomUUID(), title: '', notes: '' }]);
  };

  const updateSlide = (id: string, field: 'title' | 'notes', val: string) => {
    setCustomSlides((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: val } : s)));
  };

  const removeSlide = (id: string) => {
    setCustomSlides((prev) => prev.filter((s) => s.id !== id));
  };

  const handlePptxExport = async () => {
    try {
      setIsExporting(true);
      await generateHandoverPptx({
        shiftName,
        supervisor: activeFitter,
        weather,
        safetyFocus,
        manning,
        nextShiftPriorities: nextPriorities,
        activeAssets: activeFleet,
        workOrders,
        customSlides,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <h2 className="text-lg font-black text-slate-900">Shift Handover & Line-Up</h2>
          <p className="text-xs text-slate-500">Auto-populated from the active board. Fill notes below and export.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Print / Save PDF</span>
          </button>
          <button
            type="button"
            onClick={handlePptxExport}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            <Presentation className="w-4 h-4" />
            <span>{isExporting ? 'Building PPTX...' : 'Export PowerPoint (.pptx)'}</span>
          </button>
        </div>
      </div>

      {/* Main Form & Printable Surface */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
        <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
          <div>
            <span className="text-xs font-black uppercase text-amber-700 tracking-wider">Shift Handover Document</span>
            <h1 className="text-2xl font-black text-slate-900">{shiftName.toUpperCase()}</h1>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <p>Generated: {new Date().toLocaleString()}</p>
            <p>Supervisor: <strong className="text-slate-800 font-sans">{activeFitter || 'Planner / Supervisor'}</strong></p>
          </div>
        </div>

        {/* Situational Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/50 space-y-1.5">
            <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-sky-600" /> Weather & Haul Roads
            </label>
            <textarea
              rows={2}
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              placeholder="e.g. Pit 2 ramp wet after afternoon rain; wash bay open..."
              className="w-full text-xs p-2 rounded-lg bg-white border border-sky-300 text-slate-800 focus:outline-none print:border-none print:p-0"
            />
          </div>

          <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50 space-y-1.5">
            <label className="text-xs font-bold text-red-950 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600" /> Safety & Critical Focus
            </label>
            <textarea
              rows={2}
              value={safetyFocus}
              onChange={(e) => setSafetyFocus(e.target.value)}
              placeholder="e.g. Working at heights permit on EX-202; positive isolation audit..."
              className="w-full text-xs p-2 rounded-lg bg-white border border-red-300 text-slate-800 focus:outline-none print:border-none print:p-0"
            />
          </div>

          <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/60 space-y-1.5">
            <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-600" /> Manning & Equipment
            </label>
            <textarea
              rows={2}
              value={manning}
              onChange={(e) => setManning(e.target.value)}
              placeholder="e.g. FST-01 allocated to Pit 1; 1 fitter absent; Boilie on ramp callouts..."
              className="w-full text-xs p-2 rounded-lg bg-white border border-slate-300 text-slate-800 focus:outline-none print:border-none print:p-0"
            />
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5">
            <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-700" /> Next Shift Priorities
            </label>
            <textarea
              rows={2}
              value={nextPriorities}
              onChange={(e) => setNextPriorities(e.target.value)}
              placeholder="e.g. Fit hotshot seal kit to DT-049 upon delivery at 11:30..."
              className="w-full text-xs p-2 rounded-lg bg-white border border-emerald-300 text-slate-800 focus:outline-none print:border-none print:p-0"
            />
          </div>
        </div>

        {/* Dynamic Custom Slides Repeater */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Custom Slides & Special Topics</span>
            <button
              type="button"
              onClick={addCustomSlide}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 transition print:hidden cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Slide / Topic
            </button>
          </div>

          {customSlides.map((slide, i) => (
            <div key={slide.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder={`Slide #${i + 4} Title (e.g. Crane Rigging Plan / Contractor Work)`}
                  value={slide.title}
                  onChange={(e) => updateSlide(slide.id, 'title', e.target.value)}
                  className="flex-1 text-xs font-bold p-1.5 bg-white border border-slate-300 rounded"
                />
                <button
                  type="button"
                  onClick={() => removeSlide(slide.id)}
                  className="text-red-500 hover:text-red-700 p-1 print:hidden cursor-pointer"
                  title="Remove Slide"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="Slide content / bullet points..."
                value={slide.notes}
                onChange={(e) => updateSlide(slide.id, 'notes', e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded"
              />
            </div>
          ))}
        </div>

        {/* Active Equipment Summary Table */}
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" /> Active Workshop Fleet ({activeFleet.length})
          </h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Fleet ID</th>
                  <th className="p-2.5">Location</th>
                  <th className="p-2.5">Task Description</th>
                  <th className="p-2.5">Stage</th>
                  <th className="p-2.5">Allocated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeFleet.map((asset) => {
                  const mainWo = workOrders.find((w) => w.asset_id === asset.id && w.is_main_event) ||
                                 workOrders.find((w) => w.asset_id === asset.id);
                  return (
                    <tr key={asset.id}>
                      <td className="p-2.5 font-bold text-slate-900">{asset.fleet_id}</td>
                      <td className="p-2.5 text-slate-600">{asset.location || 'In Pit'}</td>
                      <td className="p-2.5 text-slate-800 font-medium">{mainWo?.task_description || asset.shift_task || 'Unscheduled Breakdown'}</td>
                      <td className="p-2.5 font-semibold text-amber-800">{mainWo?.stage || asset.shift_stage || 'IN_PROGRESS'}</td>
                      <td className="p-2.5 text-slate-600">{mainWo?.fitter_assigned || 'Unassigned'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Released Fleet Section */}
        {releasedFleet.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Released Fleet ({releasedFleet.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {releasedFleet.map((unit) => (
                <span key={unit.id} className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs">
                  {unit.fleet_id} ({unit.make_model})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}