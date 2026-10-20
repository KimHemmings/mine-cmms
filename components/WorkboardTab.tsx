import { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  User, 
  History, 
  FileText, 
  AlertTriangle, 
  Plus, 
  Copy, 
  Check, 
  ShieldAlert,
  ChevronRight,
  Star
} from 'lucide-react';
import { Asset, STAGES, DefectItem, MachineWorkOrder, HistoryNote } from '@/types';
import { formatDateTime, getElapsedDown, getEtuStatus } from '@/utils/helpers';
import { generateSapClipboardText, copyToClipboard } from '@/utils/sapFormatter';

interface WorkboardTabProps {
  shiftJobs: Asset[];
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  notes: HistoryNote[];
  loading: boolean;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
  signOffWorkOrder: (woId: string, assetId: string) => void;
  openAddWorkOrder: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
  openDefects: (asset: Asset) => void;
  releaseMachineToProduction: (assetId: string) => void;
}

export default function WorkboardTab({
  shiftJobs,
  workOrders,
  defects,
  notes,
  loading,
  updateWorkOrderStage,
  signOffWorkOrder,
  openAddWorkOrder,
  openHistory,
  openDefects,
  releaseMachineToProduction,
}: WorkboardTabProps) {
  const [copiedWoId, setCopiedWoId] = useState<string | null>(null);

  async function handleCopySapForOrder(asset: Asset, wo: MachineWorkOrder) {
    const text = generateSapClipboardText(asset, wo, notes);
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedWoId(wo.id);
      setTimeout(() => setCopiedWoId(null), 2000);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent mb-3" />
        <p className="text-slate-600 text-sm font-semibold">Loading active shift workboard...</p>
      </div>
    );
  }

  // Only display machines that have at least one active work order
  const validShiftJobs = shiftJobs.filter((asset) => 
    workOrders.some((wo) => wo.asset_id === asset.id)
  );

  if (validShiftJobs.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-slate-300 rounded-2xl max-w-xl mx-auto mt-8 shadow-md">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Zero Active Work Orders</h2>
        <p className="text-xs text-slate-500 mt-1">All machines are clear, or no work orders have been attached.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {validShiftJobs.map((asset) => {
        const isP1 = asset.priority === 'P1';
        const isP2 = asset.priority === 'P2';
        const etu = getEtuStatus(asset.expected_up);

        const machineOrders = workOrders.filter((w) => w.asset_id === asset.id);
        const mainEvent = machineOrders.find((w) => w.is_main_event) || machineOrders[0];
        const additionalOrders = machineOrders.filter((w) => w.id !== mainEvent?.id);
        const openOrders = machineOrders.filter((w) => w.status === 'OPEN');
        
        const machineDefects = defects.filter((d) => d.asset_id === asset.id);
        const activeDefects = machineDefects.filter((d) => d.status === 'OPEN'); 

        const canRelease = openOrders.length === 0 && activeDefects.length === 0;

        return (
          <div
            key={asset.id}
            className={`bg-white rounded-2xl border transition-all duration-200 shadow-md overflow-hidden ${
              isP1
                ? 'border-l-8 border-l-rose-600 border-slate-300'
                : isP2
                ? 'border-l-8 border-l-amber-500 border-slate-300'
                : 'border-l-8 border-l-slate-400 border-slate-300'
            }`}
          >
            {/* 1. MACHINE HEADER */}
            <div className="p-5 bg-slate-50/90 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span
                  className={`text-xs font-black px-3 py-1.5 rounded-lg border uppercase tracking-wider shrink-0 ${
                    isP1
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : isP2
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {asset.priority || 'ROUTINE'}
                </span>

                <div>
                  <div className="flex items-baseline gap-2.5">
                    <h2 className="text-2xl font-black text-slate-900 tracking-wide">{asset.fleet_id}</h2>
                    <span className="text-sm font-semibold text-slate-700">{asset.make_model}</span>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Owner: {asset.machine_owner || 'Central'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Bay / Location: <strong className="text-slate-800">{asset.location || 'Workshop Yard'}</strong>
                  </p>
                </div>
              </div>

              {/* Timing & History */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-rose-600" /> Down Since
                  </span>
                  <div className="font-bold text-slate-800">{formatDateTime(asset.down_since)}</div>
                  <div className="text-[11px] font-mono font-bold text-rose-700">
                    Elapsed: {getElapsedDown(asset.down_since)}
                  </div>
                </div>

                <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Expected Up (ETU)
                  </span>
                  <div className="font-bold text-slate-800">{formatDateTime(asset.expected_up)}</div>
                  {etu && (
                    <span
                      className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                        etu.overdue ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {etu.label}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => openHistory(asset)}
                  className="flex items-center gap-1.5 px-4 py-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <History className="w-4 h-4 text-amber-600" /> History & Notes
                </button>
              </div>
            </div>

            {/* 2. THE MAIN DOWN TIME EVENT (Hero Section) */}
            {mainEvent && (
              <div className="p-5 bg-amber-50/30 border-b border-amber-200/60">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/50">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-600 fill-amber-500" />
                    MAIN DOWN TIME EVENT (Primary Reason on Board)
                  </span>
                  {mainEvent.status === 'COMPLETED' ? (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> MAIN EVENT COMPLETED
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                      ACTIVE EVENT
                    </span>
                  )}
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border bg-sky-50 text-sky-800 border-sky-300">
                        <FileText className="w-3.5 h-3.5 inline mr-1" />
                        {mainEvent.wo_number || 'NO SAP WO'} ({mainEvent.order_type})
                      </span>
                      {mainEvent.notification_num && (
                        <span className="text-xs font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {mainEvent.notification_num}
                        </span>
                      )}
                      {mainEvent.component_systems?.map((sys) => (
                        <span key={sys} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                          {sys}
                        </span>
                      ))}
                    </div>

                    <p className={`text-base text-slate-900 ${mainEvent.status === 'COMPLETED' ? 'line-through text-slate-500' : 'font-bold'}`}>
                      {mainEvent.task_description}
                    </p>

                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Fitter Allocated: <strong className="text-slate-800">{mainEvent.fitter_assigned || 'Unassigned'}</strong></span>
                      {mainEvent.completed_at && (
                        <span className="text-emerald-700 ml-2 font-medium">(Signed off {formatDateTime(mainEvent.completed_at)})</span>
                      )}
                    </p>
                  </div>

                  {/* Actions for Main Event */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopySapForOrder(asset, mainEvent)}
                      className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition shadow-2xs ${
                        copiedWoId === mainEvent.id ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                      }`}
                      title="Copy SAP Confirmation for this Main Event"
                    >
                      {copiedWoId === mainEvent.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedWoId === mainEvent.id ? 'Copied' : 'Copy for SAP'}
                    </button>

                    {mainEvent.status !== 'COMPLETED' && (
                      <>
                        <select
                          value={mainEvent.stage || 'DIAGNOSING'}
                          onChange={(e) => updateWorkOrderStage(mainEvent.id, asset.id, e.target.value)}
                          className="bg-white border border-slate-300 text-slate-700 font-bold text-xs p-2.5 rounded-xl focus:border-amber-500 shadow-2xs cursor-pointer"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => signOffWorkOrder(mainEvent.id, asset.id)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4 text-emerald-400" /> Sign Off Main Event
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. ADDITIONAL WORK ORDERS / DOWN TIME EVENTS */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Additional Work Orders & Down Time Scopes ({additionalOrders.length})
                </span>
                <button
                  onClick={() => openAddWorkOrder(asset)}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Attach Additional Work Order
                </button>
              </div>

              {additionalOrders.length === 0 ? (
                <div className="p-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-center">
                  <p className="text-xs text-slate-400">
                    No secondary work orders attached. Click "+ Attach Additional Work Order" to add extra repair scopes.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {additionalOrders.map((wo) => {
                    const isDone = wo.status === 'COMPLETED';
                    return (
                      <div
                        key={wo.id}
                        className={`py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                          isDone ? 'opacity-60 bg-slate-50/50 px-3 rounded-xl' : ''
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border bg-sky-50 text-sky-800 border-sky-200">
                              <FileText className="w-3 h-3 inline mr-1" />
                              {wo.wo_number || 'NO SAP WO'} ({wo.order_type})
                            </span>
                            {wo.component_systems?.map((sys) => (
                              <span key={sys} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {sys}
                              </span>
                            ))}
                            {isDone && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                <Check className="w-3 h-3" /> COMPLETED
                              </span>
                            )}
                          </div>

                          <p className={`text-sm text-slate-900 ${isDone ? 'line-through text-slate-500' : 'font-semibold'}`}>
                            {wo.task_description}
                          </p>

                          <p className="text-xs text-slate-500">
                            Fitter: <strong className="text-slate-700">{wo.fitter_assigned || 'Unassigned'}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleCopySapForOrder(asset, wo)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition shadow-2xs ${
                              copiedWoId === wo.id ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            {copiedWoId === wo.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedWoId === wo.id ? 'Copied' : 'SAP Copy'}
                          </button>

                          {!isDone && (
                            <>
                              <select
                                value={wo.stage || 'DIAGNOSING'}
                                onChange={(e) => updateWorkOrderStage(wo.id, asset.id, e.target.value)}
                                className="bg-white border border-slate-300 text-slate-700 font-bold text-xs p-2 rounded-lg"
                              >
                                {STAGES.map((s) => (
                                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                                ))}
                              </select>

                              <button
                                onClick={() => signOffWorkOrder(wo.id, asset.id)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-400" /> Sign Off Task
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. DEFECT RIBBON ALONG THE BOTTOM */}
            {activeDefects.length > 0 ? (
              <div
                onClick={() => openDefects(asset)}
                className="bg-rose-50 border-t border-rose-200 px-5 py-3.5 cursor-pointer hover:bg-rose-100 transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner"
              >
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{activeDefects.length} Open Defect(s) Identified:</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {activeDefects.map((d) => (
                    <span
                      key={d.id}
                      className="bg-white border border-rose-300 text-rose-900 text-xs font-bold px-2.5 py-1 rounded-md shadow-2xs"
                    >
                      [{d.severity}] {d.description} {d.wo_number && <strong className="text-indigo-700 font-mono">({d.wo_number})</strong>}
                    </span>
                  ))}
                  <span className="text-xs font-bold text-rose-700 underline flex items-center ml-2">
                    Manage / Add Work Orders & Notes <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => openDefects(asset)}
                className="bg-slate-50 hover:bg-slate-100 border-t border-slate-200 px-5 py-2.5 cursor-pointer transition flex items-center justify-between text-xs text-slate-500"
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  No open defects logged against this machine.
                </span>
                <span className="text-xs font-bold text-amber-700 underline">
                  + Log Defect & Assign Work Order
                </span>
              </div>
            )}

            {/* 5. RELEASE FOOTER */}
            <div className="px-5 py-4 bg-slate-100/90 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                {canRelease ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Main event, all additional work orders, and defects cleared. Ready for release.
                  </span>
                ) : (
                  <span className="text-slate-700 font-medium flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Machine Held Down: <strong className="text-slate-900">{openOrders.length} work order(s)</strong> and{' '}
                    <strong className="text-slate-900">{activeDefects.length} defect(s)</strong> still open.
                  </span>
                )}
              </div>

              <button
                disabled={!canRelease}
                onClick={() => releaseMachineToProduction(asset.id)}
                className={`px-6 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition shadow-md flex items-center justify-center gap-2 ${
                  canRelease
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Release Machine to Production
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}