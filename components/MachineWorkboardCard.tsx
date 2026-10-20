import { useState } from 'react';
import { 
  CheckCircle2, Clock, User, History, FileText, AlertTriangle, Plus, 
  Copy, Check, ShieldAlert, ChevronDown, ChevronUp, Edit3, Star, 
  MessageSquare, PlusCircle, Wrench, AlertOctagon 
} from 'lucide-react';
import { Asset, STAGE_OPTIONS, DefectItem, MachineWorkOrder, HistoryNote } from '@/types';
import { formatDateTime, getElapsedDown, getEtuStatus } from '@/utils/helpers';
import { generateSapNotesText, copyToClipboard } from '@/utils/sapFormatter';
import { createClient } from '@/utils/supabase/client';
import InlineNotesDrawer from '@/components/InlineNotesDrawer';

interface MachineWorkboardCardProps {
  asset: Asset;
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  notes: HistoryNote[];
  activeFitter: string;
  isDetailsExpanded: boolean;
  toggleExpandDetails: () => void;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
  signOffWorkOrder: (woId: string, assetId: string) => void;
  openAddWorkOrder: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
  openDefects: (asset: Asset) => void;
  openQuickEdit: (asset: Asset) => void;
  releaseMachineToProduction: (assetId: string) => void;
  onRefresh: () => void;
}

export default function MachineWorkboardCard({
  asset,
  workOrders,
  defects,
  notes,
  activeFitter,
  isDetailsExpanded,
  toggleExpandDetails,
  updateWorkOrderStage,
  signOffWorkOrder,
  openAddWorkOrder,
  openHistory,
  openDefects,
  openQuickEdit,
  releaseMachineToProduction,
  onRefresh,
}: MachineWorkboardCardProps) {
  const [expandedNotesItemIds, setExpandedNotesItemIds] = useState<Set<string>>(new Set());
  const [inlineWoInputs, setInlineWoInputs] = useState<Record<string, string>>({});
  const [activeInlineWoTarget, setActiveInlineWoTarget] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const supabase = createClient();

  const isPlanned = asset.status === 'DOWN_PLANNED';
  const etu = getEtuStatus(asset.expected_up);

  const machineOrders = workOrders.filter((w) => w.asset_id === asset.id);
  const mainEvent = machineOrders.find((w) => w.is_main_event) || machineOrders[0];
  const additionalOrders = machineOrders.filter((w) => w.id !== mainEvent?.id);
  const openOrders = machineOrders.filter((w) => w.status === 'OPEN');
  
  const machineDefects = defects.filter((d) => d.asset_id === asset.id);
  const activeDefects = machineDefects.filter((d) => d.status === 'OPEN'); 

  const canRelease = openOrders.length === 0 && activeDefects.length === 0;

  // 4 Event Classifications (Planned, Breakdown, Inspection, Accident Damage)
  const eventType = (mainEvent?.order_type || (isPlanned ? 'PLANNED' : 'UNPLANNED')).toUpperCase();

  const eventConfig = {
    PLANNED: {
      border: 'border-l-emerald-500',
      badge: 'bg-emerald-600 text-white',
      label: 'PLANNED',
      icon: <Wrench className="w-3 h-3" />,
    },
    INSPECTION: {
      border: 'border-l-sky-500',
      badge: 'bg-sky-600 text-white',
      label: 'INSPECTION',
      icon: <FileText className="w-3 h-3" />,
    },
    ACCIDENT_DAMAGE: {
      border: 'border-l-orange-500',
      badge: 'bg-orange-600 text-white',
      label: 'ACCIDENT DAMAGE',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    UNPLANNED: {
      border: 'border-l-rose-600',
      badge: 'bg-rose-600 text-white',
      label: 'BREAKDOWN',
      icon: <AlertOctagon className="w-3 h-3" />,
    },
  }[eventType] || {
    border: isPlanned ? 'border-l-emerald-500' : 'border-l-rose-600',
    badge: isPlanned ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white',
    label: isPlanned ? 'PLANNED' : 'BREAKDOWN',
    icon: isPlanned ? <Wrench className="w-3 h-3" /> : <AlertOctagon className="w-3 h-3" />,
  };

  const sideBorder = eventConfig.border;

  // Standardized Priority Matrix: P1 - Critical, P2 - High, P3 - Medium, P4 - Low, No Priority
  const priorityBadgeBg =
    asset.priority === 'P1'
      ? 'bg-rose-100 text-rose-800 border-rose-300'
      : asset.priority === 'P2'
      ? 'bg-orange-100 text-orange-800 border-orange-300'
      : asset.priority === 'P3'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : asset.priority === 'P4'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : 'bg-slate-100 text-slate-700 border-slate-300';

  const priorityLabel =
    asset.priority === 'P1'
      ? 'P1 - CRITICAL'
      : asset.priority === 'P2'
      ? 'P2 - HIGH'
      : asset.priority === 'P3'
      ? 'P3 - MEDIUM'
      : asset.priority === 'P4'
      ? 'P4 - LOW'
      : 'NO PRIORITY';

  function toggleItemNotes(id: string) {
    setExpandedNotesItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCopySapNotes(itemId: string, filterKeyword?: string) {
    const assetNotes = notes.filter((n) => n.asset_id === asset.id);
    const text = generateSapNotesText(assetNotes, filterKeyword);
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(itemId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  async function handleSaveInlineWo(type: 'WORK_ORDER' | 'DEFECT', id: string) {
    const woNum = (inlineWoInputs[id] || '').trim();
    if (!woNum) return;

    if (type === 'WORK_ORDER') {
      await supabase.from('machine_work_orders').update({ wo_number: woNum }).eq('id', id);
    } else {
      await supabase.from('defect_watchlist').update({ wo_number: woNum, order_type: 'PM03' }).eq('id', id);
    }

    await supabase.from('asset_history_notes').insert([{
      asset_id: asset.id,
      fitter_name: activeFitter || 'Planner',
      note: `Assigned SAP Work Order #${woNum} to item.`,
      stage: 'IN_REPAIR'
    }]);

    setActiveInlineWoTarget(null);
    setInlineWoInputs((prev) => ({ ...prev, [id]: '' }));
    onRefresh();
  }

  async function handleToggleDefectFixed(defect: DefectItem) {
    const isNowFixed = defect.status === 'OPEN';
    const nextStatus = isNowFixed ? 'FIXED_THIS_SHIFT' : 'OPEN';

    await supabase.from('defect_watchlist').update({
      status: nextStatus,
      rectified_by: isNowFixed ? (activeFitter || defect.fitter_assigned || 'Shift Fitter') : null,
      rectified_at: isNowFixed ? new Date().toISOString() : null,
      stage: isNowFixed ? 'COMPLETED' : 'IN_REPAIR'
    }).eq('id', defect.id);

    await supabase.from('asset_history_notes').insert([{
      asset_id: asset.id,
      fitter_name: activeFitter || 'Shift Fitter',
      note: isNowFixed ? `Defect [${defect.severity}] marked FIXED: ${defect.description}` : `Defect [${defect.severity}] REOPENED.`,
      stage: isNowFixed ? 'COMPLETED' : 'IN_REPAIR'
    }]);

    onRefresh();
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-300 border-l-8 ${sideBorder} shadow-sm overflow-hidden`}>
      {/* 1. TOP BANNER */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${eventConfig.badge}`}>
            {eventConfig.icon}
            {eventConfig.label}
          </span>

          <button
            onClick={() => openQuickEdit(asset)}
            className={`text-[10px] font-black px-2.5 py-0.5 rounded border uppercase tracking-wider hover:opacity-80 transition cursor-pointer ${priorityBadgeBg}`}
          >
            {priorityLabel}
          </button>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 tracking-wide">{asset.fleet_id}</span>
            <span className="text-xs font-bold text-slate-600">{asset.make_model}</span>
          </div>

          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            {asset.machine_owner || 'Central'}
          </span>

          <button
            onClick={() => openQuickEdit(asset)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 hover:border-amber-400 text-xs font-semibold text-slate-700 transition shadow-2xs"
          >
            <span className="text-slate-400">Loc / Bay:</span>
            <strong className="text-slate-900">{asset.location || 'Unassigned'}</strong>
            <Edit3 className="w-3 h-3 text-amber-600 ml-0.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => openQuickEdit(asset)}
            className="bg-white hover:bg-slate-50 px-2.5 py-1 rounded border border-slate-200 text-[11px] font-medium text-slate-600 transition shadow-2xs text-left"
          >
            Down: <strong className="font-mono text-rose-700 font-bold">{getElapsedDown(asset.down_since)}</strong>
          </button>

          <button
            onClick={() => openQuickEdit(asset)}
            className="bg-white hover:bg-slate-50 px-2.5 py-1 rounded border border-slate-200 text-[11px] font-medium text-slate-600 transition shadow-2xs text-left"
          >
            ETU: <strong className="font-mono text-slate-900 font-bold">{formatDateTime(asset.expected_up)}</strong>
            {etu && (
              <span className={`ml-1.5 px-1 rounded text-[10px] font-black ${etu.overdue ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50'}`}>
                {etu.label}
              </span>
            )}
          </button>

          <button
            onClick={() => openQuickEdit(asset)}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded text-xs font-bold transition shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Edit
          </button>

          <button
            onClick={() => openHistory(asset)}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-800 text-xs font-bold transition shadow-2xs"
          >
            <History className="w-3.5 h-3.5 text-amber-600" /> SAP Notes
          </button>
        </div>
      </div>

      {/* 2. MAIN DOWN TIME EVENT (ALWAYS VISIBLE) */}
      {mainEvent && (
        <div className="p-4 bg-amber-50/50 border-b border-amber-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/60">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-600 fill-amber-500" />
              <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                MAIN DOWN TIME EVENT (PRIMARY REASON DOWN)
              </span>
            </div>
            {mainEvent.status === 'COMPLETED' ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                <Check className="w-3 h-3" /> COMPLETE
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-900 bg-amber-200 border border-amber-300 px-2 py-0.5 rounded uppercase">
                {STAGE_OPTIONS.find((s) => s.value === (mainEvent.stage || 'IN_PROGRESS'))?.label || 'IN PROGRESS'}
              </span>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1 flex-1">
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
                <span>Allocated Fitter: <strong className="text-slate-800">{mainEvent.fitter_assigned || 'Unassigned'}</strong></span>
                {mainEvent.completed_at && (
                  <span className="text-emerald-700 ml-2 font-medium">(Signed off {formatDateTime(mainEvent.completed_at)} by {mainEvent.completed_by})</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
  onClick={() => handleCopySapNotes(mainEvent.id, 'Main Event')}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition shadow-2xs ${
                  copiedId === mainEvent.id ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                }`}
              >
                {copiedId === mainEvent.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === mainEvent.id ? 'Notes Copied!' : 'Copy SAP Notes'}
              </button>

              <button
                onClick={() => toggleItemNotes(mainEvent.id)}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 transition"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" /> Notes
              </button>

              {mainEvent.status !== 'COMPLETED' && (
                <>
                  <select
                    value={mainEvent.stage || 'IN_PROGRESS'}
                    onChange={(e) => {
                      if (e.target.value === 'COMPLETED') {
                        signOffWorkOrder(mainEvent.id, asset.id);
                      } else {
                        updateWorkOrderStage(mainEvent.id, asset.id, e.target.value);
                      }
                    }}
                    className="bg-white border border-slate-300 text-slate-700 font-bold text-xs p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {STAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => signOffWorkOrder(mainEvent.id, asset.id)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center gap-1"
                  >
                    <Check className="w-4 h-4 text-emerald-400" /> Sign Off Main Event
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Reusable Inline Notes */}
          {expandedNotesItemIds.has(mainEvent.id) && (
            <InlineNotesDrawer
              assetId={asset.id}
              itemId={mainEvent.id}
              contextLabel="Main Event Note"
              notes={notes}
              activeFitter={activeFitter}
              onRefresh={onRefresh}
            />
          )}
        </div>
      )}

      {/* 3. ACCORDION TOGGLE STRIP */}
      <div
        onClick={toggleExpandDetails}
        className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer flex items-center justify-between text-xs font-bold text-slate-700 transition border-t border-slate-200"
      >
        <div className="flex items-center gap-2">
          {isDetailsExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
          <span>{isDetailsExpanded ? 'Hide' : 'Show'} Active Work Orders ({additionalOrders.length}) & Defects ({machineDefects.length})</span>
          {activeDefects.length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded border border-rose-300 text-[10px]">
              {activeDefects.length} Open Defect(s)
            </span>
          )}
        </div>
        <span className="text-[11px] font-semibold text-slate-500 underline">
          {isDetailsExpanded ? 'Collapse Drawer' : 'Expand Drawer'}
        </span>
      </div>

      {/* 4. EXPANDABLE DRAWER */}
      {isDetailsExpanded && (
        <div className="p-5 border-t border-slate-200 space-y-5 bg-white">
          {/* 4A. ADDITIONAL WORK ORDERS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Active Work Orders ({additionalOrders.length})
              </span>
              <button
                onClick={() => openAddWorkOrder(asset)}
                className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Work Order
              </button>
            </div>

            {additionalOrders.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                <p className="text-xs text-slate-400">No secondary work orders attached.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {additionalOrders.map((wo) => {
                  const isDone = wo.status === 'COMPLETED';
                  const isAttachingWo = activeInlineWoTarget === wo.id;

                  return (
                    <div key={wo.id} className={`p-3 rounded-lg border transition ${isDone ? 'opacity-60 bg-slate-50 border-slate-200' : 'bg-white border-slate-300 shadow-2xs'}`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {wo.wo_number ? (
                              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border bg-sky-50 text-sky-800 border-sky-200">
                                <FileText className="w-3 h-3 inline mr-1" />
                                {wo.wo_number} ({wo.order_type})
                              </span>
                            ) : (
                              <button
                                onClick={() => setActiveInlineWoTarget(wo.id)}
                                className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 flex items-center gap-1"
                              >
                                <PlusCircle className="w-3 h-3" /> Attach SAP WO
                              </button>
                            )}

                            {wo.component_systems?.map((sys) => (
                              <span key={sys} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{sys}</span>
                            ))}

                            {isDone && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                <Check className="w-3 h-3" /> COMPLETED
                              </span>
                            )}
                          </div>

                          <p className={`text-sm text-slate-900 ${isDone ? 'line-through text-slate-500' : 'font-semibold'}`}>{wo.task_description}</p>
                          <p className="text-xs text-slate-500">Fitter: <strong className="text-slate-700">{wo.fitter_assigned || 'Unassigned'}</strong></p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleCopySapNotes(wo.id, wo.task_description.slice(0, 15))}
                            className={`flex items-center gap-1 px-2.5 py-1 border rounded text-xs font-bold transition ${copiedId === wo.id ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'}`}
                          >
                            {copiedId === wo.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedId === wo.id ? 'Copied' : 'SAP Notes'}
                          </button>

                          <button onClick={() => toggleItemNotes(wo.id)} className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-bold text-slate-600">
                            <MessageSquare className="w-3 h-3 text-slate-500" /> Notes
                          </button>

                          {!isDone && (
                            <>
                              <select
                                value={wo.stage || 'IN_PROGRESS'}
                                onChange={(e) => {
                                  if (e.target.value === 'COMPLETED') {
                                    signOffWorkOrder(wo.id, asset.id);
                                  } else {
                                    updateWorkOrderStage(wo.id, asset.id, e.target.value);
                                  }
                                }}
                                className="bg-white border border-slate-300 text-slate-700 font-bold text-xs p-1 rounded focus:outline-none focus:ring-2 focus:ring-slate-400"
                              >
                                {STAGE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => signOffWorkOrder(wo.id, asset.id)}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded transition flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-400" /> Sign Off
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isAttachingWo && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="SAP WO #"
                            value={inlineWoInputs[wo.id] || ''}
                            onChange={(e) =>
                              setInlineWoInputs({ ...inlineWoInputs, [wo.id]: e.target.value })
                            }
                            className="bg-slate-50 border border-slate-300 rounded p-1 text-xs font-mono font-bold w-44 focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                          <button
                            onClick={() => handleSaveInlineWo('WORK_ORDER', wo.id)}
                            className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded hover:bg-indigo-500 transition"
                          >
                            Save WO
                          </button>
                          <button
                            onClick={() => setActiveInlineWoTarget(null)}
                            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {expandedNotesItemIds.has(wo.id) && (
                        <InlineNotesDrawer
                          assetId={asset.id}
                          itemId={wo.id}
                          contextLabel={wo.task_description.slice(0, 15)}
                          notes={notes}
                          activeFitter={activeFitter}
                          onRefresh={onRefresh}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4B. DEFECTS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Defects Found ({machineDefects.length})
              </span>
              <button
                onClick={() => openDefects(asset)}
                className="flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" /> Log Defect
              </button>
            </div>

            {machineDefects.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                <p className="text-xs text-slate-400">Zero defects reported on machine.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {machineDefects.map((defect) => {
                  const isFixed = defect.status === 'FIXED_THIS_SHIFT';
                  const isAttachingWo = activeInlineWoTarget === defect.id;

                  return (
                    <div
                      key={defect.id}
                      className={`p-3 rounded-lg border transition ${
                        isFixed
                          ? 'opacity-50 bg-slate-50 border-slate-200'
                          : 'bg-rose-50/30 border-rose-200'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${
                                defect.severity === 'CAT1'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : defect.severity === 'CAT2'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-sky-100 text-sky-800 border-sky-300'
                              }`}
                            >
                              {defect.severity}
                            </span>

                            {defect.wo_number ? (
                              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border bg-white text-indigo-700 border-indigo-200">
                                <FileText className="w-3 h-3 inline mr-1" /> {defect.wo_number} (PM03)
                              </span>
                            ) : (
                              <button
                                onClick={() => setActiveInlineWoTarget(defect.id)}
                                className="text-[10px] font-bold text-amber-700 bg-white border border-amber-300 px-2 py-0.5 rounded hover:bg-amber-50 flex items-center gap-1"
                              >
                                <PlusCircle className="w-3 h-3" /> Attach SAP WO
                              </button>
                            )}

                            {defect.component_systems?.map((sys) => (
                              <span
                                key={sys}
                                className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200"
                              >
                                {sys}
                              </span>
                            ))}
                          </div>

                          <p
                            className={`text-sm text-slate-900 ${
                              isFixed ? 'line-through text-slate-400' : 'font-semibold'
                            }`}
                          >
                            {defect.description}
                          </p>
                          <p className="text-xs text-slate-500">
                            Reported by:{' '}
                            <strong className="text-slate-700">{defect.reported_by}</strong>{' '}
                            {isFixed && `• Fixed by ${defect.rectified_by || 'Fitter'}`}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            onClick={() =>
                              handleCopySapNotes(defect.id, defect.description.slice(0, 15))
                            }
                            className={`flex items-center gap-1 px-2.5 py-1 border rounded text-xs font-bold transition ${
                              copiedId === defect.id
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            {copiedId === defect.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {copiedId === defect.id ? 'Copied' : 'SAP Notes'}
                          </button>

                          <button
                            onClick={() => toggleItemNotes(defect.id)}
                            className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-bold text-slate-600"
                          >
                            <MessageSquare className="w-3 h-3 text-slate-500" /> Notes
                          </button>

                          <button
                            onClick={() => handleToggleDefectFixed(defect)}
                            className={`px-3 py-1 font-bold text-xs rounded transition flex items-center gap-1 ${
                              isFixed
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> {isFixed ? 'Reopen' : 'Mark Fixed'}
                          </button>
                        </div>
                      </div>

                      {isAttachingWo && (
                        <div className="mt-2 pt-2 border-t border-rose-100 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="SAP WO #"
                            value={inlineWoInputs[defect.id] || ''}
                            onChange={(e) =>
                              setInlineWoInputs({ ...inlineWoInputs, [defect.id]: e.target.value })
                            }
                            className="bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold w-44 focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                          <button
                            onClick={() => handleSaveInlineWo('DEFECT', defect.id)}
                            className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded hover:bg-indigo-500 transition"
                          >
                            Save WO
                          </button>
                          <button
                            onClick={() => setActiveInlineWoTarget(null)}
                            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {expandedNotesItemIds.has(defect.id) && (
                        <InlineNotesDrawer
                          assetId={asset.id}
                          itemId={defect.id}
                          contextLabel={defect.description.slice(0, 15)}
                          notes={notes}
                          activeFitter={activeFitter}
                          onRefresh={onRefresh}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4C. RELEASE MACHINE */}
          <div className="p-3.5 bg-slate-100/90 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              {canRelease ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ready for release. All scopes and defects cleared.
                </span>
              ) : (
                <span className="text-slate-700 font-medium flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Held Down: <strong className="text-slate-900">{openOrders.length} task(s)</strong> and{' '}
                  <strong className="text-slate-900">{activeDefects.length} defect(s)</strong> open.
                </span>
              )}
            </div>

            <button
              disabled={!canRelease}
              onClick={() => releaseMachineToProduction(asset.id)}
              className={`px-5 py-2.5 rounded-lg text-xs font-black tracking-wider uppercase transition shadow-sm flex items-center justify-center gap-1.5 ${
                canRelease
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Release Machine
            </button>
          </div>
        </div>
      )}
    </div>
  );
}