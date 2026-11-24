export type HandoverPriority = 'P1' | 'P2' | 'P3';

export function normalizePriority(raw: unknown): HandoverPriority {
  if (typeof raw !== 'string') return 'P3';
  const priority = raw.trim().toUpperCase();
  return priority === 'P1' || priority === 'P2' ? priority : 'P3';
}

export function priorityRank(raw: unknown) {
  const priority = normalizePriority(raw);
  return priority === 'P1' ? 0 : priority === 'P2' ? 1 : 2;
}

export function compareHandoverMachines<T extends { priority: string | null; fleetId: string }>(a: T, b: T) {
  return comparePriorityThenUnit(a.priority, a.fleetId, b.priority, b.fleetId);
}

export function comparePriorityThenUnit(priorityA: unknown, unitA: string, priorityB: unknown, unitB: string) {
  return priorityRank(priorityA) - priorityRank(priorityB)
    || unitA.localeCompare(unitB, undefined, { numeric: true, sensitivity: 'base' });
}

export function effectivePriority(machinePriority: unknown, jobPriorities: unknown[]) {
  return jobPriorities.reduce<HandoverPriority>((highest, candidate) => {
    const priority = normalizePriority(candidate);
    return priorityRank(priority) < priorityRank(highest) ? priority : highest;
  }, normalizePriority(machinePriority));
}

export function priorityBadgeClass(raw: unknown) {
  switch (normalizePriority(raw)) {
    case 'P1':
      return 'border-red-600 bg-red-50 text-red-800 font-black';
    case 'P2':
      return 'border-amber-600 bg-amber-50 text-amber-900 font-black';
    default:
      return 'border-slate-500 bg-slate-100 text-slate-800 font-bold';
  }
}
