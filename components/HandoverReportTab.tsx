import { useEffect, useState } from 'react';
import { FileSpreadsheet, Printer, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { Asset, HistoryNote, DefectItem } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { formatDateTime } from '@/utils/helpers';

interface HandoverReportTabProps {
  shiftJobs: Asset[];
  completedJobs: Asset[];
  defects: DefectItem[];
}

export default function HandoverReportTab({ shiftJobs, completedJobs, defects }: HandoverReportTabProps) {
  const [shiftNotes, setShiftNotes] = useState<Record<string, HistoryNote[]>>({});
  const supabase = createClient();

  useEffect(() => {
    fetchShiftHistory();
  }, [shiftJobs]);

  async function fetchShiftHistory() {
    const assetIds = [...shiftJobs.map(a => a.id), ...completedJobs.map(a => a.id)];
    if (assetIds.length === 0) return;

    const { data } = await supabase
      .from('asset_history_notes')
      .select('*')
      .in('asset_id', assetIds)
      .order('created_at', { ascending: false });

    if (data) {
      const grouped: Record<string, HistoryNote[]> = {};
      data.forEach((note: HistoryNote) => {
        if (!grouped[note.asset_id]) grouped[note.asset_id] = [];
        grouped[note.asset_id].push(note);
      });
      setShiftNotes(grouped);
    }
  }

  const fixedDefects = defects.filter((d) => d.status === 'FIXED_THIS_SHIFT');
  const openDefects = defects.filter((d) => d.status === 'OPEN');

  return (
    <div className="bg-slate-850 border border-slate-700 rounded-2xl p-6 print:p-0 print:border-none shadow-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-700 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
            Shift Handover & Maintenance Summary
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Generated {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} • Management & Superintendent Shift Pack
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg shadow-sm transition"
        >
          <Printer className="w-4 h-4" /> Print PDF Handover Pack
        </button>
      </div>

      {/* 1. Machines Handed Over Still Down */}
      <div className="mt-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> 1. Machines Handed Over to Incoming Shift ({shiftJobs.length} Units Down)
        </h3>

        {shiftJobs.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No active breakdowns handed over. Entire shift queue clear.</p>
        ) : (
          <div className="space-y-4">
            {shiftJobs.map((asset) => {
              const notes = shiftNotes[asset.id] || [];
              const systems = asset.component_systems && asset.component_systems.length > 0
                ? asset.component_systems
                : asset.component_system ? [asset.component_system] : ['General'];

              return (
                <div key={asset.id} className="p-4 rounded-xl border border-slate-700 bg-slate-900/90 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {asset.priority && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-600 text-white uppercase">
                          {asset.priority}
                        </span>
                      )}
                      <span className="text-lg font-black text-white">{asset.fleet_id}</span>
                      <span className="text-xs font-bold text-slate-300">({asset.make_model})</span>

                      {/* SAP Info */}
                      {asset.work_order_num && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                          <FileText className="w-3 h-3" /> {asset.work_order_num}
                        </span>
                      )}
                      {asset.sap_notification && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {asset.sap_notification}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400">
                        Down: <strong className="text-rose-400">{formatDateTime(asset.down_since)}</strong>
                      </span>
                      <span className="text-slate-400">
                        ETU: <strong className="text-amber-400">{formatDateTime(asset.expected_up)}</strong>
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 uppercase">
                        {asset.shift_stage?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs space-y-1">
                    <p className="text-slate-300">
                      <strong className="text-slate-400 uppercase text-[10px]">Areas / Systems:</strong> {systems.join(' • ')}
                    </p>
                    <p className="text-slate-200">
                      <strong className="text-slate-400 uppercase text-[10px]">Work Scope:</strong> {asset.shift_task}
                    </p>
                    <p className="text-slate-400">
                      <strong className="text-slate-400 uppercase text-[10px]">Allocated Fitter:</strong> {asset.fitter_assigned || 'Unassigned'}
                    </p>
                  </div>

                  {/* Notes Timeline */}
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Shift Progress Logs:
                    </span>
                    {notes.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">No notes logged this shift.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {notes.slice(0, 3).map((note) => (
                          <div key={note.id} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950 p-2 rounded-lg">
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">{formatDateTime(note.created_at)}</span>
                            <span className="font-bold text-amber-400 shrink-0">[{note.fitter_name}]:</span>
                            <span>{note.note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Shift Defect Summary (Found vs Fixed) */}
      <div className="mt-8 pt-6 border-t border-slate-700">
        <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> 2. Shift Defect Summary ({fixedDefects.length} Rectified, {openDefects.length} Outstanding)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
            <span className="font-bold text-emerald-400 block mb-2">Defects Fixed This Shift:</span>
            {fixedDefects.length === 0 ? (
              <p className="text-slate-500 italic">No defects marked resolved during this shift.</p>
            ) : (
              <ul className="space-y-1.5">
                {fixedDefects.map((d) => (
                  <li key={d.id} className="text-slate-300">
                    • <strong className="text-white">[{d.severity}]</strong> {d.description} (Fixed by {d.rectified_by || 'Fitter'})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
            <span className="font-bold text-rose-400 block mb-2">Open Defects Handed Over:</span>
            {openDefects.length === 0 ? (
              <p className="text-slate-500 italic">No outstanding open defects logged.</p>
            ) : (
              <ul className="space-y-1.5">
                {openDefects.map((d) => (
                  <li key={d.id} className="text-slate-300">
                    • <strong className="text-rose-400">[{d.severity}]</strong> {d.description} (Reported by {d.reported_by})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 3. Completed During Shift */}
      <div className="mt-8 pt-6 border-t border-slate-700">
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> 3. Completed & Returned to Service This Shift ({completedJobs.length} Units)
        </h3>
        {completedJobs.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No units completed during this shift cycle yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3">Fleet ID</th>
                  <th className="p-3">Model</th>
                  <th className="p-3">SAP WO</th>
                  <th className="p-3">Completed Work Scope</th>
                  <th className="p-3">Actual Up Time</th>
                  <th className="p-3">Signoff Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-900/60">
                {completedJobs.map((asset) => (
                  <tr key={asset.id}>
                    <td className="p-3 font-black text-white">{asset.fleet_id}</td>
                    <td className="p-3 text-slate-400">{asset.make_model}</td>
                    <td className="p-3 font-mono text-sky-400">{asset.work_order_num || 'N/A'}</td>
                    <td className="p-3">{asset.shift_task || 'Repairs completed & returned to operation'}</td>
                    <td className="p-3 font-mono text-emerald-400">{formatDateTime(asset.actual_up)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase">
                        OPERATIONAL
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}