export interface KpiTargetSet {
  availability: number | null;
  mtbf: number | null;
  mttr: number | null;
  downtime: number | null;
}

export interface DailyReportTargets {
  defaults: KpiTargetSet;
  byClass: Record<string, KpiTargetSet>;
  byAsset: Record<string, KpiTargetSet>;
}

export const TARGETS_KEY = 'daily-report-kpi-targets';

export const SUGGESTED_TARGETS: KpiTargetSet = {
  availability: 85,
  mtbf: 120,
  mttr: 6,
  downtime: null,
};

export const EMPTY_TARGETS: DailyReportTargets = {
  defaults: { ...SUGGESTED_TARGETS },
  byClass: {},
  byAsset: {},
};

export type TargetTone = 'met' | 'near' | 'miss' | 'none';

function numberOrNull(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readSet(value: unknown, fallback: KpiTargetSet): KpiTargetSet {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    availability: numberOrNull(row.availability) ?? fallback.availability,
    mtbf: numberOrNull(row.mtbf) ?? fallback.mtbf,
    mttr: numberOrNull(row.mttr) ?? fallback.mttr,
    downtime: numberOrNull(row.downtime),
  };
}

export function readDailyReportTargets(raw: string | null): DailyReportTargets {
  if (!raw) return structuredClone(EMPTY_TARGETS);
  try {
    const parsed = JSON.parse(raw) as { defaults?: unknown; byClass?: unknown; byAsset?: unknown };
    const byClass: Record<string, KpiTargetSet> = {};
    const byAsset: Record<string, KpiTargetSet> = {};
    if (parsed.byClass && typeof parsed.byClass === 'object') {
      for (const [key, value] of Object.entries(parsed.byClass)) byClass[key] = readSet(value, { availability: null, mtbf: null, mttr: null, downtime: null });
    }
    if (parsed.byAsset && typeof parsed.byAsset === 'object') {
      for (const [key, value] of Object.entries(parsed.byAsset)) byAsset[key.toUpperCase()] = readSet(value, { availability: null, mtbf: null, mttr: null, downtime: null });
    }
    return { defaults: readSet(parsed.defaults, SUGGESTED_TARGETS), byClass, byAsset };
  } catch {
    return structuredClone(EMPTY_TARGETS);
  }
}

function pick(override: number | null | undefined, fallback: number | null) {
  return override == null ? fallback : override;
}

export function resolveTargets(
  store: DailyReportTargets,
  filter: { assetQuery: string; machineClass: string },
): { values: KpiTargetSet; scope: string } {
  const assetKey = filter.assetQuery.trim().toUpperCase();
  const asset = assetKey ? store.byAsset[assetKey] : undefined;
  const machine = filter.machineClass !== 'all' ? store.byClass[filter.machineClass] : undefined;
  const base = store.defaults;
  const values: KpiTargetSet = {
    availability: pick(asset?.availability, pick(machine?.availability, base.availability)),
    mtbf: pick(asset?.mtbf, pick(machine?.mtbf, base.mtbf)),
    mttr: pick(asset?.mttr, pick(machine?.mttr, base.mttr)),
    downtime: pick(asset?.downtime, pick(machine?.downtime, base.downtime)),
  };
  const scope = asset ? filter.assetQuery.trim() : machine ? filter.machineClass : 'All fleets';
  return { values, scope };
}

export function targetTone(value: number | null, target: number | null, direction: 'higher' | 'lower'): TargetTone {
  if (value == null || target == null || !Number.isFinite(value) || !Number.isFinite(target)) return 'none';
  if (direction === 'higher') {
    if (value >= target) return 'met';
    if (value >= target * 0.95) return 'near';
    return 'miss';
  }
  if (value <= target) return 'met';
  if (value <= target * 1.1) return 'near';
  return 'miss';
}
