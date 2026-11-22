import { CrewMember } from '@/types';

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

/** Suffix for the sign-on sheet trade column, without the surrounding brackets. */
export function rosterRoleNote(member: Pick<CrewMember, 'is_contractor' | 'contractor_company' | 'panel' | 'overtime_crew_group' | 'shift_expires_at'>, now = Date.now()) {
  if (member.is_contractor && shiftStillOn(member.shift_expires_at, now)) {
    return `Contractor - ${member.contractor_company?.trim() || 'Contractor'}`;
  }
  const covering = coveringLetter(member, now);
  if (covering) return `OT - ${member.panel || 'home crew'}`;
  return null;
}
