import type { SupabaseClient } from '@supabase/supabase-js';
import { ReportAsset, ReportOrder } from '@/utils/dailyReports';

export async function fetchDailyReportSource(supabase: SupabaseClient): Promise<{ assets: ReportAsset[]; orders: ReportOrder[] }> {
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const [assetsResult, ordersResult] = await Promise.all([
    supabase.from('assets').select('id, fleet_id, asset_type, make_model, location, circuit, status'),
    supabase.from('machine_work_orders')
      .select('id, asset_id, wo_number, order_type, task_description, component_systems, fitter_assigned, stage, status, created_at, completed_at, takes_machine_down')
      .or(`created_at.gte.${since},status.eq.OPEN`),
  ]);
  if (assetsResult.error) throw new Error(assetsResult.error.message);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  const assets = ((assetsResult.data ?? []) as {
    id: string;
    fleet_id: string;
    asset_type: string | null;
    make_model: string | null;
    location: string | null;
    circuit: string | null;
    status: string;
  }[]).map((row) => ({
    id: row.id,
    fleetId: row.fleet_id,
    assetType: row.asset_type ?? '',
    makeModel: row.make_model ?? '',
    location: row.location ?? '',
    circuit: row.circuit,
    status: row.status,
  }));
  const orders = ((ordersResult.data ?? []) as {
    id: string;
    asset_id: string;
    wo_number: string | null;
    order_type: string | null;
    task_description: string | null;
    component_systems: string[] | null;
    fitter_assigned: string | null;
    stage: string | null;
    status: string;
    created_at: string;
    completed_at: string | null;
    takes_machine_down: boolean | null;
  }[]).map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    woNumber: row.wo_number,
    orderType: row.order_type ?? 'UNPLANNED',
    task: row.task_description ?? '',
    systems: row.component_systems ?? [],
    fitter: row.fitter_assigned,
    stage: row.stage ?? 'IN_PROGRESS',
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    takesMachineDown: row.takes_machine_down !== false,
  }));
  return { assets, orders };
}
