import { Asset, CrewMember, DefectItem, HandoverLogEntry, HandoverManning, HandoverSnapshot, HistoryNote, MachineWorkOrder, STAGE_OPTIONS } from '@/types';
import { normalizeOceBriefing } from '@/utils/oce';
import { visibleOnCrewTab } from '@/utils/shiftRoster';
import { isWorkshopHandoverMember } from '@/utils/workshopHandover';
import { effectivePriority, normalizePriority } from '@/utils/handoverPriority';

interface BuildHandoverInput {
  assets: Asset[];
  handedOver: Asset[];
  released: Asset[];
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  log: HandoverLogEntry[];
  notes?: HistoryNote[];
  shiftId?: string | null;
  shiftStartedAt?: string | null;
  summary: string | null;
  oceSummary?: string | null;
  outgoingCrew?: string | null;
  incomingCrew?: string | null;
  machineNotes?: HandoverSnapshot['machineNotes'];
  machine_summaries?: HandoverSnapshot['machine_summaries'];
  customSlides: HandoverSnapshot['customSlides'];
  crew?: CrewMember[];
  incomingPanel?: string | null;
  manning?: HandoverManning | null;
  safetyIncidents?: HandoverSnapshot['safetyIncidents'];
  safetyFocus?: string | null;
  oce?: HandoverSnapshot['oce'];
  inTraining?: HandoverSnapshot['inTraining'];
  ertOnSite?: string[];
  assessorsOnSite?: string[];
}

const PART_STATUS_LABEL: Record<string, string> = {
  ORDERED: 'Ordered',
  IN_TRANSIT: 'On the way',
  RECEIVED: 'On site',
};

export function stageLabel(stage: string) {
  return STAGE_OPTIONS.find((option) => option.value === stage)?.label ?? stage.replaceAll('_', ' ');
}

export function partStatusLabel(status: string) {
  return PART_STATUS_LABEL[status] ?? status;
}

function openOrders(asset: Asset, workOrders: MachineWorkOrder[]) {
  return workOrders.filter((order) => order.asset_id === asset.id && order.status !== 'COMPLETED');
}

function componentsForAsset(asset: Asset) {
  return [...new Set([...(asset.component_systems ?? []), asset.component_system]
    .filter((component): component is string => Boolean(component?.trim())))];
}

function peopleOnJob(order: MachineWorkOrder, crew: CrewMember[]) {
  const trades = crew.filter((member) => isWorkshopHandoverMember(member));
  const byId = new Map(trades.map((member) => [member.id, member]));
  const linked = (order.crew ?? [])
    .map((row) => byId.get(row.crew_member_id))
    .filter((member): member is CrewMember => Boolean(member));
  if (linked.length > 0) return linked;

  const text = (order.fitter_assigned || '').trim();
  if (!text || text.toLowerCase() === 'unassigned') return [];
  const named = trades.filter((member) => member.active && text.toLowerCase().includes(member.display_name.toLowerCase()));
  if (named.length > 0) return named;
  return [{ id: '', display_name: text, department: 'workshop', access_level: 2, trade: '', panel: null, email: null, away: false, shift_duty: null, allocated_machine_id: null, allocated_role: null, hot_seat_assignments: [], passed_out_equipment: [], in_training_equipment: [], competency_updated_by: null, competency_updated_at: null, is_contractor: false, contractor_company: null, overtime_crew_group: null, shift_expires_at: null, active: true, created_at: '' }];
}

function ordersFor(
  asset: Asset,
  workOrders: MachineWorkOrder[],
  crew: CrewMember[],
  includeCompleted = false,
): HandoverSnapshot['handedOver'][number]['orders'] {
  const lines = workOrders
    .filter((order) => order.asset_id === asset.id && (includeCompleted ? order.status === 'COMPLETED' : order.status !== 'COMPLETED'))
    .map((order) => ({
      woNumber: order.wo_number,
      task: order.task_description,
      components: order.component_systems?.length ? order.component_systems : componentsForAsset(asset),
      priority: order.priority ?? null,
      stage: order.stage,
      fitter: peopleOnJob(order, crew).map((member) => member.display_name).join(', ') || null,
      hotshots: (order.parts ?? [])
        .filter((part) => part.is_special_run)
        .map((part) => ({ description: part.description || part.part_number || 'Hotshot part', eta: part.eta ?? null })),
    }));
  if (lines.length > 0 || includeCompleted || !asset.shift_task) return lines;
  return [{
    woNumber: asset.work_order_num ?? null,
    task: asset.shift_task,
    components: componentsForAsset(asset),
    priority: null,
    stage: asset.shift_stage || 'IN_PROGRESS',
    fitter: asset.fitter_assigned || null,
    hotshots: [],
  }];
}

export function buildHandoverSnapshot({
  assets,
  handedOver,
  released,
  workOrders,
  defects,
  log,
  notes = [],
  shiftId = null,
  shiftStartedAt = null,
  summary,
  oceSummary,
  outgoingCrew = null,
  incomingCrew = null,
  machineNotes = [],
  machine_summaries = {},
  customSlides,
  crew = [],
  incomingPanel = null,
  manning = null,
  safetyIncidents = [],
  safetyFocus = null,
  oce = null,
  inTraining = [],
  ertOnSite = [],
  assessorsOnSite = [],
}: BuildHandoverInput): HandoverSnapshot {
  const fleetOf = new Map(assets.map((asset) => [asset.id, asset.fleet_id]));
  const defectLine = (defect: DefectItem) => ({
    severity: defect.severity,
    fleetId: fleetOf.get(defect.asset_id) ?? null,
    description: defect.description,
  });
  const shiftNotesFor = (asset: Asset) =>
    notes
      .filter((note) => note.asset_id === asset.id && (!shiftStartedAt || note.created_at >= shiftStartedAt))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((note) => ({ at: note.created_at, by: note.fitter_name, note: note.note }));

  const parts = handedOver.flatMap((asset) =>
    openOrders(asset, workOrders).flatMap((order) =>
      (order.parts ?? []).map((part) => ({
        fleetId: asset.fleet_id,
        woNumber: order.wo_number,
        description: part.description || part.part_number || 'Part',
        partNumber: part.part_number ?? null,
        po: part.po_or_reservation ?? null,
        status: part.status,
        eta: part.eta ?? null,
        hotshot: part.is_special_run,
        carrier: part.carrier_details ?? null,
      }))
    )
  );
  parts.sort((a, b) => Number(b.hotshot) - Number(a.hotshot) || a.fleetId.localeCompare(b.fleetId));

  const trades = crew.filter((member) => member.active && !member.away && isWorkshopHandoverMember(member));
  const incoming = incomingPanel
    ? trades.filter((member) => visibleOnCrewTab(member, incomingPanel))
    : [];
  const people = incoming.map((member) => ({ name: member.display_name, trade: member.trade, jobs: [] as HandoverSnapshot['allocation']['people'][number]['jobs'] }));
  const withOutgoing: HandoverSnapshot['allocation']['withOutgoing'] = [];
  const needsName: HandoverSnapshot['allocation']['needsName'] = [];

  handedOver.forEach((asset) => {
    openOrders(asset, workOrders).forEach((order) => {
      const assigned = peopleOnJob(order, crew);
      const job = {
        fleetId: asset.fleet_id,
        woNumber: order.wo_number,
        task: order.task_description,
        stage: order.stage,
        names: assigned.map((member) => member.display_name),
      };
      const onIncoming = assigned.filter((member) => incoming.some((person) => person.id === member.id && person.id));
      if (onIncoming.length > 0) {
        onIncoming.forEach((member) => {
          people.find((person) => person.name === member.display_name)?.jobs.push(job);
        });
        return;
      }
      if (assigned.length > 0) withOutgoing.push(job);
      else needsName.push(job);
    });
  });

  return {
    summary: summary?.trim() || null,
    shift_summary: summary?.trim() || null,
    oce_summary: oceSummary?.trim() || oce?.briefing.summary?.trim() || null,
    outgoingCrew,
    incomingCrew: incomingCrew ?? incomingPanel,
    machineNotes: machineNotes.filter((note) => note.fleetId.trim() && note.summary.trim()),
    machine_summaries,
    log,
    handedOver: handedOver.map((asset) => ({
      machineId: asset.id,
      fleetId: asset.fleet_id,
      makeModel: asset.make_model,
      location: asset.location || 'Workshop',
      priority: effectivePriority(asset.priority, openOrders(asset, workOrders).map((order) => order.priority)),
      expectedUp: asset.expected_up,
      actualUp: asset.actual_up,
      orders: ordersFor(asset, workOrders, crew),
      shiftNotes: shiftNotesFor(asset),
    })),
    parts,
    allocation: { panel: incomingPanel, people, withOutgoing, needsName },
    manning,
    released: released.map((asset) => ({
      machineId: asset.id,
      fleetId: asset.fleet_id,
      makeModel: asset.make_model,
      location: asset.location || 'Workshop',
      priority: effectivePriority(
        asset.priority,
        workOrders
          .filter((order) => order.asset_id === asset.id
            && (order.shift_id === shiftId || (shiftStartedAt && order.completed_at && order.completed_at >= shiftStartedAt)))
          .map((order) => order.priority),
      ),
      expectedUp: asset.expected_up,
      actualUp: asset.actual_up,
      orders: ordersFor(
        asset,
        workOrders.filter((order) => order.shift_id === shiftId || (shiftStartedAt && order.completed_at && order.completed_at >= shiftStartedAt)),
        crew,
        true,
      ),
      shiftNotes: shiftNotesFor(asset),
    })),
    defectsFixed: defects.filter((defect) => {
      if (defect.status !== 'FIXED_THIS_SHIFT' || !defect.rectified_at || !shiftStartedAt) return false;
      return new Date(defect.rectified_at) >= new Date(shiftStartedAt);
    }).map(defectLine),
    defectsOpen: defects.filter((defect) => defect.status === 'OPEN' || defect.status === 'DEFERRED').map(defectLine),
    safetyIncidents: safetyIncidents.filter((incident) => incident.what.trim() || incident.where.trim() || incident.action.trim()),
    safetyFocus: safetyFocus?.trim() || null,
    oce,
    inTraining,
    ertOnSite,
    assessorsOnSite,
    customSlides: customSlides.filter((slide) => slide.title.trim() || slide.notes.trim()),
  };
}

export function normalizeHandoverDocument(document: Partial<HandoverSnapshot> | null | undefined): HandoverSnapshot {
  const shiftSummary = document?.shift_summary ?? document?.summary ?? null;
  const oceSummary = document?.oce_summary ?? document?.oce?.briefing?.summary ?? null;
  return {
    summary: shiftSummary,
    shift_summary: shiftSummary,
    oce_summary: oceSummary,
    outgoingCrew: document?.outgoingCrew ?? null,
    incomingCrew: document?.incomingCrew ?? document?.allocation?.panel ?? null,
    machineNotes: document?.machineNotes ?? [],
    machine_summaries: document?.machine_summaries ?? {},
    log: document?.log ?? [],
    handedOver: (document?.handedOver ?? []).map((machine) => ({
      ...machine,
      machineId: machine.machineId ?? machine.fleetId,
      priority: effectivePriority(machine.priority, (machine.orders ?? []).map((order) => order.priority)),
      orders: (machine.orders ?? []).map((order) => ({
        ...order,
        priority: normalizePriority(order.priority),
        components: order.components ?? [],
      })),
      shiftNotes: machine.shiftNotes ?? [],
    })),
    parts: document?.parts ?? [],
    allocation: document?.allocation ?? { panel: null, people: [], withOutgoing: [], needsName: [] },
    manning: document?.manning ?? null,
    released: (document?.released ?? []).map((machine) => ({
      ...machine,
      machineId: machine.machineId ?? machine.fleetId,
      location: machine.location ?? 'Workshop',
      priority: effectivePriority(machine.priority, (machine.orders ?? []).map((order) => order.priority)),
      expectedUp: machine.expectedUp ?? null,
      orders: (machine.orders ?? []).map((order) => ({
        ...order,
        priority: normalizePriority(order.priority),
        components: order.components ?? [],
      })),
      shiftNotes: machine.shiftNotes ?? [],
    })),
    defectsFixed: document?.defectsFixed ?? [],
    defectsOpen: document?.defectsOpen ?? [],
    safetyIncidents: document?.safetyIncidents ?? [],
    safetyFocus: document?.safetyFocus ?? null,
    oce: document?.oce
      ? {
          fileName: document.oce.fileName ?? null,
          storagePath: document.oce.storagePath ?? null,
          fileSize: document.oce.fileSize ?? null,
          sourceText: document.oce.sourceText ?? null,
          dataUrl: document.oce.dataUrl ?? null,
          briefing: normalizeOceBriefing(document.oce.briefing),
        }
      : null,
    inTraining: document?.inTraining ?? [],
    ertOnSite: document?.ertOnSite ?? [],
    assessorsOnSite: document?.assessorsOnSite ?? [],
    customSlides: document?.customSlides ?? [],
  };
}
