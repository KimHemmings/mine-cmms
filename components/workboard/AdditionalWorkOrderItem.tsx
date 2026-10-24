'use client';

import React from 'react';
import { FileText, PlusCircle, Check, Copy, MessageSquare } from 'lucide-react';
import { Asset, STAGE_OPTIONS, MachineWorkOrder, HistoryNote } from '@/types';
import { formatWoDisplay, STAGE_THEMES } from './workboardTheme';
import InlineNotesDrawer from '@/components/InlineNotesDrawer';

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
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
  signOffWorkOrder: (woId: string, assetId: string) => void;
  reopenWorkOrder: (woId: string) => void;
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
  signOffWorkOrder,
  reopenWorkOrder,
  onRefresh,
}: AdditionalWorkOrderItemProps) {
  const isDone = wo.status === 'COMPLETED';
  const orderStageTheme = STAGE_THEMES[wo.stage || 'IN_PROGRESS'] || STAGE_THEMES.IN_PROGRESS;

  function handleStageChange(newStage: string) {
    if (newStage === 'COMPLETED') {
      signOffWorkOrder(wo.id, asset.id);
    } else {
      if (isDone) reopenWorkOrder(wo.id);
      updateWorkOrderStage(wo.id, asset.id, newStage);
    }
  }

  return (
    <div
      className={`p-3 rounded-lg border transition ${
        isDone ? 'opacity-75 bg-slate-100/80 border-slate-200' : 'bg-white border-slate-300 shadow-2xs'
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
                onClick={onOpenAttachWo}
                className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-3 h-3" /> Attach SAP WO
              </button>
            )}

            {wo.component_systems?.map((sys) => (
              <span key={sys} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {sys}
              </span>
            ))}
          </div>

          <p className={`text-sm ${isDone ? 'line-through text-slate-500 font-medium' : 'font-semibold text-slate-900'}`}>
            {wo.task_description}
          </p>
          <p className="text-xs text-slate-500">
            Fitter: <strong className="text-slate-700">{wo.fitter_assigned || 'Unassigned'}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCopySapNotes}
            className={`flex items-center gap-1 px-2.5 py-1 border rounded text-xs font-bold transition cursor-pointer ${
              isCopied ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {isCopied ? 'Copied' : 'SAP Notes'}
          </button>

          <button
            type="button"
            onClick={toggleNotes}
            className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-bold text-slate-600 cursor-pointer"
          >
            <MessageSquare className="w-3 h-3 text-slate-500" /> Notes
          </button>

          <select
            value={isDone ? 'COMPLETED' : (wo.stage || 'IN_PROGRESS')}
            onChange={(e) => handleStageChange(e.target.value)}
            className={`border font-bold text-xs p-1 rounded focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer ${
              isDone ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : orderStageTheme.select
            }`}
          >
            {STAGE_OPTIONS.filter((o) => o.value !== 'COMPLETED').map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {isAttachingWo && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            placeholder="SAP WO #"
            value={inlineWoValue}
            onChange={(e) => onInlineWoChange(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded p-1 text-xs font-mono font-bold w-44"
          />
          <button
            type="button"
            onClick={onSaveInlineWo}
            className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded hover:bg-indigo-500 transition cursor-pointer"
          >
            Save WO
          </button>
          <button
            type="button"
            onClick={onCancelAttachWo}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

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