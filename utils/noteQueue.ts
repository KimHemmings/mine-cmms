import { HistoryNote } from '@/types';

const KEY = 'mine_cmms_note_queue';

export interface QueuedNote {
  id: string;
  assetId: string;
  workOrderId: string;
  fitterName: string;
  note: string;
  stage: string;
  at: string;
}

export function readNoteQueue(): QueuedNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.workOrderId === 'string' && typeof item.note === 'string');
  } catch {
    return [];
  }
}

export function queueNote(item: Omit<QueuedNote, 'id' | 'at'> & { at?: string }) {
  const next = readNoteQueue();
  next.push({
    id: crypto.randomUUID(),
    assetId: item.assetId,
    workOrderId: item.workOrderId,
    fitterName: item.fitterName,
    note: item.note,
    stage: item.stage,
    at: item.at ?? new Date().toISOString(),
  });
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('note-queue-changed'));
}

export function dropQueuedNote(id: string) {
  const next = readNoteQueue().filter((item) => item.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('note-queue-changed'));
}

export function queuedNotesAsHistory(): HistoryNote[] {
  return readNoteQueue().map((item) => ({
    id: item.id,
    asset_id: item.assetId,
    work_order_id: item.workOrderId,
    fitter_name: item.fitterName,
    note: item.note,
    stage: item.stage,
    created_at: item.at,
    pending: true,
  }));
}

export function withQueuedNotes(server: HistoryNote[]): HistoryNote[] {
  const pending = queuedNotesAsHistory();
  const pendingIds = new Set(pending.map((item) => item.id));
  return [...server.filter((item) => !item.pending && !pendingIds.has(item.id)), ...pending];
}

let flushing = false;

export function beginNoteFlush() {
  if (flushing) return false;
  flushing = true;
  return true;
}

export function endNoteFlush() {
  flushing = false;
}
