import { CREW_PANELS, CREW_TRADES } from '@/types';
import { PRODUCTION_PLANT } from '@/types/production';
import { normalizeDepartment, type Department } from '@/utils/permissions';

export interface FleetPasteRow {
  fleetId: string;
  model: string;
  category: string;
}

export interface CrewPasteRow {
  name: string;
  trade: string;
  panel: string | null;
  department: Department;
}

function cellsOf(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return [];
  const parts = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',');
  return parts.map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

function rowsOf(text: string) {
  return text.split(/\r?\n/).map(cellsOf).filter((cells) => cells.some(Boolean));
}

function looksLikeHeader(cell: string, words: string[]) {
  const value = cell.toLowerCase();
  return words.some((word) => value === word || value.startsWith(word));
}

export function parseFleetPaste(text: string): FleetPasteRow[] {
  const rows = rowsOf(text);
  const body = rows.filter((cells, index) => !(index === 0 && looksLikeHeader(cells[0] ?? '', ['fleet', 'unit', 'id'])));
  const seen = new Set<string>();
  const parsed: FleetPasteRow[] = [];
  for (const cells of body) {
    const fleetId = (cells[0] ?? '').toUpperCase();
    const model = cells[1] ?? '';
    if (!fleetId || !model || seen.has(fleetId)) continue;
    seen.add(fleetId);
    const rawCategory = cells[2] ?? '';
    const category = PRODUCTION_PLANT.find((item) => item.toLowerCase() === rawCategory.toLowerCase()) ?? (rawCategory || 'Haul Truck');
    parsed.push({ fleetId, model, category });
  }
  return parsed;
}

function panelOf(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const named = CREW_PANELS.find((panel) => panel.toLowerCase() === raw);
  if (named) return named;
  const letter = raw[0];
  if ('abcd'.includes(letter) && (raw.length === 1 || raw.includes('crew'))) {
    return `${letter.toUpperCase()} Crew` as (typeof CREW_PANELS)[number];
  }
  return null;
}

function tradeOf(value: string) {
  const raw = value.trim().toLowerCase();
  return CREW_TRADES.find((trade) => trade.toLowerCase() === raw) ?? 'Other';
}

export function parseCrewPaste(text: string, fallbackDepartment: Department): CrewPasteRow[] {
  const rows = rowsOf(text);
  const body = rows.filter((cells, index) => !(index === 0 && looksLikeHeader(cells[0] ?? '', ['name', 'person', 'operator'])));
  const parsed: CrewPasteRow[] = [];
  for (const cells of body) {
    const name = cells[0] ?? '';
    if (!name) continue;
    const departmentCell = (cells[3] ?? '').trim();
    parsed.push({
      name,
      trade: tradeOf(cells[1] ?? ''),
      panel: panelOf(cells[2] ?? ''),
      department: departmentCell ? normalizeDepartment(departmentCell) : fallbackDepartment,
    });
  }
  return parsed;
}
