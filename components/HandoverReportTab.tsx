import { useState } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  RotateCw, 
  FileText 
} from 'lucide-react';
import { Asset, MachineWorkOrder, DefectItem, ShiftRecord } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { copyToClipboard } from '@/utils/sapFormatter';

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

  // Bulk copy all completed and open work orders formatted for SAP long text
  async function handleCopyAllForSap() {
    let report = `================================================================================\n`;
    report += `MINE SHIFT MAINTENANCE HANDOVER & SAP CONFIRMATIONS\n`;
    report += `SHIFT: ${activeShift?.shift_name || 'Active Shift'} | DATE: ${new Date().toLocaleDateString()}\n`;
    report += `SUPERVISOR: ${activeShift?.supervisor || 'Workshop Management'}\n`;
    report += `================================================================================\n\n`;

    report += `1. UNITS HANDED OVER TO INCOMING SHIFT (STILL DOWN):\n`;
    shiftJobs.forEach((a) => {
      const orders = workOrders.filter((w) => w.asset_id === a.id);
      report += `\n[${a.priority || 'ROUTINE'}] ${a.fleet_id} (${a.make_model}) - Bay: ${a.location || 'Workshop'}\n`;
      report += `Down Since: ${formatDateTime(a.down_since)} | ETU: ${formatDateTime(a.expected_up)}\n`;
      orders.forEach((w) => {
        report += `  • [${w.status}] WO: ${w.wo_number || 'N/A'} (${w.order_type}): ${w.task_description} [${w.stage}] (Fitter: ${w.fitter_assigned})\n`;
      });
    });

    report += `\n2. COMPLETED UNITS RELEASED TO PRODUCTION:\n`;
    completedJobs.forEach((a) => {
      const orders = workOrders.filter((w) => w.asset_id === a.id);
      report += `\n${a.fleet_id} (${a.make_model}) - Released at: ${formatDateTime(a.actual_up)}\n`;
      orders.forEach((w) => {
        report += `  • WO: ${w.wo_number || 'N/A'} (${w.order_type}): ${w.task_description} (Signed off by: ${w.completed_by || 'Fitter'})\n`;
      });
    });

    const success = await copyToClipboard(report);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  }

  const fixedDefects = defects.filter((d) => d.status === 'FIXED_THIS_SHIFT');
  const openDefects = defects.filter((d) => d.status === 'OPEN');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:p-0 print:border-none print:shadow-none font-sans">
      {/* Handover Toolbar (Hidden during print) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-200 gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-bold text-slate-900">Shift Handover Dispatch Sheet</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Current Shift: <strong className="text-slate-800">{activeShift?.shift_name || 'Active Shift'}</strong> • Supervisor: <strong className="text-slate-800">{activeShift?.supervisor || 'Workshop Management'}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleCopyAllForSap}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition"
          >
            {copiedAll ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copiedAll ? 'All Logs Copied!' : 'Copy All Logs for SAP'}
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <Printer className="w-4 h-4" /> Print 1-Page Summary
          </button>

          <button
            onClick={() => {
              if (confirm('Finalize and roll current shift over to the incoming shift? All active down jobs and open defects will transfer automatically.')) {
                onRolloverShift();
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition shadow-sm"
          >
            <RotateCw className="w-4 h-4" /> Finalize Shift & Roll Handover
          </button>
        </div>
      </div>

      {/* PRINT HEADER: Aviation Dispatch Title */}
      <div className="hidden print:block pb-4 mb-4 border-b border-black">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-black uppercase tracking-tight">MINE MAINTENANCE SHIFT HANDOVER REPORT</h1>
            <p className="text-xs font-bold text-gray-700">
              Shift: {activeShift?.shift_name || 'Active Shift'} | Date: {new Date().toLocaleDateString()} | Supervisor: {activeShift?.supervisor || 'Superintendent'}
            </p>
          </div>
          <div className="text-right text-xs font-mono font-bold">
            Generated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
          </div>
        </div>
      </div>

      {/* SECTION 1: DENSE TABLE OF UNITS HANDED OVER (STILL DOWN) */}
      <div className="mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> 1. Machines Handed Over to Incoming Shift ({shiftJobs.length} Units Down)
        </h3>

        {shiftJobs.length === 0 ? (
          <p className="text-xs text-slate-500 py-2 italic">Zero machines handed over. Handover queue clear.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 print:border-black">
            <table className="w-full text-left text-xs text-slate-800 print:text-[11px]">
              <thead className="bg-slate-50 print:bg-gray-100 text-[10px] font-black uppercase text-slate-600 print:text-black border-b border-slate-200 print:border-black">
                <tr>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5">Priority</th>
                  <th className="p-2.5">SAP WO / Notif</th>
                  <th className="p-2.5">Work Orders & Open Scope</th>
                  <th className="p-2.5">Fitter(s)</th>
                  <th className="p-2.5">Stage</th>
                  <th className="p-2.5">Down Since</th>
                  <th className="p-2.5">ETU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 print:divide-black">
                {shiftJobs.map((asset) => {
                  const orders = workOrders.filter((w) => w.asset_id === asset.id);
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-black text-slate-900 print:text-black whitespace-nowrap">
                        {asset.fleet_id}
                        <span className="block text-[10px] font-normal text-slate-500 print:text-gray-700">
                          {asset.make_model}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                            asset.priority === 'P1'
                              ? 'bg-rose-100 text-rose-800'
                              : asset.priority === 'P2'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {asset.priority || 'ROUTINE'}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[10px] font-bold">
                        {orders.map((w) => w.wo_number || 'No WO').join(', ') || 'N/A'}
                      </td>
                      <td className="p-2.5">
                        {orders.length === 0 ? (
                          <span className="text-slate-400 italic">No tasks listed</span>
                        ) : (
                          <ul className="space-y-1">
                            {orders.map((w) => (
                              <li key={w.id} className="leading-tight">
                                • <strong className="text-slate-900 font-semibold">{w.task_description}</strong>{' '}
                                <span className="text-[10px] text-slate-500 font-mono">({w.component_systems?.join('/')})</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="p-2.5 font-medium whitespace-nowrap">
                        {orders.map((w) => w.fitter_assigned).filter(Boolean).join(', ') || asset.fitter_assigned || 'Unassigned'}
                      </td>
                      <td className="p-2.5 font-bold text-amber-700 print:text-black uppercase text-[10px]">
                        {orders[0]?.stage?.replace('_', ' ') || 'DIAGNOSING'}
                      </td>
                      <td className="p-2.5 font-mono text-rose-700 whitespace-nowrap">
                        {formatDateTime(asset.down_since)}
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

      {/* SECTION 2: COMPLETED WORK CARRIED OUT THIS SHIFT */}
      <div className="mt-6 pt-4 border-t border-slate-200 print:border-black">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> 2. Units Completed & Returned to Production This Shift ({completedJobs.length})
        </h3>

        {completedJobs.length === 0 ? (
          <p className="text-xs text-slate-500 py-1 italic">No units completed during this shift yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 print:border-black">
            <table className="w-full text-left text-xs text-slate-800 print:text-[11px]">
              <thead className="bg-slate-50 print:bg-gray-100 text-[10px] font-black uppercase text-slate-600 print:text-black border-b border-slate-200 print:border-black">
                <tr>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5">Model</th>
                  <th className="p-2.5">SAP WO(s)</th>
                  <th className="p-2.5">Repairs & Scope Executed</th>
                  <th className="p-2.5">Actual Up Time</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 print:divide-black">
                {completedJobs.map((asset) => {
                  const orders = workOrders.filter((w) => w.asset_id === asset.id);
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-black text-slate-900 print:text-black">{asset.fleet_id}</td>
                      <td className="p-2.5 text-slate-600">{asset.make_model}</td>
                      <td className="p-2.5 font-mono text-[10px]">
                        {orders.map((w) => w.wo_number).filter(Boolean).join(', ') || 'N/A'}
                      </td>
                      <td className="p-2.5">
                        {orders.length === 0
                          ? 'Repairs executed and signed off'
                          : orders.map((w) => w.task_description).join('; ')}
                      </td>
                      <td className="p-2.5 font-mono text-emerald-700 font-bold whitespace-nowrap">
                        {formatDateTime(asset.actual_up)}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                          OPERATIONAL
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: SHIFT DEFECT SUMMARY */}
      <div className="mt-6 pt-4 border-t border-slate-200 print:border-black">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          3. Shift Defect Summary ({fixedDefects.length} Fixed / {openDefects.length} Handed Over)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 print:border-black">
            <span className="font-bold text-emerald-800 block mb-1 text-[11px]">Fixed & Cleared This Shift:</span>
            {fixedDefects.length === 0 ? (
              <p className="text-slate-400 italic text-[11px]">No defects marked resolved this shift.</p>
            ) : (
              <ul className="space-y-1">
                {fixedDefects.map((d) => (
                  <li key={d.id} className="text-slate-700 text-[11px]">
                    • <strong className="text-slate-900">[{d.severity}]</strong> {d.description} (Fixed by {d.rectified_by || 'Fitter'})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 print:border-black">
            <span className="font-bold text-rose-800 block mb-1 text-[11px]">Open Defects Handed Over:</span>
            {openDefects.length === 0 ? (
              <p className="text-slate-400 italic text-[11px]">Zero open defects handed over.</p>
            ) : (
              <ul className="space-y-1">
                {openDefects.map((d) => (
                  <li key={d.id} className="text-slate-700 text-[11px]">
                    • <strong className="text-rose-700">[{d.severity}]</strong> {d.description} (Reported by {d.reported_by})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}