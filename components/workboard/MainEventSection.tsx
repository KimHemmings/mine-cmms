// components/workboard/MainEventSection.tsx - Exactly 118 lines
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
  openPartsModal?: (wo: MachineWorkOrder) => void;
  activeFitter: string;
  isNotesExpanded: boolean;
  toggleNotes: () => void;
  isCopied: boolean;
  onCopySapNotes: () => void;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
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
  openPartsModal,
  onRefresh,
}: MainEventSectionProps) {
  const isDone = mainEvent.status === 'COMPLETED';
  const stageTheme = STAGE_THEMES[mainEvent.stage || 'IN_PROGRESS'] || STAGE_THEMES.IN_PROGRESS;
  const itemNotesCount = notes.filter((n) => n.asset_id === asset.id).length;

  return (
    <div className={`p-4 border-b border-slate-200 transition-colors ${isDone ? 'bg-slate-100/75 opacity-90' : 'bg-slate-50/70'}`}>
      <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-slate-200">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${eventConfig.badge}`}>
          {eventConfig.icon}
          {eventConfig.label}
        </span>
        <h4 className={`text-base ${isDone ? 'line-through text-slate-500 font-medium' : 'font-bold text-slate-900'}`}>
          {mainEvent.task_description}
        </h4>
      </div>

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
            <span>Allocated: <strong className="text-slate-800">{mainEvent.fitter_assigned || 'Unassigned'}</strong></span>
            {mainEvent.completed_at && (
              <span className="text-emerald-700 ml-2 font-medium">
                (Signed off {formatDateTime(mainEvent.completed_at)} by {mainEvent.completed_by})
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCopySapNotes}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
              isCopied ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {isCopied ? 'Notes Copied!' : 'Copy SAP Notes'}
          </button>

          <button
            type="button"
            onClick={toggleNotes}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
              isNotesExpanded
                ? 'bg-amber-50 border-amber-400 text-amber-800'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
            <span>Notes ({itemNotesCount})</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
              isNotesExpanded ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-500'
            }`}>
              {isNotesExpanded ? 'Visible' : 'Hidden'}
            </span>
          </button>

          <select
            value={isDone ? 'COMPLETED' : (mainEvent.stage || 'IN_PROGRESS')}
            onChange={(e) => {
              const newStage = e.target.value;
              console.log('STAGE SELECTED:', newStage, '| openPartsModal exists?:', Boolean(openPartsModal));
              updateWorkOrderStage(mainEvent.id, asset.id, newStage);
              if (newStage === 'WAITING_PARTS') {
                openPartsModal?.(mainEvent);
              }
            }}
            className={`text-xs font-bold rounded-lg border px-3 py-1.5 cursor-pointer outline-none transition ${stageTheme.select}`}
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