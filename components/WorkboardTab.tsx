import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Asset, DefectItem, MachineWorkOrder, HistoryNote } from '@/types';
import MachineWorkboardCard from '@/components/MachineWorkboardCard';

interface WorkboardTabProps {
  shiftJobs: Asset[];
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  notes: HistoryNote[];
  loading: boolean;
  activeFitter: string;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string) => void;
  signOffWorkOrder: (woId: string, assetId: string) => void;
  openAddWorkOrder: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
  openDefects: (asset: Asset) => void;
  openQuickEdit: (asset: Asset) => void;
  releaseMachineToProduction: (assetId: string) => void;
  onRefresh: () => void;
}

export default function WorkboardTab({
  shiftJobs,
  workOrders,
  defects,
  notes,
  loading,
  activeFitter,
  updateWorkOrderStage,
  signOffWorkOrder,
  openAddWorkOrder,
  openHistory,
  openDefects,
  openQuickEdit,
  releaseMachineToProduction,
  onRefresh,
}: WorkboardTabProps) {
  const [expandedDetailsAssetIds, setExpandedDetailsAssetIds] = useState<Set<string>>(new Set());

  function toggleExpandDetails(assetId: string) {
    setExpandedDetailsAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent mb-3" />
        <p className="text-slate-600 text-sm font-semibold">Loading active shift workboard...</p>
      </div>
    );
  }

  const validShiftJobs = shiftJobs.filter((asset) => 
    workOrders.some((wo) => wo.asset_id === asset.id)
  );

  if (validShiftJobs.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-slate-300 rounded-2xl max-w-xl mx-auto mt-8 shadow-md">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Zero Active Work Orders</h2>
        <p className="text-xs text-slate-500 mt-1">All fleet units operational or ready for deployment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between pb-1 text-xs font-bold text-slate-600">
        <span>Active Breakdown Fleet ({validShiftJobs.length} Units Down)</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpandedDetailsAssetIds(new Set(validShiftJobs.map((a) => a.id)))}
            className="hover:text-slate-900 underline"
          >
            Expand All Drawers
          </button>
          <span>•</span>
          <button
            onClick={() => setExpandedDetailsAssetIds(new Set())}
            className="hover:text-slate-900 underline"
          >
            Collapse All Drawers
          </button>
        </div>
      </div>

      {validShiftJobs.map((asset) => (
        <MachineWorkboardCard
          key={asset.id}
          asset={asset}
          workOrders={workOrders}
          defects={defects}
          notes={notes}
          activeFitter={activeFitter}
          isDetailsExpanded={expandedDetailsAssetIds.has(asset.id)}
          toggleExpandDetails={() => toggleExpandDetails(asset.id)}
          updateWorkOrderStage={updateWorkOrderStage}
          signOffWorkOrder={signOffWorkOrder}
          openAddWorkOrder={openAddWorkOrder}
          openHistory={openHistory}
          openDefects={openDefects}
          openQuickEdit={openQuickEdit}
          releaseMachineToProduction={releaseMachineToProduction}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}