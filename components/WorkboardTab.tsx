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
  ChevronDown,
  ChevronUp,
  Edit3,
  Star,
  MessageSquare,
  Send,
  PlusCircle
} from 'lucide-react';
import { Asset, STAGES, DefectItem, MachineWorkOrder, HistoryNote } from '@/types';
import { formatDateTime, getElapsedDown, getEtuStatus } from '@/utils/helpers';
import { generateSapNotesText, copyToClipboard } from '@/utils/sapFormatter';
import { createClient } from '@/utils/supabase/client';

interface WorkboardTabProps {
  shiftJobs: Asset[];
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  notes: HistoryNote[];
  loading: boolean;
  activeFitter: string;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
  signOffWorkOrder: (woId: string, assetId: string) => void;
  openAddWorkOrder: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
  openDefects: (asset: Asset) => void;
  openQuickEdit: (asset: Asset) => void;
  releaseMachineToProduction: (assetId: string) => void;
  onRefresh: () => void;
}

export default function WorkboardTab({
  shiftJobs,
  workOrders,
  defects,
  notes,
  loading,
  activeFitter,
  updateWorkOrderStage,
  signOffWorkOrder,
  openAddWorkOrder,
  openHistory,
  openDefects,
  openQuickEdit,
  releaseMachineToProduction,
  onRefresh,
}: WorkboardTabProps) {
  // Accordion open/close state for additional details below the main event
  const [expandedDetailsAssetIds, setExpandedDetailsAssetIds] = useState<Set<string>>(new Set());
  
  // Inline notes accordion open/close per item
  const [expandedNotesItemIds, setExpandedNotesItemIds] = useState<Set<string>>(new Set());
  const [noteInputText, setNoteInputText] = useState<Record<string, string>>({});
  const [customFitterInput, setCustomFitterInput] = useState<Record<string, string>>({});
  
  // Inline attach WO state
  const [inlineWoInputs, setInlineWoInputs] = useState<Record<string, string>>({});
  const [activeInlineWoTarget, setActiveInlineWoTarget] = useState<string | null>(null);

  // Copied indicator state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const supabase = createClient();

  function toggleExpandDetails(assetId: string) {
    setExpandedDetailsAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function toggleExpandItemNotes(itemId: string) {
    setExpandedNotesItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  // Copy ONLY the clean SAP Notes for a specific event or work order
  async function handleCopySapNotes(itemId: string, assetId: string, filterKeyword?: string) {
    const assetNotes = notes.filter((n) => n.asset_id === assetId);
    const text = generateSapNotesText(assetNotes, filterKeyword);
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(itemId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  // Add inline note stamped with real fitter name & ID
  async function handleAddInlineNote(assetId: string, itemId: string, contextLabel: string) {
    const text = (noteInputText[itemId] || '').trim();
    if (!text) return;

    const fitterStamp = (customFitterInput[itemId] || activeFitter || 'Fitter').trim();

    await supabase.from('asset_history_notes').insert([{
      asset_id: assetId,
      fitter_name: fitterStamp,
      note: `[${contextLabel}]: ${text}`,
      stage: 'IN_REPAIR'
    }]);

    setNoteInputText((prev) => ({ ...prev, [itemId]: '' }));
    onRefresh();
  }

  // Attach Work Order #
  async function handleSaveInlineWo(type: 'WORK_ORDER' | 'DEFECT', id: string, assetId: string) {
    const woNum = (inlineWoInputs[id] || '').trim();
    if (!woNum) return;

    if (type === 'WORK_ORDER') {
      await supabase.from('machine_work_orders').update({ wo_number: woNum }).eq('id', id);
    } else {
      await supabase.from('defect_watchlist').update({ wo_number: woNum, order_type: 'PM03' }).eq('id', id);
    }

    await supabase.from('asset_history_notes').insert([{
      asset_id: assetId,
      fitter_name: activeFitter || 'Planner',
      note: `Assigned SAP Work Order #${woNum} to item.`,
      stage: 'IN_REPAIR'
    }]);

    setActiveInlineWoTarget(null);
    setInlineWoInputs((prev) => ({ ...prev, [id]: '' }));
    onRefresh();
  }

  async function handleToggleDefectFixed(defect: DefectItem, assetId: string) {
    const isNowFixed = defect.status === 'OPEN';
    const nextStatus = isNowFixed ? 'FIXED_THIS_SHIFT' : 'OPEN';

    await supabase.from('defect_watchlist').update({
      status: nextStatus,
      rectified_by: isNowFixed ? (activeFitter || defect.fitter_assigned || 'Fitter') : null,
      rectified_at: isNowFixed ? new Date().toISOString() : null,
      stage: isNowFixed ? 'COMPLETED' : 'IN_REPAIR'
    }).eq('id', defect.id);

    await supabase.from('asset_history_notes').insert([{
      asset_id: assetId,
      fitter_name: activeFitter || 'Fitter',
      note: isNowFixed ? `Defect [${defect.severity}] marked FIXED: ${defect.description}` : `Defect [${defect.severity}] REOPENED.`,
      stage: isNowFixed ? 'COMPLETED' : 'IN_REPAIR'
    }]);

    onRefresh();
  }

  async function handleUpdateDefectStage(defectId: string, assetId: string, newStage: string) {
    await supabase.from('defect_watchlist').update({ stage: newStage }).eq('id', defectId);
    await supabase.from('asset_history_notes').insert([{
      asset_id: assetId,
      fitter_name: activeFitter || 'Fitter',
      note: `Defect stage updated to ${newStage.replace('_', ' ')}`,
      stage: newStage
    }]);
    onRefresh();
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent mb-3" />
        <p className="text-slate-600 text-sm font-semibold">Loading active shift workboard...</p>
      </div>
    );
  }

  const validShiftJobs = shiftJobs.filter((asset) => 
    workOrders.some((wo) => wo.asset_id === asset.id)
  );

  if (validShiftJobs.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-slate-300 rounded-2xl max-w-xl mx-auto mt-8 shadow-md">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Zero Active Work Orders</h2>
        <p className="text-xs text-slate-500 mt-1">All machines are clear or no work orders attached.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      {validShiftJobs.map((asset) => {
        const isDetailsExpanded = expandedDetailsAssetIds.has(asset.id);
        const isP1 = asset.priority === 'P1';
        const isP2 = asset.priority === 'P2';
        const isP3 = asset.priority === 'P3';
        const etu = getEtuStatus(asset.expected_up);

        const machineOrders = workOrders.filter((w) => w.asset_id === asset.id);
        const mainEvent = machineOrders.find((w) => w.is_main_event) || machineOrders[0];
        const additionalOrders = machineOrders.filter((w) => w.id !== mainEvent?.id);
        const openOrders = machineOrders.filter((w) => w.status === 'OPEN');
        
        const machineDefects = defects.filter((d) => d.asset_id === asset.id);
        const activeDefects = machineDefects.filter((d) => d.status === 'OPEN'); 

        const canRelease = openOrders.length === 0 && activeDefects.length === 0;

        const priorityBorder = isP1
          ? 'border-l-rose-600'
          : isP2
          ? 'border-l-amber-500'
          : isP3
          ? 'border-l-blue-600'
          : 'border-l-slate-400';

        const priorityBadgeBg = isP1
          ? 'bg-rose-100 text-rose-800 border-rose-300'
          : isP2
          ? 'bg-amber-100 text-amber-900 border-amber-300'
          : isP3
          ? 'bg-blue-100 text-blue-800 border-blue-300'
          : 'bg-slate-100 text-slate-700 border-slate-300';

        return (
          <div
            key={asset.id}
            className={`bg-white rounded-xl border border-slate-300 border-l-8 ${priorityBorder} shadow-sm overflow-hidden`}
          >
            {/* 1. TOP BANNER */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Priority Badge (Clickable to edit) */}
                <button
                  onClick={() => openQuickEdit(asset)}
                  className={`text-[11px] font-black px-2.5 py-0.5 rounded border uppercase tracking-wider hover:opacity-80 transition cursor-pointer ${priorityBadgeBg}`}
                  title="Click to change Priority"
                >
                  {asset.priority || 'ROUTINE'}
                </button>

                {/* Fleet ID & Model */}
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-slate-900 tracking-wide">{asset.fleet_id}</span>
                  <span className="text-xs font-bold text-slate-600">{asset.make_model}</span>
                </div>

                {/* Owner Tag */}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {asset.machine_owner || 'Central'}
                </span>

                {/* Bay Location (Clickable to edit) */}
                <button
                  onClick={() => openQuickEdit(asset)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 hover:border-amber-400 text-xs font-semibold text-slate-700 transition shadow-2xs"
                  title="Click to edit Bay Location"
                >
                  <span className="text-slate-400">Bay:</span>
                  <strong className="text-slate-900">{asset.location || 'Workshop Yard'}</strong>
                  <Edit3 className="w-3 h-3 text-amber-600 ml-0.5" />
                </button>
              </div>

              {/* Banner Right Side: Timings & Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {/* Down Time Elapsed (Clickable to edit) */}
                <button
                  onClick={() => openQuickEdit(asset)}
                  className="bg-white hover:bg-slate-50 px-2.5 py-1 rounded border border-slate-200 text-[11px] font-medium text-slate-600 transition shadow-2xs text-left"
                  title="Click to edit Down Time"
                >
                  Down: <strong className="font-mono text-rose-700 font-bold">{getElapsedDown(asset.down_since)}</strong>
                </button>

                {/* Expected Up Time (Clickable to edit) */}
                <button
                  onClick={() => openQuickEdit(asset)}
                  className="bg-white hover:bg-slate-50 px-2.5 py-1 rounded border border-slate-200 text-[11px] font-medium text-slate-600 transition shadow-2xs text-left"
                  title="Click to edit ETU"
                >
                  ETU: <strong className="font-mono text-slate-900 font-bold">{formatDateTime(asset.expected_up)}</strong>
                  {etu && (
                    <span className={`ml-1.5 px-1 rounded text-[10px] font-black ${etu.overdue ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50'}`}>
                      {etu.label}
                    </span>
                  )}
                </button>

                {/* Direct Edit Button */}
                <button
                  onClick={() => openQuickEdit(asset)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded text-xs font-bold transition shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  Edit Times / Priority
                </button>

                {/* SAP Notes Running Log Button */}
                <button
                  onClick={() => openHistory(asset)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-800 text-xs font-bold transition shadow-2xs"
                  title="View full running SAP Notes for this machine"
                >
                  <History className="w-3.5 h-3.5 text-amber-600" />
                  SAP Notes
                </button>
              </div>
            </div>

            {/* 2. MAIN DOWN TIME EVENT (ALWAYS VISIBLE RIGHT UNDER BANNER) */}
            {mainEvent && (
              <div className="p-4 bg-amber-50/50 border-b border-amber-200">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/60">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-600 fill-amber-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                      MAIN DOWN TIME EVENT (PRIMARY REASON MACHINE IS DOWN)
                    </span>
                  </div>
                  {mainEvent.status === 'COMPLETED' ? (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                      <Check className="w-3 h-3" /> MAIN EVENT COMPLETED
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-900 bg-amber-200 border border-amber-300 px-2 py-0.5 rounded uppercase">
                      ACTIVE EVENT
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

                  {/* Main Event Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Copy ONLY the clean progressive SAP Notes */}
                    <button
                      onClick={() => handleCopySapNotes(mainEvent.id, asset.id, mainEvent.task_description.slice(0, 15))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition shadow-2xs ${
                        copiedId === mainEvent.id ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                      }`}
                      title="Copy clean progressive notes for SAP confirmation"
                    >
                      {copiedId === mainEvent.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === mainEvent.id ? 'Notes Copied!' : 'Copy SAP Notes'}
                    </button>

                    <button
                      onClick={() => toggleExpandItemNotes(mainEvent.id)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                      SAP Notes ({notes.filter(n => n.asset_id === asset.id && n.note.includes('Main Event')).length})
                    </button>

                    {mainEvent.status !== 'COMPLETED' && (
                      <>
                        <select
                          value={mainEvent.stage || 'DIAGNOSING'}
                          onChange={(e) => updateWorkOrderStage(mainEvent.id, asset.id, e.target.value)}
                          className="bg-white border border-slate-300 text-slate-700 font-bold text-xs p-1.5 rounded-lg"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
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

                {/* Inline Expandable SAP Notes for Main Event */}
                {expandedNotesItemIds.has(mainEvent.id) && (
                  <div className="mt-3 pt-3 border-t border-amber-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                      Main Event SAP Progressive Notes:
                    </span>
                    
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {notes
                        .filter((n) => n.asset_id === asset.id && n.note.includes('Main Event'))
                        .map((n) => (
                          <div key={n.id} className="text-xs bg-white p-2 rounded border border-amber-200 flex items-start gap-2 shadow-2xs">
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">{formatDateTime(n.created_at)}</span>
                            <span className="font-bold text-amber-800 shrink-0">[{n.fitter_name}]:</span>
                            <span className="text-slate-800">{n.note.replace(/^\[.*?\]:\s*/, '')}</span>
                          </div>
                        ))}
                    </div>

                    {/* Stamped Note Adder */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Fitter Name & ID (e.g. D. Kelly #4821)"
                        value={customFitterInput[mainEvent.id] ?? activeFitter}
                        onChange={(e) => setCustomFitterInput({ ...customFitterInput, [mainEvent.id]: e.target.value })}
                        className="sm:w-56 bg-white border border-amber-300 rounded p-1.5 text-xs font-bold text-slate-900"
                      />
                      <input
                        type="text"
                        placeholder="Type SAP note (e.g. Drained oils, replaced strut seals, pressure tested)..."
                        value={noteInputText[mainEvent.id] || ''}
                        onChange={(e) => setNoteInputText({ ...noteInputText, [mainEvent.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddInlineNote(asset.id, mainEvent.id, 'Main Event Note');
                        }}
                        className="flex-1 bg-white border border-amber-300 rounded p-1.5 text-xs text-slate-900"
                      />
                      <button
                        onClick={() => handleAddInlineNote(asset.id, mainEvent.id, 'Main Event Note')}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold shrink-0 flex items-center justify-center gap-1 shadow-2xs"
                      >
                        <Send className="w-3 h-3" /> Add SAP Note
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. ACCORDION TOGGLE STRIP */}
            <div
              onClick={() => toggleExpandDetails(asset.id)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer flex items-center justify-between text-xs font-bold text-slate-700 transition border-t border-slate-200"
            >
              <div className="flex items-center gap-2">
                {isDetailsExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                <span>
                  {isDetailsExpanded ? 'Hide' : 'Show'} Additional Work Orders ({additionalOrders.length}) & Defects ({machineDefects.length})
                </span>
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

            {/* 4. EXPANDABLE DRAWER (ADDITIONAL WORK, DEFECTS & RELEASE) */}
            {isDetailsExpanded && (
              <div className="p-5 border-t border-slate-200 space-y-5 bg-white">
                
                {/* 4A. ADDITIONAL DOWN TIME EVENTS & WORK ORDERS (WO Optional) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Additional Work Orders & Scopes ({additionalOrders.length})
                    </span>
                    <button
                      onClick={() => openAddWorkOrder(asset)}
                      className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Attach Additional Scope
                    </button>
                  </div>

                  {additionalOrders.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                      <p className="text-xs text-slate-400">
                        No secondary work orders attached. Click "+ Attach Additional Scope" to add parallel tasks.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {additionalOrders.map((wo) => {
                        const isDone = wo.status === 'COMPLETED';
                        const isAttachingWo = activeInlineWoTarget === wo.id;

                        return (
                          <div
                            key={wo.id}
                            className={`p-3 rounded-lg border transition ${
                              isDone ? 'opacity-60 bg-slate-50 border-slate-200' : 'bg-white border-slate-300 shadow-2xs'
                            }`}
                          >
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

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleCopySapNotes(wo.id, asset.id, wo.task_description.slice(0, 15))}
                                  className={`flex items-center gap-1 px-2.5 py-1 border rounded text-xs font-bold transition ${
                                    copiedId === wo.id ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                                  }`}
                                >
                                  {copiedId === wo.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  {copiedId === wo.id ? 'Notes Copied!' : 'Copy SAP Notes'}
                                </button>

                                <button
                                  onClick={() => toggleExpandItemNotes(wo.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-bold text-slate-600"
                                >
                                  <MessageSquare className="w-3 h-3 text-slate-500" />
                                  Notes
                                </button>

                                {!isDone && (
                                  <>
                                    <select
                                      value={wo.stage || 'DIAGNOSING'}
                                      onChange={(e) => updateWorkOrderStage(wo.id, asset.id, e.target.value)}
                                      className="bg-white border border-slate-300 text-slate-700 font-bold text-xs p-1 rounded"
                                    >
                                      {STAGES.map((s) => (
                                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
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

                            {/* Inline Form to Attach WO # */}
                            {isAttachingWo && (
                              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="SAP WO # (e.g. 40082915)"
                                  value={inlineWoInputs[wo.id] || ''}
                                  onChange={(e) => setInlineWoInputs({ ...inlineWoInputs, [wo.id]: e.target.value })}
                                  className="bg-slate-50 border border-slate-300 rounded p-1 text-xs font-mono font-bold w-48"
                                />
                                <button
                                  onClick={() => handleSaveInlineWo('WORK_ORDER', wo.id, asset.id)}
                                  className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded hover:bg-indigo-500"
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

                            {/* Inline Notes for Additional Work Order */}
                            {expandedNotesItemIds.has(wo.id) && (
                              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                                <div className="space-y-1 max-h-28 overflow-y-auto">
                                  {notes
                                    .filter((n) => n.asset_id === asset.id && n.note.includes(wo.task_description.slice(0, 15)))
                                    .map((n) => (
                                      <div key={n.id} className="text-xs bg-slate-50 p-1.5 rounded flex items-start gap-1.5">
                                        <span className="font-mono text-[10px] text-slate-400 shrink-0">{formatDateTime(n.created_at)}</span>
                                        <span className="font-bold text-slate-700 shrink-0">[{n.fitter_name}]:</span>
                                        <span className="text-slate-700">{n.note}</span>
                                      </div>
                                    ))}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="Fitter Name & ID"
                                    value={customFitterInput[wo.id] ?? activeFitter}
                                    onChange={(e) => setCustomFitterInput({ ...customFitterInput, [wo.id]: e.target.value })}
                                    className="sm:w-48 bg-slate-50 border border-slate-300 rounded p-1 text-xs font-bold"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Add progressive note to this work order..."
                                    value={noteInputText[wo.id] || ''}
                                    onChange={(e) => setNoteInputText({ ...noteInputText, [wo.id]: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddInlineNote(asset.id, wo.id, wo.task_description.slice(0, 15));
                                    }}
                                    className="flex-1 bg-slate-50 border border-slate-300 rounded p-1 text-xs"
                                  />
                                  <button
                                    onClick={() => handleAddInlineNote(asset.id, wo.id, wo.task_description.slice(0, 15))}
                                    className="px-2.5 bg-slate-800 text-white rounded text-xs font-bold shrink-0"
                                  >
                                    Add Note
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4B. DEFECTS RIBBON & MANAGER (WO Optional) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Defects Found on Machine ({machineDefects.length})
                    </span>
                    <button
                      onClick={() => openDefects(asset)}
                      className="flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Log New Defect
                    </button>
                  </div>

                  {machineDefects.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                      <p className="text-xs text-slate-400">Zero defects reported during inspections.</p>
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
                              isFixed ? 'opacity-50 bg-slate-50 border-slate-200' : 'bg-rose-50/30 border-rose-200'
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
                                      <FileText className="w-3 h-3 inline mr-1" />
                                      {defect.wo_number} (PM03)
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
                                    <span key={sys} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                                      {sys}
                                    </span>
                                  ))}

                                  <span className="text-[10px] text-slate-400">{formatDateTime(defect.created_at)}</span>
                                </div>

                                <p className={`text-sm text-slate-900 ${isFixed ? 'line-through text-slate-400' : 'font-semibold'}`}>
                                  {defect.description}
                                </p>

                                <p className="text-xs text-slate-500">
                                  Reported by: <strong className="text-slate-700">{defect.reported_by}</strong>
                                  {isFixed && ` • Rectified by ${defect.rectified_by || 'Fitter'}`}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleCopySapNotes(defect.id, asset.id, defect.description.slice(0, 15))}
                                  className={`flex items-center gap-1 px-2.5 py-1 border rounded text-xs font-bold transition ${
                                    copiedId === defect.id ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                                  }`}
                                >
                                  {copiedId === defect.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  {copiedId === defect.id ? 'Notes Copied!' : 'Copy SAP Notes'}
                                </button>

                                <button
                                  onClick={() => toggleExpandItemNotes(defect.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-bold text-slate-600"
                                >
                                  <MessageSquare className="w-3 h-3 text-slate-500" />
                                  Notes
                                </button>

                                {!isFixed && (
                                  <select
                                    value={defect.stage || 'DIAGNOSING'}
                                    onChange={(e) => handleUpdateDefectStage(defect.id, asset.id, e.target.value)}
                                    className="bg-white border border-slate-300 text-slate-700 font-bold text-xs p-1 rounded"
                                  >
                                    {STAGES.map((s) => (
                                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                                    ))}
                                  </select>
                                )}

                                <button
                                  onClick={() => handleToggleDefectFixed(defect, asset.id)}
                                  className={`px-3 py-1 font-bold text-xs rounded transition flex items-center gap-1 ${
                                    isFixed ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {isFixed ? 'Reopen' : 'Mark Fixed'}
                                </button>
                              </div>
                            </div>

                            {/* Inline Form to Attach WO # to Defect */}
                            {isAttachingWo && (
                              <div className="mt-2 pt-2 border-t border-rose-100 flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="SAP WO # (e.g. 40089104)"
                                  value={inlineWoInputs[defect.id] || ''}
                                  onChange={(e) => setInlineWoInputs({ ...inlineWoInputs, [defect.id]: e.target.value })}
                                  className="bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold w-48"
                                />
                                <button
                                  onClick={() => handleSaveInlineWo('DEFECT', defect.id, asset.id)}
                                  className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded hover:bg-indigo-500"
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

                            {/* Inline Notes for Defect */}
                            {expandedNotesItemIds.has(defect.id) && (
                              <div className="mt-2 pt-2 border-t border-rose-100 space-y-1.5">
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {notes
                                    .filter((n) => n.asset_id === asset.id && n.note.includes(defect.description.slice(0, 15)))
                                    .map((n) => (
                                      <div key={n.id} className="text-xs bg-white p-1.5 rounded flex items-start gap-1.5">
                                        <span className="font-mono text-[10px] text-slate-400 shrink-0">{formatDateTime(n.created_at)}</span>
                                        <span className="font-bold text-slate-700 shrink-0">[{n.fitter_name}]:</span>
                                        <span className="text-slate-700">{n.note}</span>
                                      </div>
                                    ))}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="Fitter Name & ID"
                                    value={customFitterInput[defect.id] ?? activeFitter}
                                    onChange={(e) => setCustomFitterInput({ ...customFitterInput, [defect.id]: e.target.value })}
                                    className="sm:w-48 bg-white border border-slate-300 rounded p-1 text-xs font-bold"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Add defect progressive note..."
                                    value={noteInputText[defect.id] || ''}
                                    onChange={(e) => setNoteInputText({ ...noteInputText, [defect.id]: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddInlineNote(asset.id, defect.id, defect.description.slice(0, 15));
                                    }}
                                    className="flex-1 bg-white border border-slate-300 rounded p-1 text-xs"
                                  />
                                  <button
                                    onClick={() => handleAddInlineNote(asset.id, defect.id, defect.description.slice(0, 15))}
                                    className="px-2.5 bg-slate-800 text-white rounded text-xs font-bold shrink-0"
                                  >
                                    Add Note
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4C. RELEASE MACHINE TO PRODUCTION */}
                <div className="p-3.5 bg-slate-100/90 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    {canRelease ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Main event, additional scopes, and all defects cleared. Ready for release.
                      </span>
                    ) : (
                      <span className="text-slate-700 font-medium flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        Held Down: <strong className="text-slate-900">{openOrders.length} task(s)</strong> and{' '}
                        <strong className="text-slate-900">{activeDefects.length} defect(s)</strong> still open.
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
                    <CheckCircle2 className="w-4 h-4" /> Release Machine to Production
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}