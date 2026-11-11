'use client';

import React from 'react';
import { User, FileText, Copy, Check, MessageSquare, Package } from 'lucide-react';
import { Asset, MachineWorkOrder, HistoryNote } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { formatWoDisplay } from './workboardTheme';
import InlineNotesDrawer from '@/components/InlineNotesDrawer';
import PartsBadge from './PartsBadge';
import JobStatusSelect from './JobStatusSelect';
import PartsArrivedPrompt from './PartsArrivedPrompt';

interface MainEventSectionProps {
  asset: Asset;
  mainEvent: MachineWorkOrder;
  eventConfig: { badge: string; label: string; icon: React.ReactNode };
  notes: HistoryNote[];
  openPartsModal?: (wo: MachineWorkOrder) => void;
  openCrewPicker?: (wo: MachineWorkOrder) => void;
  activeFitter: string;
  isNotesExpanded: boolean;
  toggleNotes: () => void;
  isCopied: boolean;
  onCopySapNotes: () => void;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string, jobLabel?: string) => void;
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
  openCrewPicker,
  onRefresh,
}: MainEventSectionProps) {
  const isDone = mainEvent.status === 'COMPLETED';
  const jobLabel = `${asset.fleet_id}: ${mainEvent.task_description}`;

  const itemNotesCount = notes.filter(
    (n) => n.asset_id === asset.id && n.note.toLowerCase().includes('main event')
  ).length;

  const handleStageChange = (newStage: string) => {
    updateWorkOrderStage(mainEvent.id, asset.id, newStage, jobLabel);
    if (newStage === 'WAITING_PARTS' && !mainEvent.parts?.length) {
      openPartsModal?.(mainEvent);
    }
  };

  return (
    <div className={`p-4 border-b border-slate-200 transition-colors ${isDone ? 'bg-slate-100/75' : 'bg-slate-50/70'}`}>
      <div className="flex flex-wrap items-center gap-2 pb-2 mb-3 border-b border-slate-200">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Main job</span>
        <span className={`text-xs font-black px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1 ${eventConfig.badge}`}>
          {eventConfig.icon}
          {eventConfig.label}
        </span>
        <h4 className={`text-lg ${isDone ? 'line-through text-slate-500 font-medium' : 'font-bold text-slate-900'}`}>
          {mainEvent.task_description}
        </h4>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-mono font-bold px-2.5 py-1 rounded border bg-sky-50 text-sky-800 border-sky-300">
              <FileText className="w-4 h-4 inline mr-1" />
              {formatWoDisplay(mainEvent.wo_number)}
            </span>
            {mainEvent.notification_num && (
              <span className="text-sm font-mono text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">
                Notification #{mainEvent.notification_num.replace(/^(notif\s*#?|#\s*)+/gi, '')}
              </span>
            )}
            {mainEvent.component_systems?.map((sys) => (
              <span key={sys} className="text-xs font-bold px-2.5 py-1 rounded bg-white text-slate-700 border border-slate-200">
                {sys}
              </span>
            ))}
            <PartsBadge parts={mainEvent.parts} onClick={() => openPartsModal?.(mainEvent)} />
            {mainEvent.stage === 'WAITING_PARTS' && !mainEvent.parts?.length && (
              <button
                type="button"
                onClick={() => openPartsModal?.(mainEvent)}
                className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-bold bg-amber-500 text-slate-950 border border-amber-600 hover:bg-amber-400 transition cursor-pointer"
                title="Waiting on parts, but none logged yet"
              >
                <Package className="w-4 h-4" /> Log the parts needed
              </button>
            )}
          </div>

          <p className="text-sm text-slate-600 flex flex-wrap items-center gap-1.5">
            <User className="w-4 h-4 text-slate-400" />
            <span>Crew: <strong className="text-slate-900">{mainEvent.fitter_assigned || 'Unassigned'}</strong></span>
            {!isDone && openCrewPicker && (
              <button
                type="button"
                onClick={() => openCrewPicker(mainEvent)}
                className="min-h-9 px-3 rounded-lg border border-slate-300 bg-white hover:border-amber-400 hover:bg-amber-50 text-sm font-bold text-slate-700 transition"
              >
                Change
              </button>
            )}
            {mainEvent.completed_at && (
              <span className="text-emerald-700 font-semibold">
                · Signed off {formatDateTime(mainEvent.completed_at)} by {mainEvent.completed_by}
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
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
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
            {isNotesExpanded ? 'Hide notes' : `Notes (${itemNotesCount})`}
          </button>

          <JobStatusSelect stage={mainEvent.stage} isDone={isDone} onChange={handleStageChange} />
        </div>
      </div>

      <PartsArrivedPrompt
        workOrder={mainEvent}
        onResume={() => updateWorkOrderStage(mainEvent.id, asset.id, 'IN_PROGRESS', jobLabel)}
      />

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
