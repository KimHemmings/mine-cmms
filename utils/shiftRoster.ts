import { CrewMember } from '@/types';
import { Department, isWorkshopRoster, normalizeDepartment } from '@/utils/permissions';

export type CrewLetter = 'A' | 'B' | 'C' | 'D';

const LETTERS: CrewLetter[] = ['A', 'B', 'C', 'D'];

export function crewLetter(panel: string | null | undefined): CrewLetter | null {
  const match = (panel ?? '').trim().match(/^([ABCD])\b/i);
  if (!match) return null;
  return match[1].toUpperCase() as CrewLetter;
}

export function panelForLetter(letter: CrewLetter) {
  return `${letter} Crew`;
}

export function shiftStillOn(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  return Number.isFinite(time) && time > now;
}

export function coveringLetter(member: Pick<CrewMember, 'overtime_crew_group' | 'shift_expires_at'>, now = Date.now()): CrewLetter | null {
  const letter = (member.overtime_crew_group ?? '').toUpperCase();
  if (!LETTERS.includes(letter as CrewLetter)) return null;
  if (!shiftStillOn(member.shift_expires_at, now)) return null;
  return letter as CrewLetter;
}

export function visibleOnCrewTab(
  member: CrewMember,
  tab: string,
  now = Date.now(),
) {
  if (!member.active) return false;
  if (member.is_contractor) {
    if (!shiftStillOn(member.shift_expires_at, now)) return false;
    return tab === 'all' || member.panel === tab;
  }
  const covering = coveringLetter(member, now);
  if (covering) return tab === 'all' || tab === panelForLetter(covering);
  return tab === 'all' || member.panel === tab;
}

/** Crew-tab badge for access 1–3. Level 4 and 5 get no operational count. */
export function crewTabAttention(
  crew: CrewMember[],
  department: Department,
  accessLevel: number,
  activeCrew: string | null | undefined,
  now = Date.now(),
) {
  if (accessLevel >= 4) return 0;
  const panel = activeCrew?.trim();
  if (!panel) return 0;
  const onCrew = crew.filter((member) => visibleOnCrewTab(member, panel, now) && !member.away);
  if (department === 'workshop') {
    return onCrew.filter((member) => isWorkshopRoster(member)).length;
  }
  if (department === 'production') {
    return onCrew.filter((member) => normalizeDepartment(member.department) === 'production' && member.allocated_role !== 'Crib Floater' && !member.allocated_machine_id && !member.shift_duty?.trim()).length;
  }
  return onCrew.filter((member) => {
    if (normalizeDepartment(member.department) !== 'production') return false;
    const missingPassOut = (member.passed_out_equipment ?? []).length === 0;
    const pendingTraining = (member.in_training_equipment ?? []).length > 0;
    return missingPassOut || pendingTraining;
  }).length;
}

/** Suffix for the sign-on sheet trade column, without the surrounding brackets. */
export function rosterRoleNote(member: Pick<CrewMember, 'is_contractor' | 'contractor_company' | 'panel' | 'overtime_crew_group' | 'shift_expires_at'>, now = Date.now()) {
  if (member.is_contractor && shiftStillOn(member.shift_expires_at, now)) {
    return `Contractor - ${member.contractor_company?.trim() || 'Contractor'}`;
  }
  const covering = coveringLetter(member, now);
  if (covering) return `OT - ${member.panel || 'home crew'}`;
  return null;
}
