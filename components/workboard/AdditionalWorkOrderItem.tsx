'use client';

import React from 'react';
import { FileText, PlusCircle, Check, Copy, MessageSquare, User, Package } from 'lucide-react';
import { Asset, MachineWorkOrder, HistoryNote } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { formatWoDisplay } from './workboardTheme';
import InlineNotesDrawer from '@/components/InlineNotesDrawer';
import PartsBadge from './PartsBadge';
import JobStatusSelect from './JobStatusSelect';
import PartsArrivedPrompt from './PartsArrivedPrompt';

interface AdditionalWorkOrderItemProps {
  asset: Asset;
  wo: MachineWorkOrder;
  notes: HistoryNote[];
  activeFitter: string;
  isNotesExpanded: boolean;
  toggleNotes: () => void;
  isCopied: boolean;
  onCopySapNotes: () => void;
  isAttachingWo: boolean;
  onOpenAttachWo: () => void;
  onCancelAttachWo: () => void;
  inlineWoValue: string;
  onInlineWoChange: (val: string) => void;
  onSaveInlineWo: () => void;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string, jobLabel?: string) => void;
  openPartsModal?: (wo: MachineWorkOrder) => void;
  openCrewPicker?: (wo: MachineWorkOrder) => void;
  onRefresh: () => void;
}

export default function AdditionalWorkOrderItem({
  asset,
  wo,
  notes,
  activeFitter,
  isNotesExpanded,
  toggleNotes,
  isCopied,
  onCopySapNotes,
  isAttachingWo,
  onOpenAttachWo,
  onCancelAttachWo,
  inlineWoValue,
  onInlineWoChange,
  onSaveInlineWo,
  updateWorkOrderStage,
  openPartsModal,
  openCrewPicker,
  onRefresh,
}: AdditionalWorkOrderItemProps) {
  const isDone = wo.status === 'COMPLETED';
  const jobLabel = `${asset.fleet_id}: ${wo.task_description}`;

  const handleStageChange = (newStage: string) => {
    updateWorkOrderStage(wo.id, asset.id, newStage, jobLabel);
    if (newStage === 'WAITING_PARTS' && !wo.parts?.length) {
      openPartsModal?.(wo);
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 transition ${
        isDone ? 'bg-slate-100/80 border-slate-200' : 'bg-white border-slate-300 shadow-2xs'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 flex-1">
          <p className={`text-base ${isDone ? 'line-through text-slate-500 font-medium' : 'font-bold text-slate-900'}`}>
            {wo.task_description}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {wo.wo_number ? (
              <span className="text-sm font-mono font-bold px-2.5 py-1 rounded border bg-sky-50 text-sky-800 border-sky-200">
                <FileText className="w-4 h-4 inline mr-1" />
                {formatWoDisplay(wo.wo_number)}
              </span>
            ) : (
              <button
                type="button"
                onClick={onOpenAttachWo}
                className="min-h-9 text-sm font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3 rounded-lg hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Add SAP WO number
              </button>
            )}

            {wo.component_systems?.map((sys) => (
              <span key={sys} className="text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {sys}
              </span>
            ))}

            <PartsBadge parts={wo.parts} onClick={() => openPartsModal?.(wo)} />
            {!isDone && wo.stage === 'WAITING_PARTS' && !wo.parts?.length && (
              <button
                type="button"
                onClick={() => openPartsModal?.(wo)}
                className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-bold bg-amber-500 text-slate-950 border border-amber-600 hover:bg-amber-400 transition cursor-pointer"
              >
                <Package className="w-4 h-4" /> Log the parts needed
              </button>
            )}
          </div>

          <p className="text-sm text-slate-600 flex flex-wrap items-center gap-1.5">
            <User className="w-4 h-4 text-slate-400" />
            <span>Crew: <strong className="text-slate-900">{wo.fitter_assigned || 'Unassigned'}</strong></span>
            {!isDone && openCrewPicker && (
              <button
                type="button"
                onClick={() => openCrewPicker(wo)}
                className="min-h-9 px-3 rounded-lg border border-slate-300 bg-white hover:border-amber-400 hover:bg-amber-50 text-sm font-bold text-slate-700 transition"
              >
                Change
              </button>
            )}
            {wo.completed_at && (
              <span className="text-emerald-700 font-semibold">
                · Signed off {formatDateTime(wo.completed_at)} by {wo.completed_by}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCopySapNotes}
            className={`min-h-11 flex items-center gap-1.5 px-3.5 border-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              isCopied ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {isCopied ? 'Copied!' : 'Copy SAP Notes'}
          </button>

          <button
            type="button"
            onClick={toggleNotes}
            aria-expanded={isNotesExpanded}
            className={`min-h-11 flex items-center gap-1.5 px-3.5 border-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              isNotesExpanded
                ? 'bg-amber-50 border-amber-400 text-amber-800'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-amber-600" />
            {isNotesExpanded ? 'Hide notes' : 'Notes'}
          </button>

          <JobStatusSelect stage={wo.stage} isDone={isDone} onChange={handleStageChange} />
        </div>
      </div>

      {isAttachingWo && (
        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="SAP WO number"
            value={inlineWoValue}
            onChange={(e) => onInlineWoChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSaveInlineWo()}
            autoFocus
            className="min-h-11 bg-slate-50 border-2 border-slate-300 rounded-lg px-3 text-sm font-mono font-bold w-52"
          />
          <button
            type="button"
            onClick={onSaveInlineWo}
            className="min-h-11 px-4 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-500 transition cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancelAttachWo}
            className="min-h-11 px-3 text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      <PartsArrivedPrompt
        workOrder={wo}
        onResume={() => updateWorkOrderStage(wo.id, asset.id, 'IN_PROGRESS', jobLabel)}
      />

      {isNotesExpanded && (
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
}
