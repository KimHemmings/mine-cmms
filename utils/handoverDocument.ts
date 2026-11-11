import { Asset, CrewMember, DefectItem, HandoverLogEntry, HandoverSnapshot, MachineWorkOrder, STAGE_OPTIONS } from '@/types';

interface BuildHandoverInput {
  assets: Asset[];
  handedOver: Asset[];
  released: Asset[];
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  log: HandoverLogEntry[];
  shiftStartedAt?: string | null;
  summary: string | null;
  machineNotes?: HandoverSnapshot['machineNotes'];
  customSlides: HandoverSnapshot['customSlides'];
  crew?: CrewMember[];
  incomingPanel?: string | null;
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

function peopleOnJob(order: MachineWorkOrder, crew: CrewMember[]) {
  const byId = new Map(crew.map((member) => [member.id, member]));
  const linked = (order.crew ?? [])
    .map((row) => byId.get(row.crew_member_id))
    .filter((member): member is CrewMember => Boolean(member));
  if (linked.length > 0) return linked;

  const text = (order.fitter_assigned || '').trim();
  if (!text || text.toLowerCase() === 'unassigned') return [];
  const named = crew.filter((member) => member.active && text.toLowerCase().includes(member.display_name.toLowerCase()));
  if (named.length > 0) return named;
  return [{ id: '', display_name: text, trade: '', panel: null, active: true, created_at: '' }];
}

function ordersFor(asset: Asset, workOrders: MachineWorkOrder[]): HandoverSnapshot['handedOver'][number]['orders'] {
  return openOrders(asset, workOrders).map((order) => ({
    woNumber: order.wo_number,
    task: order.task_description,
    stage: order.stage,
    fitter: order.fitter_assigned,
    hotshots: (order.parts ?? [])
      .filter((part) => part.is_special_run)
      .map((part) => ({ description: part.description || part.part_number || 'Hotshot part', eta: part.eta ?? null })),
  }));
}

export function buildHandoverSnapshot({
  assets,
  handedOver,
  released,
  workOrders,
  defects,
  log,
  shiftStartedAt = null,
  summary,
  machineNotes = [],
  customSlides,
  crew = [],
  incomingPanel = null,
}: BuildHandoverInput): HandoverSnapshot {
  const fleetOf = new Map(assets.map((asset) => [asset.id, asset.fleet_id]));
  const defectLine = (defect: DefectItem) => ({
    severity: defect.severity,
    fleetId: fleetOf.get(defect.asset_id) ?? null,
    description: defect.description,
  });

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

  const incoming = crew.filter((member) => member.active && member.panel === incomingPanel);
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
    machineNotes: machineNotes.filter((note) => note.fleetId.trim() && note.summary.trim()),
    log,
    handedOver: handedOver.map((asset) => ({
      fleetId: asset.fleet_id,
      makeModel: asset.make_model,
      location: asset.location || 'Workshop',
      priority: asset.priority,
      expectedUp: asset.expected_up,
      orders: ordersFor(asset, workOrders),
    })),
    parts,
    allocation: { panel: incomingPanel, people, withOutgoing, needsName },
    released: released.map((asset) => ({ fleetId: asset.fleet_id, makeModel: asset.make_model })),
    defectsFixed: defects.filter((defect) => {
      if (defect.status !== 'FIXED_THIS_SHIFT' || !defect.rectified_at || !shiftStartedAt) return false;
      return new Date(defect.rectified_at) >= new Date(shiftStartedAt);
    }).map(defectLine),
    defectsOpen: defects.filter((defect) => defect.status === 'OPEN' || defect.status === 'DEFERRED').map(defectLine),
    customSlides: customSlides.filter((slide) => slide.title.trim() || slide.notes.trim()),
  };
}

export function normalizeHandoverDocument(document: Partial<HandoverSnapshot> | null | undefined): HandoverSnapshot {
  return {
    summary: document?.summary ?? null,
    machineNotes: document?.machineNotes ?? [],
    log: document?.log ?? [],
    handedOver: document?.handedOver ?? [],
    parts: document?.parts ?? [],
    allocation: document?.allocation ?? { panel: null, people: [], withOutgoing: [], needsName: [] },
    released: document?.released ?? [],
    defectsFixed: document?.defectsFixed ?? [],
    defectsOpen: document?.defectsOpen ?? [],
    customSlides: document?.customSlides ?? [],
  };
}
