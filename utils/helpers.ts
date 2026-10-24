// utils/helpers.ts
import { SupabaseClient } from '@supabase/supabase-js';

export async function logAssetHistory(
  supabase: SupabaseClient,
  assetId: string,
  fitterName: string,
  note: string,
  stage: string
) {
  return supabase.from('asset_history_notes').insert([
    {
      asset_id: assetId,
      fitter_name: fitterName,
      note,
      stage,
    },
  ]);
}

export function formatDateTime(isoString: string | null) {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return `${date.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export function getElapsedDown(downSince: string | null) {
  if (!downSince) return '--';
  const diffMs = Date.now() - new Date(downSince).getTime();
  if (diffMs < 0) return 'Just down';
  return `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m`;
}

export function getEtuStatus(expectedUp: string | null) {
  if (!expectedUp) return null;
  const diffMs = new Date(expectedUp).getTime() - Date.now();
  const absDiffMs = Math.abs(diffMs);
  const hours = Math.floor(absDiffMs / 3600000);
  const mins = Math.floor((absDiffMs % 3600000) / 60000);

  if (diffMs < 0) {
    return { overdue: true, label: `OVERDUE ${hours}h ${mins}m` };
  }
  return { overdue: false, label: `${hours}h ${mins}m to go` };
}