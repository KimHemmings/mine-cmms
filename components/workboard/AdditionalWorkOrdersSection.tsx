'use client';

import React from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Asset, MachineWorkOrder, HistoryNote } from '@/types';
import AdditionalWorkOrderItem from './AdditionalWorkOrderItem';

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
  openAddWorkOrder,
  onRefresh,
}: AdditionalWorkOrdersSectionProps) {
  const activeCount = additionalOrders.filter((w) => w.status === 'OPEN').length;
  const totalCount = additionalOrders.length;

  const sortedOrders = [...additionalOrders].sort((a, b) => {
    if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
    if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
    return 0;
  });

  return (
    <>
      <div
        onClick={toggleExpandDetails}
        className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer flex items-center justify-between text-xs font-bold text-slate-700 transition border-t border-slate-200 select-none"
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

      {isDetailsExpanded && (
        <div className="p-5 border-t border-slate-200 space-y-4 bg-white">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Additional Work Orders ({totalCount})
            </span>
            <button
              type="button"
              onClick={() => openAddWorkOrder(asset)}
              className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-lg transition cursor-pointer"
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
              {sortedOrders.map((wo) => (
                <AdditionalWorkOrderItem
                  key={wo.id}
                  asset={asset}
                  wo={wo}
                  notes={notes}
                  activeFitter={activeFitter}
                  isNotesExpanded={expandedNotesItemIds.has(wo.id)}
                  toggleNotes={() => toggleItemNotes(wo.id)}
                  isCopied={copiedId === wo.id}
                  onCopySapNotes={() => onCopySapNotes(wo.id, wo.task_description.slice(0, 15))}
                  isAttachingWo={activeInlineWoTarget === wo.id}
                  onOpenAttachWo={() => setActiveInlineWoTarget(wo.id)}
                  onCancelAttachWo={() => setActiveInlineWoTarget(null)}
                  inlineWoValue={inlineWoInputs[wo.id] || ''}
                  onInlineWoChange={(val) => setInlineWoInputs({ ...inlineWoInputs, [wo.id]: val })}
                  onSaveInlineWo={() => onSaveInlineWo(wo.id)}
                  updateWorkOrderStage={updateWorkOrderStage}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}