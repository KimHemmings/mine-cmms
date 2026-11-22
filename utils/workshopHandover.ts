import { Asset, CrewMember, MachineWorkOrder } from '@/types';
import { allocationSummary } from '@/utils/crewAllocation';
import { coveringLetter, rosterRoleNote, visibleOnCrewTab } from '@/utils/shiftRoster';

const EXCLUDED_TRADES = new Set(['operator', 'oce']);

/** Workshop handover lists. Blank, production, and training departments stay out. */
export function isWorkshopHandoverMember(member: { department?: string | null; trade?: string | null }) {
  if ((member.department ?? '').trim().toLowerCase() !== 'workshop') return false;
  return !EXCLUDED_TRADES.has((member.trade ?? '').trim().toLowerCase());
}

export interface HandoverPerson {
  id: string;
  name: string;
  detail: string;
}

export interface WorkshopHandoverManning {
  panel: string | null;
  onShift: HandoverPerson[];
  away: HandoverPerson[];
  overtime: HandoverPerson[];
  unallocated: HandoverPerson[];
  assigned: HandoverPerson[];
}

function person(member: CrewMember, detail = ''): HandoverPerson {
  const note = rosterRoleNote(member);
  return {
    id: member.id,
    name: note ? `${member.display_name} (${note})` : member.display_name,
    detail,
  };
}

export function workshopHandoverManning(
  crew: CrewMember[],
  panel: string | null,
  workOrders: MachineWorkOrder[],
  assets: Asset[],
): WorkshopHandoverManning {
  const workshop = crew.filter((member) => member.active && isWorkshopHandoverMember(member));
  const onPanel = panel ? workshop.filter((member) => visibleOnCrewTab(member, panel)) : [];
  const away = onPanel.filter((member) => member.away);
  const present = onPanel.filter((member) => !member.away);
  const overtime = present.filter((member) => member.is_contractor || coveringLetter(member));
  const onShift = present.filter((member) => !member.is_contractor && !coveringLetter(member));
  const placed = present.map((member) => ({ member, detail: allocationSummary(member, workOrders, assets) }));
  return {
    panel,
    onShift: onShift.map((member) => person(member)),
    away: away.map((member) => person(member)),
    overtime: overtime.map((member) => person(member)),
    unallocated: placed.filter((row) => row.detail === 'Unassigned').map((row) => person(row.member, 'Unassigned')),
    assigned: placed.filter((row) => row.detail !== 'Unassigned').map((row) => person(row.member, row.detail)),
  };
}

export function workshopSigners(crew: CrewMember[]) {
  return crew
    .filter((member) => member.active && isWorkshopHandoverMember(member))
    .sort((a, b) => a.display_name.localeCompare(b.display_name) || (a.panel ?? '').localeCompare(b.panel ?? ''))
    .map((member) => ({
      id: member.id,
      name: [member.display_name, member.trade, member.panel].filter(Boolean).join(' · '),
    }));
}
