import { HistoryNote } from '@/types';
import { formatDateTime } from '@/utils/helpers';

// Copies ONLY the clean progressive notes entered by fitters — zero header fluff
export function generateSapNotesText(
  notes: HistoryNote[] = [],
  keywordFilter?: string
): string {
  let filtered = notes;
  if (keywordFilter) {
    filtered = notes.filter((n) => 
      n.note.toLowerCase().includes(keywordFilter.toLowerCase())
    );
  }

  if (filtered.length === 0) {
    return '• Work executed as per work order scope. No progressive notes recorded.';
  }

  return filtered
    .map((n) => `• ${formatDateTime(n.created_at)} [${n.fitter_name}]: ${n.note.replace(/^\[.*?\]:\s*/, '')}`)
    .join('\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch {
    return false;
  }
}