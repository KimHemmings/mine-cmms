export function handoverDraftKey(shiftDate: string, shiftName: string, department: string) {
  return `${shiftDate}_${shiftName}_${department}`;
}

export function readHandoverDraft<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeHandoverDraft(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or blocked store still leaves the notes on screen.
  }
}

export function clearHandoverDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // The saved record is already on the server.
  }
}

export function updateHandoverDraft(key: string, patch: Record<string, unknown>) {
  const current = readHandoverDraft<Record<string, unknown>>(key) ?? {};
  const next = { ...current, ...patch };
  for (const [field, value] of Object.entries(patch)) {
    if (value == null || value === '') delete next[field];
  }
  if (Object.keys(next).length === 0) clearHandoverDraft(key);
  else writeHandoverDraft(key, next);
}
