export interface PitCheckValues {
  highwall_status: string;
  highwall_notes: string;
  blast_status: string;
  blast_notes: string;
  dewatering_status: string;
  dewatering_notes: string;
  ramps_lighting_status: string;
  ramps_lighting_notes: string;
}

export const EMPTY_PIT_CHECKS: PitCheckValues = {
  highwall_status: 'Checked',
  highwall_notes: '',
  blast_status: 'All Clear',
  blast_notes: '',
  dewatering_status: 'Normal',
  dewatering_notes: '',
  ramps_lighting_status: 'Good',
  ramps_lighting_notes: '',
};

export type PitCheckKey = 'highwall' | 'blast' | 'dewatering' | 'ramps';

export const PIT_CHECK_ROWS: { key: PitCheckKey; status: keyof PitCheckValues; notes: keyof PitCheckValues; label: string; options: string[] }[] = [
  { key: 'highwall', status: 'highwall_status', notes: 'highwall_notes', label: 'Highwall / Lowwall & Bench Inspections', options: ['Checked', 'Action Required', 'Restricted Zone'] },
  { key: 'blast', status: 'blast_status', notes: 'blast_notes', label: 'Blast Exclusion & Shotfiring Windows', options: ['No Blast Scheduled', 'Blast Window Active', 'All Clear'] },
  { key: 'dewatering', status: 'dewatering_status', notes: 'dewatering_notes', label: 'Dewatering, Sumps & Pumps', options: ['Normal', 'Pump Attention', 'Water Impacting Pit'] },
  { key: 'ramps', status: 'ramps_lighting_status', notes: 'ramps_lighting_notes', label: 'Ramps, Dumps & Lighting Plants', options: ['Good', 'Maintenance Required', 'Lighting Issue'] },
];

export const INCIDENT_CATEGORIES = ['Near Miss', 'Incident', 'HPI (High Potential)', 'Equipment / Property Damage'] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export interface HandoverIncident {
  id: string;
  category: IncidentCategory;
  location: string;
  summary: string;
  openInvestigation: boolean;
  carried: boolean;
}

export const TARP_NAMES = ['Wet Weather', 'Lightning', 'Spon Com', 'Geotech / Highwall', 'Dust'] as const;
export type TarpName = (typeof TARP_NAMES)[number];
export const TARP_LEVELS = ['Normal', 'Level 1', 'Level 2', 'Level 3'] as const;
export type TarpLevel = (typeof TARP_LEVELS)[number];

export interface HandoverTarp {
  name: TarpName;
  level: TarpLevel;
  note: string;
  carried: boolean;
}

export interface ShiftProductionActuals {
  romCoal: string;
  primeOverburden: string;
  delays: string;
}

export const OCE_INSPECTION_STATUSES = ['Pending Upload', 'Completed & Uploaded', 'Verbal Handover — Hardcopy in Tray'] as const;
export const SERVICE_STATUSES = ['Normal', 'Attention Required', 'Restricted'] as const;

export interface HandoverRecord extends PitCheckValues {
  oce_report_url: string;
  oce_report_filename: string;
  oce_report_uploaded_at: string;
  oce_inspection_status: string;
  incidents: HandoverIncident[];
  safety_awareness: string;
  active_tarps: HandoverTarp[];
  shift_production: ShiftProductionActuals;
  services_status: string;
  services_notes: string;
  outgoing_signed_by: string;
  outgoing_signed_at: string;
  oncoming_signed_by: string;
  oncoming_signed_at: string;
  carried_fields: PitCheckKey[];
}

const CHECK_KEYS = new Set<string>(PIT_CHECK_ROWS.map((row) => row.key));

export function emptyTarps(): HandoverTarp[] {
  return TARP_NAMES.map((name) => ({ name, level: 'Normal', note: '', carried: false }));
}

export function emptyHandoverRecord(): HandoverRecord {
  return {
    ...EMPTY_PIT_CHECKS,
    oce_report_url: '',
    oce_report_filename: '',
    oce_report_uploaded_at: '',
    oce_inspection_status: 'Pending Upload',
    incidents: [],
    safety_awareness: '',
    active_tarps: emptyTarps(),
    shift_production: { romCoal: '', primeOverburden: '', delays: '' },
    services_status: 'Normal',
    services_notes: '',
    outgoing_signed_by: '',
    outgoing_signed_at: '',
    oncoming_signed_by: '',
    oncoming_signed_at: '',
    carried_fields: [],
  };
}

export function pitCheckLines(values: PitCheckValues, carried: string[] = []) {
  const open = new Set(carried);
  return PIT_CHECK_ROWS.map((row) => ({
    label: row.label,
    status: open.has(row.key) ? `${values[row.status] || '—'} · CARRIED OVER FROM PREV SHIFT` : (values[row.status] || '—'),
    notes: values[row.notes] || '',
  }));
}

function blastIsClear(status: string) {
  return status === 'Clear' || status === 'All Clear' || status === 'No Blast Scheduled';
}

export function pitStatusIsClear(key: PitCheckKey, status: string) {
  if (key === 'highwall') return status === 'Checked';
  if (key === 'blast') return blastIsClear(status);
  if (key === 'dewatering') return status === 'Normal';
  return status === 'Good';
}

export function shiftRank(date: string, name: string) {
  return `${date}|${name === 'Night Shift' ? '1' : '0'}`;
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asCategory(value: unknown): IncidentCategory {
  return INCIDENT_CATEGORIES.includes(value as IncidentCategory) ? value as IncidentCategory : 'Incident';
}

function asLevel(value: unknown): TarpLevel {
  return TARP_LEVELS.includes(value as TarpLevel) ? value as TarpLevel : 'Normal';
}

export function normalizeIncidents(value: unknown, fromPrevious = false): HandoverIncident[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Partial<HandoverIncident>;
    const openInvestigation = Boolean(row.openInvestigation);
    if (fromPrevious && !openInvestigation) return [];
    return [{
      id: text(row.id) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `incident-${Math.random().toString(36).slice(2)}`),
      category: asCategory(row.category),
      location: text(row.location),
      summary: text(row.summary),
      openInvestigation,
      carried: fromPrevious ? true : Boolean(row.carried) && openInvestigation,
    }];
  });
}

export function normalizeTarps(value: unknown, fromPrevious = false): HandoverTarp[] {
  const raw = Array.isArray(value) ? value : [];
  return TARP_NAMES.map((name) => {
    const found = raw.find((item) => item && typeof item === 'object' && (item as HandoverTarp).name === name) as Partial<HandoverTarp> | undefined;
    const level = asLevel(found?.level);
    const active = level !== 'Normal';
    return {
      name,
      level,
      note: text(found?.note),
      carried: fromPrevious ? active : Boolean(found?.carried) && active,
    };
  });
}

function normalizeProduction(value: unknown): ShiftProductionActuals {
  const row = value && typeof value === 'object' ? value as Partial<ShiftProductionActuals> : {};
  return {
    romCoal: text(row.romCoal),
    primeOverburden: text(row.primeOverburden),
    delays: text(row.delays),
  };
}

function pitValuesFrom(row: Partial<PitCheckValues>): PitCheckValues {
  return {
    highwall_status: text(row.highwall_status) || EMPTY_PIT_CHECKS.highwall_status,
    highwall_notes: text(row.highwall_notes),
    blast_status: text(row.blast_status) || EMPTY_PIT_CHECKS.blast_status,
    blast_notes: text(row.blast_notes),
    dewatering_status: text(row.dewatering_status) || EMPTY_PIT_CHECKS.dewatering_status,
    dewatering_notes: text(row.dewatering_notes),
    ramps_lighting_status: text(row.ramps_lighting_status) || EMPTY_PIT_CHECKS.ramps_lighting_status,
    ramps_lighting_notes: text(row.ramps_lighting_notes),
  };
}

function carriedPitKeys(row: { carried_fields?: unknown }, values: PitCheckValues, fromPrevious: boolean): PitCheckKey[] {
  if (fromPrevious) {
    return PIT_CHECK_ROWS.flatMap((item) => (pitStatusIsClear(item.key, values[item.status]) ? [] : [item.key]));
  }
  const stored = Array.isArray(row.carried_fields) ? row.carried_fields : [];
  return stored.flatMap((key) => {
    if (!CHECK_KEYS.has(String(key))) return [];
    const check = String(key) as PitCheckKey;
    const match = PIT_CHECK_ROWS.find((item) => item.key === check);
    if (!match || pitStatusIsClear(check, values[match.status])) return [];
    return [check];
  });
}

export interface HandoverCheckRow extends Partial<Omit<HandoverRecord, 'incidents' | 'active_tarps' | 'shift_production' | 'carried_fields'>> {
  shift_date?: string;
  shift_name?: string;
  crew_group?: string;
  updated_at?: string | null;
  carried_fields?: unknown;
  incidents?: unknown;
  active_tarps?: unknown;
  shift_production?: unknown;
}

export function recordFromRow(row: HandoverCheckRow, fromPrevious = false): HandoverRecord {
  const pit = pitValuesFrom(row);
  const checks = fromPrevious ? carryPitChecks(pit) : { values: pit, carried: carriedPitKeys(row, pit, false) };
  return {
    ...checks.values,
    oce_report_url: fromPrevious ? '' : text(row.oce_report_url),
    oce_report_filename: fromPrevious ? '' : text(row.oce_report_filename),
    oce_report_uploaded_at: fromPrevious ? '' : text(row.oce_report_uploaded_at),
    oce_inspection_status: fromPrevious ? 'Pending Upload' : text(row.oce_inspection_status) || 'Pending Upload',
    incidents: normalizeIncidents(row.incidents, fromPrevious),
    safety_awareness: fromPrevious ? '' : text(row.safety_awareness),
    active_tarps: normalizeTarps(row.active_tarps, fromPrevious),
    shift_production: fromPrevious ? { romCoal: '', primeOverburden: '', delays: '' } : normalizeProduction(row.shift_production),
    services_status: fromPrevious ? 'Normal' : text(row.services_status) || 'Normal',
    services_notes: fromPrevious ? '' : text(row.services_notes),
    outgoing_signed_by: '',
    outgoing_signed_at: '',
    oncoming_signed_by: '',
    oncoming_signed_at: '',
    carried_fields: checks.carried,
  };
}

function carryPitChecks(values: PitCheckValues) {
  const next = { ...EMPTY_PIT_CHECKS };
  const carried: PitCheckKey[] = [];
  for (const row of PIT_CHECK_ROWS) {
    if (pitStatusIsClear(row.key, values[row.status])) continue;
    next[row.status] = values[row.status];
    next[row.notes] = values[row.notes];
    carried.push(row.key);
  }
  return { values: next, carried };
}

export function previousHandoverRow<T extends { shift_date?: string; shift_name?: string; updated_at?: string | null }>(
  rows: T[],
  shiftDate: string,
  shiftName: string,
) {
  const currentRank = shiftRank(shiftDate, shiftName);
  return rows
    .filter((row) => row.shift_date && row.shift_name && shiftRank(row.shift_date, row.shift_name) < currentRank)
    .sort((a, b) => shiftRank(b.shift_date || '', b.shift_name || '').localeCompare(shiftRank(a.shift_date || '', a.shift_name || ''))
      || (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
}

export function latestSafetyAwareness(rows: { safety_awareness?: string | null; shift_date?: string; shift_name?: string; updated_at?: string | null }[]) {
  const filled = rows.filter((row) => text(row.safety_awareness).trim());
  filled.sort((a, b) => shiftRank(b.shift_date || '', b.shift_name || '').localeCompare(shiftRank(a.shift_date || '', a.shift_name || ''))
    || (b.updated_at || '').localeCompare(a.updated_at || ''));
  return text(filled[0]?.safety_awareness).trim();
}

export const HANDOVER_CHECK_COLUMNS = [
  'shift_date', 'shift_name', 'crew_group', 'updated_at', 'carried_fields',
  'highwall_status', 'highwall_notes', 'blast_status', 'blast_notes',
  'dewatering_status', 'dewatering_notes', 'ramps_lighting_status', 'ramps_lighting_notes',
  'oce_report_url', 'oce_report_filename', 'oce_report_uploaded_at', 'oce_inspection_status',
  'incidents', 'safety_awareness', 'active_tarps', 'shift_production',
  'services_status', 'services_notes',
  'outgoing_signed_by', 'outgoing_signed_at', 'oncoming_signed_by', 'oncoming_signed_at',
].join(', ');

export function toHandoverWrite(
  record: HandoverRecord,
  meta: { shiftDate: string; shiftName: string; crewGroup: string; supervisorName: string },
) {
  return {
    shift_date: meta.shiftDate,
    shift_name: meta.shiftName,
    crew_group: meta.crewGroup,
    highwall_status: record.highwall_status,
    highwall_notes: record.highwall_notes,
    blast_status: record.blast_status,
    blast_notes: record.blast_notes,
    dewatering_status: record.dewatering_status,
    dewatering_notes: record.dewatering_notes,
    ramps_lighting_status: record.ramps_lighting_status,
    ramps_lighting_notes: record.ramps_lighting_notes,
    carried_fields: record.carried_fields,
    oce_report_url: record.oce_report_url || null,
    oce_report_filename: record.oce_report_filename || null,
    oce_report_uploaded_at: record.oce_report_uploaded_at || null,
    oce_inspection_status: record.oce_inspection_status || 'Pending Upload',
    incidents: record.incidents,
    safety_awareness: record.safety_awareness || null,
    active_tarps: record.active_tarps,
    shift_production: record.shift_production,
    services_status: record.services_status || 'Normal',
    services_notes: record.services_notes || null,
    outgoing_signed_by: record.outgoing_signed_by || null,
    outgoing_signed_at: record.outgoing_signed_at || null,
    oncoming_signed_by: record.oncoming_signed_by || null,
    oncoming_signed_at: record.oncoming_signed_at || null,
    updated_by: meta.supervisorName || 'Production Supervisor',
    updated_at: new Date().toISOString(),
  };
}
