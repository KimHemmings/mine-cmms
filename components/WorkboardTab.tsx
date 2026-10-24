// components/WorkboardTab.tsx - Exactly 124 lines
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, CheckCircle } from 'lucide-react';
import { Asset, MachineWorkOrder, HistoryNote } from '@/types';
import MachineWorkboardCard from '@/components/MachineWorkboardCard';

interface WorkboardTabProps {
  shiftJobs: Asset[];
  workOrders: MachineWorkOrder[];
  notes: HistoryNote[];
  loading: boolean;
  activeFitter: string;
  userRole?: 'management' | 'fitter';
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
  signOffWorkOrder?: (woId: string, assetId: string) => void;
  openAddWorkOrder: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
  openQuickEdit: (asset: Asset) => void;
  openPartsModal?: (wo: MachineWorkOrder) => void;
  releaseMachineToProduction: (assetId: string) => void;
  onRefresh: () => void;
}

const STORAGE_KEY = 'mine_cmms_expanded_cards';

export default function WorkboardTab({
  shiftJobs,
  workOrders,
  notes,
  loading,
  activeFitter,
  userRole,
  updateWorkOrderStage,
  signOffWorkOrder,
  openAddWorkOrder,
  openHistory,
  openQuickEdit,
  openPartsModal,
  releaseMachineToProduction,
  onRefresh,
}: WorkboardTabProps) {
  const [expandedAssetIds, setExpandedAssetIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set();
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedAssetIds)));
      } catch {}
    }
  }, [expandedAssetIds]);

  const toggleExpand = (assetId: string) => {
    setExpandedAssetIds((prev) => {
      const next = new Set(prev);
      next.has(assetId) ? next.delete(assetId) : next.add(assetId);
      return next;
    });
  };

  if (loading && shiftJobs.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent mb-3" />
        <p className="text-slate-600 text-sm font-semibold">Loading active shift workboard...</p>
      </div>
    );
  }

  const activeFleet = shiftJobs.filter((a) => a.status !== 'OPERATIONAL');
  const releasedFleet = shiftJobs.filter((a) => a.status === 'OPERATIONAL');

  if (activeFleet.length === 0 && releasedFleet.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-slate-300 rounded-2xl max-w-xl mx-auto mt-8 shadow-md">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Zero Active Work Orders</h2>
        <p className="text-xs text-slate-500 mt-1">All fleet units operational or ready for deployment.</p>
      </div>
    );
  }

  const renderCard = (asset: Asset) => (
    <MachineWorkboardCard
      key={asset.id}
      asset={asset}
      workOrders={workOrders}
      notes={notes}
      activeFitter={activeFitter}
      userRole={userRole}
      isDetailsExpanded={expandedAssetIds.has(asset.id)}
      toggleExpandDetails={() => toggleExpand(asset.id)}
      updateWorkOrderStage={updateWorkOrderStage}
      signOffWorkOrder={signOffWorkOrder}
      openAddWorkOrder={openAddWorkOrder}
      openHistory={openHistory}
      openQuickEdit={openQuickEdit}
      openPartsModal={openPartsModal}
      releaseMachineToProduction={releaseMachineToProduction}
      onRefresh={onRefresh}
    />
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1 text-xs font-bold text-slate-600 border-b border-slate-200">
          <span>Active Workshop Fleet ({activeFleet.length} Units Under Maintenance)</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setExpandedAssetIds(new Set(activeFleet.map((a) => a.id)))} className="hover:text-slate-900 underline">Expand All Drawers</button>
            <span>•</span>
            <button type="button" onClick={() => setExpandedAssetIds(new Set())} className="hover:text-slate-900 underline">Collapse All Drawers</button>
          </div>
        </div>
        {activeFleet.length === 0 ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-bold text-emerald-800">
            All workshop units have been cleared and released for production!
          </div>
        ) : (
          activeFleet.map(renderCard)
        )}
      </div>

      {releasedFleet.length > 0 && (
        <div className="pt-6 space-y-4 border-t-2 border-dashed border-slate-300">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Released To Production This Shift ({releasedFleet.length} Units)</span>
          </div>
          <div className="opacity-75 space-y-4">{releasedFleet.map(renderCard)}</div>
        </div>
      )}
    </div>
  );
}