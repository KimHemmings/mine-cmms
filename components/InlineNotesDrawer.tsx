import { useState } from 'react';
import { Send } from 'lucide-react';
import { HistoryNote } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { createClient } from '@/utils/supabase/client';
import { isNetworkError } from '@/utils/stageQueue';
import { queueNote } from '@/utils/noteQueue';
import DictationMicButton, { useDictationTarget } from '@/components/ui/DictationMicButton';
import TidyNotesButton from '@/components/ui/TidyNotesButton';
import { useFeedback } from '@/components/ui/FeedbackProvider';

interface InlineNotesDrawerProps {
  assetId: string;
  itemId: string;
  contextLabel: string;
  notes: HistoryNote[];
  activeFitter: string;
  onRefresh: () => void;
  heading?: string;
  taskDescription?: string;
  fleetId?: string;
  canAddNotes?: boolean;
}

export default function InlineNotesDrawer({
  assetId,
  itemId,
  contextLabel,
  notes,
  activeFitter,
  onRefresh,
  heading = 'Work order notes:',
  taskDescription = '',
  fleetId,
  canAddNotes = true,
}: InlineNotesDrawerProps) {
  const note = useDictationTarget();
  const [fitterStamp, setFitterStamp] = useState(activeFitter);
  const supabase = createClient();
  const { showToast } = useFeedback();

  const itemNotes = notes.filter((note) => note.work_order_id === itemId);

  async function handleAddNote() {
    const text = note.value.trim();
    if (!text) return;
    const fitterName = (fitterStamp || activeFitter || 'Shift Fitter').trim();
    const row = {
      assetId,
      workOrderId: itemId,
      fitterName,
      note: text,
      stage: 'IN_REPAIR',
    };

    const holdLocally = () => {
      queueNote(row);
      note.setValue('');
      showToast({ message: 'Saved on this tablet. It will send when the signal is back.' });
      onRefresh();
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      holdLocally();
      return;
    }

    const { error } = await supabase.from('asset_history_notes').insert([{
      asset_id: row.assetId,
      work_order_id: row.workOrderId,
      fitter_name: row.fitterName,
      note: row.note,
      stage: row.stage,
    }]);

    if (error && isNetworkError(error)) {
      holdLocally();
      return;
    }
    if (error) {
      showToast({ message: 'That note was not saved. Try again.', tone: 'error' });
      return;
    }

    note.setValue('');
    onRefresh();
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {heading}
        </span>
        {canAddNotes && <DictationMicButton {...note.mic} />}
      </div>

      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {itemNotes.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">No notes logged for this specific item yet.</p>
        ) : (
          itemNotes.map((n) => (
            <div key={n.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-200 flex items-start gap-2 shadow-2xs">
              <span className="font-mono text-[10px] text-slate-400 shrink-0">
                {n.pending ? 'Waiting to send' : formatDateTime(n.created_at)}
              </span>
              <span className="font-bold text-amber-800 shrink-0">[{n.fitter_name}]:</span>
              <span className="text-slate-800">{n.note.replace(/^\[.*?\]:\s*/, '')}</span>
            </div>
          ))
        )}
      </div>

      {canAddNotes && (
      <div className="flex flex-col sm:flex-row gap-1.5 pt-1">
        <input
          type="text"
          placeholder="Fitter Name & ID"
          value={fitterStamp}
          onChange={(e) => setFitterStamp(e.target.value)}
          className="sm:w-48 bg-white border border-slate-300 rounded p-1.5 text-xs font-bold text-slate-800"
        />
        <input
          type="text"
          placeholder="Add progressive repair note..."
          value={note.value}
          onChange={note.onChange}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
          className="flex-1 min-h-[38px] bg-white border border-slate-300 rounded px-2 text-sm text-slate-900"
        />
        <TidyNotesButton
          rawNotes={note.value}
          fleetId={fleetId}
          taskDescription={taskDescription}
          isSingleNote
          prepare={note.hold}
          onTidied={note.setValue}
        />
        <button
          type="button"
          onClick={handleAddNote}
          className="min-h-[38px] px-3 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm font-bold shrink-0 flex items-center justify-center gap-1 shadow-2xs"
        >
          <Send className="w-4 h-4" /> Add Note
        </button>
      </div>
      )}
    </div>
  );
}