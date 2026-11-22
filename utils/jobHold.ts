export const HOLD_STAGES = ['WAITING_PARTS', 'WAITING_OEM', 'WAITING_BAY'] as const;

const HOLD_LABEL: Record<string, string> = {
  WAITING_PARTS: 'WAITING ON PARTS',
  WAITING_OEM: 'WAITING ON OEM',
  WAITING_BAY: 'WAITING ON BAY / CRANE',
};

export function isHoldStage(stage?: string | null) {
  return !!stage && stage in HOLD_LABEL;
}

export function holdBadge(stage?: string | null, eta?: string | null) {
  if (!stage) return null;
  const reason = HOLD_LABEL[stage];
  if (!reason) return null;
  const when = eta?.trim();
  return when ? `${reason} • ETA ${when}` : reason;
}
