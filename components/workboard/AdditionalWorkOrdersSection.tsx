'use client';

import React from 'react';
import { Plus, FileText, PlusCircle, Check, Copy, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Asset, STAGE_OPTIONS, MachineWorkOrder, HistoryNote } from '@/types';
import { formatWoDisplay, STAGE_THEMES } from './workboardTheme';
import InlineNotesDrawer from '@/components/InlineNotesDrawer';

interface AdditionalWorkOrdersSectionProps {
  asset: Asset;
  additionalOrders: MachineWorkOrder[];
  notes: HistoryNote[];
  activeFitter: string;
  isDetailsExpanded: boolean;
  toggleExpandDetails: () => void;
  expandedNotesItemIds: Set<string>;
  toggleItemNotes: (id: string) => void;
  copiedId: string | null;
  onCopySapNotes: (id: string, label: string) => void;
  activeInlineWoTarget: string | null;
  setActiveInlineWoTarget: (id: string | null) => void;
  inlineWoInputs: Record<string, string>;
  setInlineWoInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveInlineWo: (id: string) => void;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
  signOffWorkOrder: (woId: string, assetId: string) => void;
  openAddWorkOrder: (asset: Asset) => void;
  onRefresh: () => void;
}

export default function AdditionalWorkOrdersSection({
  asset,
  additionalOrders,
  notes,
  activeFitter,
  isDetailsExpanded,
  toggleExpandDetails,
  expandedNotesItemIds,
  toggleItemNotes,
  copiedId,
  onCopySapNotes,
  activeInlineWoTarget,
  setActiveInlineWoTarget,
  inlineWoInputs,
  setInlineWoInputs,
  onSaveInlineWo,
  updateWorkOrderStage,
  signOffWorkOrder,
  openAddWorkOrder,
  onRefresh,
}: AdditionalWorkOrdersSectionProps) {
  const activeCount = additionalOrders.filter((w) => w.status === 'OPEN').length;
  const totalCount = additionalOrders.length;

  return (
    <>
      {/* Accordion Toggle Bar */}
      <div
        onClick={toggleExpandDetails}
        className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer flex items-center justify-between text-xs font-bold text-slate-700 transition border-t border-slate-200"
      >
        <div className="flex items-center gap-2">
          {isDetailsExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
          <span>
            {isDetailsExpanded ? 'Hide' : 'Show'} Additional Work Orders ({activeCount} Active / {totalCount} Total)
          </span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded border border-amber-300 text-[10px]">
              {activeCount} Incomplete
            </span>
          )}
        </div>
        <span className="text-[11px] font-semibold text-slate-500 underline">
          {isDetailsExpanded ? 'Collapse Drawer' : 'Expand Drawer'}
        </span>
      </div>

      {/* Expanded Work Orders List */}
      {isDetailsExpanded && (
        <div className="p-5 border-t border-slate-200 space-y-4 bg-white">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Additional Work Orders ({totalCount})
            </span>
            <button
              type="button"
              onClick={() => openAddWorkOrder(asset)}
              className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Work Order
            </button>
          </div>

          {totalCount === 0 ? (
            <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
              <p className="text-xs text-slate-400">No secondary work orders attached.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {additionalOrders.map((wo) => {
                const isDone = wo.status === 'COMPLETED';
                const isAttachingWo = activeInlineWoTarget === wo.id;
                const orderStageTheme = STAGE_THEMES[wo.stage || 'IN_PROGRESS'] || STAGE_THEMES.IN_PROGRESS;

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
                              {formatWoDisplay(wo.wo_number)}
                            </span>
                          ) : (
                            <button
                              type="button"
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

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${orderStageTheme.badge}`}>
                            {isDone ? 'COMPLETE' : orderStageTheme.label}
                          </span>
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
                          type="button"
                          onClick={() => onCopySapNotes(wo.id, wo.task_description.slice(0, 15))}
                          className={`flex items-center gap-1 px-2.5 py-1 border rounded text-xs font-bold transition ${
                            copiedId === wo.id ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {copiedId === wo.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === wo.id ? 'Copied' : 'SAP Notes'}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleItemNotes(wo.id)}
                          className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-bold text-slate-600"
                        >
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
                              className={`border font-bold text-xs p-1 rounded focus:outline-none focus:ring-2 focus:ring-slate-400 ${orderStageTheme.select}`}
                            >
                              {STAGE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
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
                          onChange={(e) => setInlineWoInputs({ ...inlineWoInputs, [wo.id]: e.target.value })}
                          className="bg-slate-50 border border-slate-300 rounded p-1 text-xs font-mono font-bold w-44"
                        />
                        <button
                          type="button"
                          onClick={() => onSaveInlineWo(wo.id)}
                          className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded hover:bg-indigo-500 transition"
                        >
                          Save WO
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveInlineWoTarget(null)}
                          className="px-2 py-1 text-xs text-slate-400"
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
      )}
    </>
  );
}