import { Asset, MachineWorkOrder } from '@/types';

export interface CrewJob {
  workOrderId: string;
  fleetId: string;
  task: string;
}

export function getOpenJobsByCrew(workOrders: MachineWorkOrder[], assets: Asset[]) {
  const fleetById = new Map(assets.map((a) => [a.id, a.fleet_id]));
  const jobs = new Map<string, CrewJob[]>();

  for (const wo of workOrders) {
    if (wo.status !== 'OPEN') continue;
    for (const { crew_member_id } of wo.crew ?? []) {
      const list = jobs.get(crew_member_id) ?? [];
      list.push({ workOrderId: wo.id, fleetId: fleetById.get(wo.asset_id) ?? '?', task: wo.task_description });
      jobs.set(crew_member_id, list);
    }
  }
  return jobs;
}
