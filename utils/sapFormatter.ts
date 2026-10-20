import { HistoryNote } from '@/types';
import { formatDateTime } from '@/utils/helpers';

/**
 * Compiles a comprehensive, chronological confirmation log for SAP long text (IW32 / IW41 / IW42).
 *
 * 1. Intelligently matches notes tagged to this specific work order, main event, or defect.
 * 2. If no notes match the specific tag, it falls back to all chronological notes for the machine
 *    so fitters never copy an empty or incomplete log.
 * 3. Sorts entries chronologically (oldest to newest) to match SAP confirmation diaries.
 * 4. Cleans internal UI labels like "[Main Event Note]:" or "[Scope]:".
 */
export function generateSapNotesText(
  notes: HistoryNote[] = [],
  keywordFilter?: string
): string {
  if (!notes || notes.length === 0) {
    return '• Work executed as per work order scope. No progressive notes recorded.';
  }

  let filtered = notes;

  if (keywordFilter && keywordFilter.trim()) {
    const kw = keywordFilter.trim().toLowerCase();

    // Find notes specifically tagged to this item, main event, or keyword
    const specificMatches = notes.filter((n) => {
      const text = n.note.toLowerCase();
      return (
        text.includes(kw) ||
        (kw.length > 5 && text.includes(kw.slice(0, 8))) ||
        (kw.includes('main') && text.includes('main event'))
      );
    });

    // If specific notes exist for this scope, use them.
    // If not, fall back to all machine notes so the fitter always gets the complete repair log.
    if (specificMatches.length > 0) {
      filtered = specificMatches;
    }
  }

  // Chronological sort: oldest to newest (standard reading order for SAP long text confirmations)
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return sorted
    .map((n) => {
      // Strip internal UI brackets e.g. "[Main Event Note]: Note text" -> "Note text"
      const cleanNote = n.note.replace(/^\[.*?\]:\s*/, '').trim();
      return `• ${formatDateTime(n.created_at)} [${n.fitter_name}]: ${cleanNote}`;
    })
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
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}