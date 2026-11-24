export const DEFAULT_ROSTER_ANCHOR = '2026-11-11';
export const DEFAULT_CREW_ROTATION_ORDER = ['A Crew', 'B Crew', 'C Crew', 'D Crew'] as const;
export const ROSTER_CYCLE_SETTINGS_KEY = 'mine_cmms_roster_cycle_settings';
export const ROSTER_CYCLE_SETTINGS_EVENT = 'mine-cmms-roster-cycle-settings-changed';

export type RosterCrewName = (typeof DEFAULT_CREW_ROTATION_ORDER)[number];
export type CrewStatus = 'Day' | 'Night' | 'R&R';

export interface RosterCycleSettings {
  roster_anchor_date: string;
  crew_rotation_order: RosterCrewName[];
}

export interface ActiveCrewsForDate {
  dayCrew: RosterCrewName;
  nightCrew: RosterCrewName;
  rrCrews: [RosterCrewName, RosterCrewName];
  swingStartWed: string;
  swingEndTue: string;
  dayOfSwing: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getSwingStartWednesday(date: string) {
  const parsed = parseIsoDate(date);
  if (!parsed) throw new Error('Roster date must be a valid ISO date.');
  const daysSinceWednesday = (parsed.getUTCDay() - 3 + 7) % 7;
  return toIsoDate(new Date(parsed.getTime() - daysSinceWednesday * DAY_MS));
}

export function addRosterWeeks(wednesday: string, weeks: number) {
  if (!Number.isInteger(weeks)) throw new Error('Roster week offset must be an integer.');
  const start = parseIsoDate(wednesday);
  if (!start || !isWednesday(wednesday)) throw new Error('Roster navigation must start on a Wednesday.');
  return toIsoDate(new Date(start.getTime() + weeks * 7 * DAY_MS));
}

export function addRosterDays(date: string, days: number) {
  if (!Number.isInteger(days)) throw new Error('Roster day offset must be an integer.');
  const parsed = parseIsoDate(date);
  if (!parsed) throw new Error('Roster date must be a valid ISO date.');
  return toIsoDate(new Date(parsed.getTime() + days * DAY_MS));
}

function normalizeRotationOrder(value: unknown): RosterCrewName[] {
  if (!Array.isArray(value) || value.length !== DEFAULT_CREW_ROTATION_ORDER.length) {
    return [...DEFAULT_CREW_ROTATION_ORDER];
  }
  const order = value.filter((crew): crew is RosterCrewName =>
    typeof crew === 'string' && (DEFAULT_CREW_ROTATION_ORDER as readonly string[]).includes(crew),
  );
  return order.length === DEFAULT_CREW_ROTATION_ORDER.length && new Set(order).size === order.length
    ? order
    : [...DEFAULT_CREW_ROTATION_ORDER];
}

function isWednesday(value: string) {
  const date = parseIsoDate(value);
  return date?.getUTCDay() === 3;
}

export function getRosterCycleSettings(): RosterCycleSettings {
  if (typeof window === 'undefined') {
    return {
      roster_anchor_date: DEFAULT_ROSTER_ANCHOR,
      crew_rotation_order: [...DEFAULT_CREW_ROTATION_ORDER],
    };
  }
  try {
    const stored = window.localStorage.getItem(ROSTER_CYCLE_SETTINGS_KEY);
    if (!stored) {
      return {
        roster_anchor_date: DEFAULT_ROSTER_ANCHOR,
        crew_rotation_order: [...DEFAULT_CREW_ROTATION_ORDER],
      };
    }
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid roster cycle settings');
    const settings = parsed as Record<string, unknown>;
    const anchor = typeof settings.roster_anchor_date === 'string' && isWednesday(settings.roster_anchor_date)
      ? settings.roster_anchor_date
      : DEFAULT_ROSTER_ANCHOR;
    return {
      roster_anchor_date: anchor,
      crew_rotation_order: normalizeRotationOrder(settings.crew_rotation_order),
    };
  } catch {
    return {
      roster_anchor_date: DEFAULT_ROSTER_ANCHOR,
      crew_rotation_order: [...DEFAULT_CREW_ROTATION_ORDER],
    };
  }
}

export function saveRosterCycleSettings(settings: RosterCycleSettings) {
  if (!isWednesday(settings.roster_anchor_date)) {
    throw new Error('Roster anchor date must be a Wednesday.');
  }
  const order = normalizeRotationOrder(settings.crew_rotation_order);
  if (settings.crew_rotation_order.length !== order.length
    || settings.crew_rotation_order.some((crew, index) => crew !== order[index])) {
    throw new Error('Roster rotation order must contain each crew exactly once.');
  }
  if (typeof window === 'undefined') throw new Error('Roster settings can only be saved in a browser.');
  window.localStorage.setItem(ROSTER_CYCLE_SETTINGS_KEY, JSON.stringify({
    roster_anchor_date: settings.roster_anchor_date,
    crew_rotation_order: order,
  }));
  window.dispatchEvent(new Event(ROSTER_CYCLE_SETTINGS_EVENT));
}

function cycleWeekForDate(date: string, anchorDate: string) {
  const target = parseIsoDate(date);
  const anchor = parseIsoDate(anchorDate);
  if (!target || !anchor || !isWednesday(anchorDate)) {
    throw new Error('Roster dates must be valid ISO dates and the anchor must be a Wednesday.');
  }
  const daysFromAnchor = Math.floor((target.getTime() - anchor.getTime()) / DAY_MS);
  const weekOffset = Math.floor(daysFromAnchor / 7);
  return {
    weekIndex: ((weekOffset % 4) + 4) % 4,
    dayOfSwing: ((daysFromAnchor % 7) + 7) % 7 + 1,
    swingStartWed: toIsoDate(new Date(anchor.getTime() + weekOffset * 7 * DAY_MS)),
    swingEndTue: toIsoDate(new Date(anchor.getTime() + (weekOffset * 7 + 6) * DAY_MS)),
  };
}

export function getActiveCrewsForDate(
  date: string,
  anchorDate = DEFAULT_ROSTER_ANCHOR,
  rotationOrder: readonly RosterCrewName[] = DEFAULT_CREW_ROTATION_ORDER,
): ActiveCrewsForDate {
  const rotation = normalizeRotationOrder([...rotationOrder]);
  const { weekIndex, dayOfSwing, swingStartWed, swingEndTue } = cycleWeekForDate(date, anchorDate);
  return {
    dayCrew: rotation[weekIndex],
    nightCrew: rotation[(weekIndex + 2) % rotation.length],
    rrCrews: [rotation[(weekIndex + 1) % rotation.length], rotation[(weekIndex + 3) % rotation.length]],
    swingStartWed,
    swingEndTue,
    dayOfSwing,
  };
}

export function getHandoverCrewsForShift(
  shiftType: string,
  shiftDate: string,
  anchorDate = DEFAULT_ROSTER_ANCHOR,
  rotationOrder: readonly RosterCrewName[] = DEFAULT_CREW_ROTATION_ORDER,
) {
  const current = getActiveCrewsForDate(shiftDate, anchorDate, rotationOrder);
  if (shiftType === 'DAY') {
    return {
      outgoingCrew: current.dayCrew,
      incomingCrew: current.nightCrew,
      incomingShiftType: 'NIGHT' as const,
      incomingDate: shiftDate,
    };
  }
  if (shiftType === 'NIGHT') {
    const incomingDate = addRosterDays(shiftDate, 1);
    const nextDayCrew = getActiveCrewsForDate(incomingDate, anchorDate, rotationOrder);
    return {
      outgoingCrew: current.nightCrew,
      incomingCrew: nextDayCrew.dayCrew,
      incomingShiftType: 'DAY' as const,
      incomingDate,
    };
  }
  throw new Error(`Unknown shift type "${shiftType}". Expected DAY or NIGHT.`);
}

export function getCrewStatusForDate(
  crewName: string,
  date: string,
  anchorDate = DEFAULT_ROSTER_ANCHOR,
  rotationOrder: readonly RosterCrewName[] = DEFAULT_CREW_ROTATION_ORDER,
): CrewStatus {
  const active = getActiveCrewsForDate(date, anchorDate, rotationOrder);
  if (active.dayCrew === crewName) return 'Day';
  if (active.nightCrew === crewName) return 'Night';
  return 'R&R';
}

export function getNextWorkingSwing(
  crewName: string,
  fromDate: string,
  anchorDate = DEFAULT_ROSTER_ANCHOR,
  rotationOrder: readonly RosterCrewName[] = DEFAULT_CREW_ROTATION_ORDER,
) {
  const from = parseIsoDate(fromDate);
  if (!from) throw new Error('fromDate must be a valid ISO date.');
  const daysUntilWednesday = (3 - from.getUTCDay() + 7) % 7;
  for (let weekOffset = 0; weekOffset < 4; weekOffset += 1) {
    const candidate = new Date(from.getTime() + (daysUntilWednesday + weekOffset * 7) * DAY_MS);
    const startDate = toIsoDate(candidate);
    const active = getActiveCrewsForDate(startDate, anchorDate, rotationOrder);
    const status = getCrewStatusForDate(crewName, startDate, anchorDate, rotationOrder);
    if (status !== 'R&R') return { startDate, endDate: active.swingEndTue };
  }
  throw new Error(`Unknown crew "${crewName}" or no working swing found.`);
}
