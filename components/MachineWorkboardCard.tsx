'use client';

import React, { useState } from 'react';
import { Asset, MachineWorkOrder, HistoryNote, DefectItem } from '@/types';
import { generateSapNotesText, copyToClipboard } from '@/utils/sapFormatter';
import { createClient } from '@/utils/supabase/client';
import { getEventConfig, getPriorityConfig } from './workboard/workboardTheme';
import MachineCardHeader from './workboard/MachineCardHeader';
import MainEventSection from './workboard/MainEventSection';
import AdditionalWorkOrdersSection from './workboard/AdditionalWorkOrdersSection';
import MachineReleaseFooter from './workboard/MachineReleaseFooter';

interface MachineWorkboardCardProps {
  asset: Asset;
  workOrders: MachineWorkOrder[];
  defects?: DefectItem[];
  notes: HistoryNote[];
  activeFitter: string;
  isDetailsExpanded: boolean;
  toggleExpandDetails: () => void;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
  signOffWorkOrder: (woId: string, assetId: string) => void;
  openAddWorkOrder: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
  openQuickEdit: (asset: Asset) => void;
  releaseMachineToProduction: (assetId: string) => void;
  onRefresh: () => void;
}

export default function MachineWorkboardCard({
  asset,
  workOrders,
  notes,
  activeFitter,
  isDetailsExpanded,
  toggleExpandDetails,
  updateWorkOrderStage,
  signOffWorkOrder,
  openAddWorkOrder,
  openHistory,
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
  const isReleased = asset.status === 'OPERATIONAL';
  const machineOrders = workOrders.filter((w) => w.asset_id === asset.id);
  const mainEvent = machineOrders.find((w) => w.is_main_event) || machineOrders[0];
  const additionalOrders = machineOrders.filter((w) => w.id !== mainEvent?.id);
  const openOrders = machineOrders.filter((w) => w.status === 'OPEN');
  const canRelease = !isReleased && machineOrders.length > 0 && openOrders.length === 0;

  const eventConfig = getEventConfig(mainEvent?.order_type, isPlanned);
  const priorityConfig = getPriorityConfig(asset.priority);

  async function handleReopenWorkOrder(woId: string) {
    const { error } = await supabase
      .from('machine_work_orders')
      .update({ status: 'OPEN', stage: 'IN_PROGRESS', completed_at: null, completed_by: null })
      .eq('id', woId);

    if (error) return alert('Error reopening job: ' + error.message);

    if (isReleased) {
      await supabase
        .from('assets')
        .update({
          status: isPlanned ? 'DOWN_PLANNED' : 'DOWN_UNPLANNED',
          in_shift: true,
          actual_up: null,
          priority: asset.priority || 'P3',
        })
        .eq('id', asset.id);
    }

    await supabase.from('asset_history_notes').insert([{
      asset_id: asset.id,
      fitter_name: activeFitter || 'Shift Fitter',
      note: 'Reopened job to IN_PROGRESS. Machine returned to active workboard.',
      stage: 'IN_PROGRESS',
    }]);

    onRefresh();
  }

  function toggleItemNotes(id: string) {
    setExpandedNotesItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCopySapNotes(itemId: string, keyword?: string) {
    const text = generateSapNotesText(notes.filter((n) => n.asset_id === asset.id), keyword);
    if (await copyToClipboard(text)) {
      setCopiedId(itemId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  async function handleSaveInlineWo(id: string) {
    const woNum = (inlineWoInputs[id] || '').trim();
    if (!woNum) return;
    await supabase.from('machine_work_orders').update({ wo_number: woNum }).eq('id', id);
    await supabase.from('asset_history_notes').insert([{
      asset_id: asset.id, fitter_name: activeFitter || 'Planner',
      note: `Assigned SAP Work Order #${woNum} to item.`, stage: 'IN_PROGRESS',
    }]);
    setActiveInlineWoTarget(null);
    setInlineWoInputs((prev) => ({ ...prev, [id]: '' }));
    onRefresh();
  }

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isReleased
          ? 'bg-slate-100/90 border-slate-300 border-l-8 border-l-slate-400 opacity-75 shadow-xs'
          : `bg-white border-slate-300 border-l-8 ${eventConfig.border} shadow-sm`
      }`}
    >
      <MachineCardHeader
        asset={asset}
        eventConfig={eventConfig}
        priorityBadge={isReleased ? 'bg-slate-200 text-slate-700 border-slate-300' : priorityConfig.badge}
        priorityLabel={isReleased ? 'RELEASED' : priorityConfig.label}
        openQuickEdit={openQuickEdit}
        openHistory={openHistory}
      />
      {mainEvent && (
        <MainEventSection
          asset={asset}
          mainEvent={mainEvent}
          eventConfig={eventConfig}
          notes={notes}
          activeFitter={activeFitter}
          isNotesExpanded={expandedNotesItemIds.has(mainEvent.id)}
          toggleNotes={() => toggleItemNotes(mainEvent.id)}
          isCopied={copiedId === mainEvent.id}
          onCopySapNotes={() => handleCopySapNotes(mainEvent.id, 'Main Event')}
          updateWorkOrderStage={updateWorkOrderStage}
          signOffWorkOrder={signOffWorkOrder}
          reopenWorkOrder={handleReopenWorkOrder}
          onRefresh={onRefresh}
        />
      )}
      <AdditionalWorkOrdersSection
        asset={asset}
        additionalOrders={additionalOrders}
        notes={notes}
        activeFitter={activeFitter}
        isDetailsExpanded={isDetailsExpanded}
        toggleExpandDetails={toggleExpandDetails}
        expandedNotesItemIds={expandedNotesItemIds}
        toggleItemNotes={toggleItemNotes}
        copiedId={copiedId}
        onCopySapNotes={handleCopySapNotes}
        activeInlineWoTarget={activeInlineWoTarget}
        setActiveInlineWoTarget={setActiveInlineWoTarget}
        inlineWoInputs={inlineWoInputs}
        setInlineWoInputs={setInlineWoInputs}
        onSaveInlineWo={handleSaveInlineWo}
        updateWorkOrderStage={updateWorkOrderStage}
        signOffWorkOrder={signOffWorkOrder}
        reopenWorkOrder={handleReopenWorkOrder}
        openAddWorkOrder={openAddWorkOrder}
        onRefresh={onRefresh}
      />
      <MachineReleaseFooter
        assetId={asset.id}
        openOrdersCount={openOrders.length}
        canRelease={canRelease}
        onRelease={releaseMachineToProduction}
      />
    </div>
  );
}