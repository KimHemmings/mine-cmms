'use client';

import React from 'react';
import { User, FileText, Copy, Check, MessageSquare } from 'lucide-react';
import { Asset, STAGE_OPTIONS, MachineWorkOrder, HistoryNote } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { formatWoDisplay, STAGE_THEMES } from './workboardTheme';
import InlineNotesDrawer from '@/components/InlineNotesDrawer';

interface MainEventSectionProps {
  asset: Asset;
  mainEvent: MachineWorkOrder;
  eventConfig: { badge: string; label: string; icon: React.ReactNode };
  notes: HistoryNote[];
  activeFitter: string;
  isNotesExpanded: boolean;
  toggleNotes: () => void;
  isCopied: boolean;
  onCopySapNotes: () => void;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
  signOffWorkOrder: (woId: string, assetId: string) => void;
  onRefresh: () => void;
}

export default function MainEventSection({
  asset,
  mainEvent,
  eventConfig,
  notes,
  activeFitter,
  isNotesExpanded,
  toggleNotes,
  isCopied,
  onCopySapNotes,
  updateWorkOrderStage,
  signOffWorkOrder,
  onRefresh,
}: MainEventSectionProps) {
  const stageTheme = STAGE_THEMES[mainEvent.stage || 'IN_PROGRESS'] || STAGE_THEMES.IN_PROGRESS;

  return (
    <div className="p-4 bg-slate-50/70 border-b border-slate-200">
      {/* 1. Event Header: Badge + Actual Task Title + Color-coded Stage Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${eventConfig.badge}`}>
            {eventConfig.icon}
            {eventConfig.label}
          </span>
          <h4 className={`text-base text-slate-900 ${mainEvent.status === 'COMPLETED' ? 'line-through text-slate-500 font-medium' : 'font-bold'}`}>
            {mainEvent.task_description}
          </h4>
        </div>

        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded border uppercase tracking-wider ${stageTheme.badge}`}>
          {mainEvent.status === 'COMPLETED' ? 'COMPLETE' : stageTheme.label}
        </span>
      </div>

      {/* 2. Work Order Details, Systems & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border bg-sky-50 text-sky-800 border-sky-300">
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              {formatWoDisplay(mainEvent.wo_number)}
            </span>
            {mainEvent.notification_num && (
  <span className="text-xs font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
    Notif #{mainEvent.notification_num.replace(/^(notif\s*#?|#\s*)+/gi, '')}
  </span>
)}
            {mainEvent.component_systems?.map((sys) => (
              <span key={sys} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                {sys}
              </span>
            ))}
          </div>

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
            type="button"
            onClick={onCopySapNotes}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition shadow-2xs ${
              isCopied ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {isCopied ? 'Notes Copied!' : 'Copy SAP Notes'}
          </button>

          <button
            type="button"
            onClick={toggleNotes}
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
                className={`border font-bold text-xs p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 transition ${stageTheme.select}`}
              >
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => signOffWorkOrder(mainEvent.id, asset.id)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center gap-1"
              >
                <Check className="w-4 h-4 text-emerald-400" /> Sign Off Event
              </button>
            </>
          )}
        </div>
      </div>

      {isNotesExpanded && (
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
  );
}