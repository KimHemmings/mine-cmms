const KEY = 'mine_cmms_stage_queue';

export interface QueuedStage {
  id: string;
  woId: string;
  assetId: string;
  newStage: string;
  fitter: string;
  at: string;
}

export function readStageQueue(): QueuedStage[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.woId === 'string' && typeof item.newStage === 'string');
  } catch {
    return [];
  }
}

export function queueStage(item: Omit<QueuedStage, 'id' | 'at'> & { at?: string }) {
  const next = readStageQueue().filter((row) => row.woId !== item.woId);
  next.push({
    id: crypto.randomUUID(),
    woId: item.woId,
    assetId: item.assetId,
    newStage: item.newStage,
    fitter: item.fitter,
    at: item.at ?? new Date().toISOString(),
  });
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('stage-queue-changed'));
}

export function dropQueuedStage(woId: string) {
  const next = readStageQueue().filter((row) => row.woId !== woId);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('stage-queue-changed'));
}

let flushing = false;

export function beginStageFlush() {
  if (flushing) return false;
  flushing = true;
  return true;
}

export function endStageFlush() {
  flushing = false;
}

export function isNetworkError(error: { message?: string } | null | undefined) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = (error?.message ?? '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network') || message.includes('load failed');
}
