'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Asset, MachineWorkOrder, HistoryNote } from '@/types';
import AdditionalWorkOrderItem from './AdditionalWorkOrderItem';

interface AdditionalWorkOrdersSectionProps {
  asset: Asset;
  additionalOrders: MachineWorkOrder[];
  notes: HistoryNote[];
  activeFitter: string;
  expandedNotesItemIds: Set<string>;
  toggleItemNotes: (id: string) => void;
  copiedId: string | null;
  onCopySapNotes: (id: string, label: string, override?: string) => void;
  copyLabel?: string;
  activeInlineWoTarget: string | null;
  setActiveInlineWoTarget: (id: string | null) => void;
  inlineWoInputs: Record<string, string>;
  setInlineWoInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveInlineWo: (id: string) => void;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string, jobLabel?: string) => void;
  openPartsModal?: (wo: MachineWorkOrder) => void;
  openCrewPicker?: (wo: MachineWorkOrder) => void;
  onRefresh: () => void;
}

export default function AdditionalWorkOrdersSection({
  asset,
  additionalOrders,
  notes,
  activeFitter,
  expandedNotesItemIds,
  toggleItemNotes,
  copiedId,
  onCopySapNotes,
  copyLabel = 'Copy SAP Notes',
  activeInlineWoTarget,
  setActiveInlineWoTarget,
  inlineWoInputs,
  setInlineWoInputs,
  onSaveInlineWo,
  updateWorkOrderStage,
  openPartsModal,
  openCrewPicker,
  onRefresh,
}: AdditionalWorkOrdersSectionProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const openOrders = additionalOrders.filter((w) => w.status !== 'COMPLETED');
  const completedOrders = additionalOrders.filter((w) => w.status === 'COMPLETED');

  const renderItem = (wo: MachineWorkOrder) => (
    <AdditionalWorkOrderItem
      key={wo.id}
      asset={asset}
      wo={wo}
      notes={notes}
      activeFitter={activeFitter}
      isNotesExpanded={expandedNotesItemIds.has(wo.id)}
      toggleNotes={() => toggleItemNotes(wo.id)}
      isCopied={copiedId === wo.id}
      onCopySapNotes={(override) => onCopySapNotes(wo.id, wo.task_description.slice(0, 15), override)}
      copyLabel={copyLabel}
      isAttachingWo={activeInlineWoTarget === wo.id}
      onOpenAttachWo={() => setActiveInlineWoTarget(wo.id)}
      onCancelAttachWo={() => setActiveInlineWoTarget(null)}
      inlineWoValue={inlineWoInputs[wo.id] || ''}
      onInlineWoChange={(val) => setInlineWoInputs((prev) => ({ ...prev, [wo.id]: val }))}
      onSaveInlineWo={() => onSaveInlineWo(wo.id)}
      updateWorkOrderStage={updateWorkOrderStage}
      openPartsModal={openPartsModal}
      openCrewPicker={openCrewPicker}
      onRefresh={onRefresh}
    />
  );

  return (
    <div className="p-4 border-t border-slate-200 bg-white space-y-3">
      {openOrders.length > 0 && (
        <>
          <h5 className="text-sm font-black uppercase tracking-wide text-slate-700">
            Other jobs on this machine
            <span className="ml-2 font-bold normal-case tracking-normal text-slate-500">({openOrders.length} open)</span>
          </h5>
          <div className="space-y-3">{openOrders.map(renderItem)}</div>
        </>
      )}

      {completedOrders.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowCompleted((open) => !open)}
            aria-expanded={showCompleted}
            className="min-h-11 w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 hover:bg-slate-50 text-sm font-bold text-slate-600 transition"
          >
            {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showCompleted ? 'Hide completed jobs' : `Show completed jobs (${completedOrders.length})`}
          </button>
          {showCompleted && <div className="space-y-3">{completedOrders.map(renderItem)}</div>}
        </>
      )}
    </div>
  );
}
