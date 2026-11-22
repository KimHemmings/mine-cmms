'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Asset, MachineWorkOrder, HistoryNote } from '@/types';
import { Permissions } from '@/utils/permissions';
import { generateSapNotesText, copyToClipboard, notesForWorkOrder } from '@/utils/sapFormatter';
import { formatDateTime, getElapsedDown, getEtuStatus } from '@/utils/helpers';
import { createClient } from '@/utils/supabase/client';
import { EventClassBadge, getEventConfig, getPriorityConfig } from './workboard/workboardTheme';
import { HoldPill } from './workboard/JobStatusSelect';
import { holdBadge } from '@/utils/jobHold';
import { jobStatusLabel } from '@/utils/crewAllocation';
import MachineCardHeader from './workboard/MachineCardHeader';
import MainEventSection from './workboard/MainEventSection';
import AdditionalWorkOrdersSection from './workboard/AdditionalWorkOrdersSection';
import MachineReleaseFooter from './workboard/MachineReleaseFooter';
import ServiceAlertPills from '@/components/StatutoryDueBadge';
import RepeatFailurePill, { RepeatFailureDetail } from '@/components/RepeatFailurePill';
import { isOpenPlannedService } from '@/utils/statutoryCompliance';
import { repeatFailures, repeatsForAsset } from '@/utils/repeatFailures';

const PRIORITY_FILLS = {
  P1: {
    badge: 'bg-rose-600 text-white',
    row: 'bg-rose-50 hover:bg-rose-100',
    edge: 'border-l-rose-600',
  },
  P2: {
    badge: 'bg-orange-500 text-white',
    row: 'bg-orange-50 hover:bg-orange-100',
    edge: 'border-l-orange-500',
  },
  P3: {
    badge: 'bg-amber-400 text-slate-900',
    row: 'bg-amber-50/50 hover:bg-amber-100',
    edge: 'border-l-amber-500',
  },
  P4: {
    badge: 'bg-blue-600 text-white',
    row: 'bg-blue-50 hover:bg-blue-100',
    edge: 'border-l-blue-600',
  },
  NONE: {
    badge: 'bg-slate-200 text-slate-700',
    row: 'bg-white hover:bg-slate-100',
    edge: 'border-l-slate-300',
  },
} as const;

function priorityFill(priority?: string | null) {
  if (priority === 'P1' || priority === 'P2' || priority === 'P3' || priority === 'P4') {
    return PRIORITY_FILLS[priority];
  }
  return PRIORITY_FILLS.NONE;
}

/** Open work stays on the card. Signed-off work from another shift stays in History. */
export function workOrdersForActiveCard(orders: MachineWorkOrder[], activeShiftId: string | null) {
  return orders.filter((order) => order.status !== 'COMPLETED' || (!!activeShiftId && order.shift_id === activeShiftId));
}

function pickMainJob(orders: MachineWorkOrder[]) {
  const open = orders.filter((order) => order.status !== 'COMPLETED');
  const pool = open.length > 0 ? open : orders;
  const flagged = pool.filter((order) => order.is_main_event);
  const chosen = flagged.length > 0 ? flagged : pool;
  return [...chosen].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
}

interface MachineWorkboardCardProps {
  asset: Asset;
  workOrders: MachineWorkOrder[];
  notes: HistoryNote[];
  activeFitter: string;
  isDetailsExpanded: boolean;
  toggleExpandDetails: () => void;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string, jobLabel?: string) => void;
  openAddWorkOrder: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
  openDefects: (asset: Asset) => void;
  openQuickEdit: (asset: Asset) => void;
  openPartsModal?: (wo: MachineWorkOrder) => void;
  openCrewPicker?: (wo: MachineWorkOrder) => void;
  releaseMachineToProduction: (assetId: string, fleetId?: string) => void;
  onRefresh: () => void;
  heldOnTablet?: boolean;
  compact?: boolean;
  yours?: boolean;
  copyLabel?: string;
  activeShiftId?: string | null;
  permissions: Permissions;
}

export default function MachineWorkboardCard({
  asset,
  workOrders,
  notes,
  activeFitter,
  isDetailsExpanded,
  toggleExpandDetails,
  updateWorkOrderStage,
  openAddWorkOrder,
  openHistory,
  openDefects,
  openQuickEdit,
  openPartsModal,
  openCrewPicker,
  releaseMachineToProduction,
  onRefresh,
  heldOnTablet = false,
  compact = false,
  yours = false,
  copyLabel = 'Copy Work Order Notes',
  activeShiftId = null,
  permissions,
}: MachineWorkboardCardProps) {
  const [expandedNotesItemIds, setExpandedNotesItemIds] = useState<Set<string>>(new Set());
  const [inlineWoInputs, setInlineWoInputs] = useState<Record<string, string>>({});
  const [activeInlineWoTarget, setActiveInlineWoTarget] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const supabase = createClient();
  const isPlanned = asset.status === 'DOWN_PLANNED';
  const isReleased = asset.status === 'OPERATIONAL' && !asset.in_shift;
  const machineOrders = workOrdersForActiveCard(
    workOrders.filter((w) => w.asset_id === asset.id),
    activeShiftId
  );
  const mainEvent = pickMainJob(machineOrders);
  const additionalOrders = machineOrders.filter((w) => w.id !== mainEvent?.id);
  const openOrders = machineOrders.filter((w) => w.status !== 'COMPLETED');
  const canRelease = !isReleased && openOrders.length === 0;

  const eventConfig = getEventConfig(mainEvent?.order_type, isPlanned);
  const priorityConfig = getPriorityConfig(asset.priority);
  const fill = priorityFill(asset.priority);
  const etu = isReleased ? null : getEtuStatus(asset.expected_up, now);
  const showOverdue = Boolean(etu?.overdue && openOrders.length > 0);
  const holdLabel = openOrders.map((order) => holdBadge(order.stage, order.hold_eta)).find((label) => label) ?? null;
  const jobCount = openOrders.length;
  const solidBadge = isReleased ? 'bg-slate-200 text-slate-700' : fill.badge;
  const productionView = permissions.isReadOnlyWorkshop;
  const suppressSmu = openOrders.some((order) => isOpenPlannedService(order));
  const repeats = repeatsForAsset(repeatFailures(workOrders, [asset]), asset.id);

  const summaryRow = compact ? (
    <button
      type="button"
      onClick={toggleExpandDetails}
      aria-expanded={isDetailsExpanded}
      className={`w-full min-h-12 px-3 py-2 flex items-center gap-3 overflow-x-auto text-left ${
        isReleased ? 'bg-slate-100 hover:bg-slate-200' : fill.row
      }`}
    >
      <span className="shrink-0 inline-flex items-center gap-1.5">
        <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded ${solidBadge}`}>
          {isReleased ? 'RELEASED' : priorityConfig.label}
        </span>
        {mainEvent && <EventClassBadge config={eventConfig} />}
        {yours && !productionView && (
          <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-white">Your job</span>
        )}
      </span>
      <span className="shrink-0 text-sm text-slate-800">
        <strong className="text-base font-black text-slate-900">{asset.fleet_id}</strong>
        <span className="text-slate-400"> • </span>
        <span className="font-bold text-slate-600">{asset.make_model}</span>
      </span>
      <span className="shrink-0 text-xs font-bold text-slate-500">
        {productionView
          ? (asset.location || 'No pit location')
          : `${asset.machine_owner || 'Central'} • ${asset.location || 'No location set'}`}
      </span>
      {!isReleased && (
        <span className="shrink-0 text-xs text-slate-600">
          Down for <strong className="font-mono text-rose-700">{getElapsedDown(asset.down_since)}</strong>
          <span className="text-slate-400"> • </span>
          Expected back up <strong className="font-mono text-slate-900">{formatDateTime(asset.expected_up)}</strong>
        </span>
      )}
      {holdLabel && <HoldPill label={holdLabel} />}
      {showOverdue && etu && (
        <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-black uppercase bg-red-600 text-white">{etu.label}</span>
      )}
      {etu && !etu.overdue && (
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-black uppercase bg-emerald-100 text-emerald-800">{etu.label}</span>
      )}
      <span className="shrink-0 ml-auto inline-flex items-center gap-2">
        <ServiceAlertPills asset={asset} suppressSmu={suppressSmu} />
        {repeats.map((failure) => <RepeatFailurePill key={failure.component} failure={failure} />)}
        {!productionView && (canRelease ? (
          <span className="px-2 py-0.5 rounded bg-emerald-600 text-[11px] font-black uppercase text-white">Ready to release</span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-slate-200 text-xs font-black text-slate-800">{jobCount} {jobCount === 1 ? 'Job' : 'Jobs'}</span>
        ))}
      </span>
      {isDetailsExpanded ? <ChevronUp className="w-4 h-4 shrink-0 text-slate-500" /> : <ChevronDown className="w-4 h-4 shrink-0 text-slate-500" />}
    </button>
  ) : null;

  if (productionView) {
    const downFor = mainEvent?.task_description?.trim() || 'No fault logged.';
    const statusLabel = mainEvent ? jobStatusLabel(mainEvent.stage, mainEvent.hold_eta) : null;
    return (
      <div className={`rounded-xl border bg-white border-slate-300 border-l-8 ${fill.edge} shadow-sm overflow-hidden`}>
        {summaryRow}
        {isDetailsExpanded && <RepeatFailureDetail failures={repeats} />}
        {isDetailsExpanded && (
          <div className="border-t border-slate-200 p-4 space-y-4">
            <section>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">What it is down for</h3>
              <p className="mt-1 text-base font-bold text-slate-900">{downFor}</p>
              {statusLabel && (
                <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-800">{statusLabel}</p>
              )}
            </section>
            <section>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Expected back up</h3>
              <p className="mt-1 text-base font-black text-slate-900">{formatDateTime(asset.expected_up)}</p>
              {showOverdue && (
                <span className="mt-2 inline-flex rounded bg-red-600 px-2 py-0.5 text-[11px] font-black uppercase text-white">OVERDUE</span>
              )}
              {etu && !etu.overdue && (
                <span className="mt-2 ml-2 inline-flex rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-black uppercase text-emerald-800">{etu.label}</span>
              )}
            </section>
          </div>
        )}
      </div>
    );
  }

  const toggleItemNotes = (id: string) => {
    setExpandedNotesItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopySapNotes = async (itemId: string, keyword?: string, override?: string) => {
    const text = override?.trim() || generateSapNotesText(notesForWorkOrder(notes, itemId), keyword);
    if (await copyToClipboard(text)) {
      setCopiedId(itemId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSaveInlineWo = async (id: string) => {
    const woNum = (inlineWoInputs[id] || '').trim();
    if (!woNum) return;
    const { error } = await supabase.from('machine_work_orders').update({ wo_number: woNum }).eq('id', id);
    if (error) return alert(`Error saving work order number: ${error.message}`);
    await supabase.from('asset_history_notes').insert([{
      asset_id: asset.id,
      work_order_id: id,
      fitter_name: activeFitter || 'Planner',
      note: `Assigned work order #${woNum} to item.`,
      stage: 'IN_PROGRESS',
    }]);
    setActiveInlineWoTarget(null);
    setInlineWoInputs((prev) => ({ ...prev, [id]: '' }));
    onRefresh();
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isReleased
          ? 'bg-slate-100/90 border-slate-300 border-l-8 border-l-slate-400 shadow-xs'
          : compact
          ? `bg-white border-slate-300 border-l-8 ${fill.edge} shadow-sm`
          : `bg-white border-slate-300 border-l-8 ${eventConfig.border} shadow-sm`
      }`}
    >
      {heldOnTablet && (
        <p className="px-4 py-2 text-sm font-bold bg-amber-50 text-amber-900 border-b border-amber-200">
          On this tablet. It will send when the signal is back.
        </p>
      )}
      {compact && !isDetailsExpanded && summaryRow}
      {(!compact || isDetailsExpanded) && (
      <>
      <MachineCardHeader
        asset={asset}
        eventConfig={mainEvent ? eventConfig : undefined}
        priorityBadge={isReleased ? 'bg-slate-200 text-slate-700 border-slate-300' : compact ? `${fill.badge} border-transparent` : priorityConfig.badge}
        priorityLabel={isReleased ? 'RELEASED' : priorityConfig.label}
        isReleased={isReleased}
        yours={yours}
        etu={etu}
        showOverdue={showOverdue}
        canEditDetails={permissions.canEditWorkshopJobs}
        suppressSmu={suppressSmu}
        repeats={repeats}
        openQuickEdit={openQuickEdit}
        openHistory={openHistory}
        openDefects={openDefects}
        onCollapse={compact ? toggleExpandDetails : undefined}
      />
      <RepeatFailureDetail failures={repeats} />

      {mainEvent ? (
        <MainEventSection
          asset={asset}
          mainEvent={mainEvent}
          notes={notes}
          activeFitter={activeFitter}
          isNotesExpanded={expandedNotesItemIds.has(mainEvent.id)}
          toggleNotes={() => toggleItemNotes(mainEvent.id)}
          isCopied={copiedId === mainEvent.id}
          onCopySapNotes={(override) => handleCopySapNotes(mainEvent.id, 'Main Event', override)}
          copyLabel={copyLabel}
          updateWorkOrderStage={updateWorkOrderStage}
          openPartsModal={openPartsModal}
          openCrewPicker={openCrewPicker}
          onRefresh={onRefresh}
          canEditJobs={permissions.canEditWorkshopJobs}
          canAddNotes={permissions.canAddNotes}
        />
      ) : (
        <div className="p-4 bg-amber-50/60 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-amber-800">No job logged for this machine yet.</span>
          {permissions.canEditWorkshopJobs && (
          <button
            type="button"
            onClick={() => openAddWorkOrder(asset)}
            className="min-h-11 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold transition"
          >
            + Add Work Order
          </button>
          )}
        </div>
      )}

      {additionalOrders.length > 0 && (
        <AdditionalWorkOrdersSection
          asset={asset}
          additionalOrders={additionalOrders}
          notes={notes}
          activeFitter={activeFitter}
          expandedNotesItemIds={expandedNotesItemIds}
          toggleItemNotes={toggleItemNotes}
          copiedId={copiedId}
          onCopySapNotes={handleCopySapNotes}
          copyLabel={copyLabel}
          activeInlineWoTarget={activeInlineWoTarget}
          setActiveInlineWoTarget={setActiveInlineWoTarget}
          inlineWoInputs={inlineWoInputs}
          setInlineWoInputs={setInlineWoInputs}
          onSaveInlineWo={handleSaveInlineWo}
          updateWorkOrderStage={updateWorkOrderStage}
          openPartsModal={openPartsModal}
          openCrewPicker={openCrewPicker}
          onRefresh={onRefresh}
          canEditJobs={permissions.canEditWorkshopJobs}
          canAddNotes={permissions.canAddNotes}
        />
      )}

      <MachineReleaseFooter
        openOrdersCount={openOrders.length}
        canRelease={canRelease}
        isReleased={isReleased}
        showRelease={permissions.canReleaseMachine}
        onRelease={() => releaseMachineToProduction(asset.id, asset.fleet_id)}
        onAddWorkOrder={permissions.canEditWorkshopJobs && mainEvent && !isReleased ? () => openAddWorkOrder(asset) : undefined}
      />
      </>
      )}
    </div>
  );
}
