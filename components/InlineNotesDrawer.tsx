import { useState } from 'react';
import { Send } from 'lucide-react';
import { HistoryNote } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { createClient } from '@/utils/supabase/client';

interface InlineNotesDrawerProps {
  assetId: string;
  itemId: string;
  contextLabel: string;
  notes: HistoryNote[];
  activeFitter: string;
  onRefresh: () => void;
}

export default function InlineNotesDrawer({
  assetId,
  itemId,
  contextLabel,
  notes,
  activeFitter,
  onRefresh,
}: InlineNotesDrawerProps) {
  const [noteText, setNoteText] = useState('');
  const [fitterStamp, setFitterStamp] = useState(activeFitter);
  const supabase = createClient();

  const itemNotes = notes.filter((n) => 
    n.asset_id === assetId && n.note.toLowerCase().includes(contextLabel.toLowerCase().slice(0, 15))
  );

  async function handleAddNote() {
    if (!noteText.trim()) return;

    await supabase.from('asset_history_notes').insert([{
      asset_id: assetId,
      fitter_name: (fitterStamp || activeFitter || 'Shift Fitter').trim(),
      note: `[${contextLabel}]: ${noteText.trim()}`,
      stage: 'IN_REPAIR'
    }]);

    setNoteText('');
    onRefresh();
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
        Progressive SAP Notes:
      </span>

      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {itemNotes.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">No notes logged for this specific item yet.</p>
        ) : (
          itemNotes.map((n) => (
            <div key={n.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-200 flex items-start gap-2 shadow-2xs">
              <span className="font-mono text-[10px] text-slate-400 shrink-0">{formatDateTime(n.created_at)}</span>
              <span className="font-bold text-amber-800 shrink-0">[{n.fitter_name}]:</span>
              <span className="text-slate-800">{n.note.replace(/^\[.*?\]:\s*/, '')}</span>
            </div>
          ))
        )}
      </div>

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
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
          className="flex-1 bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-900"
        />
        <button
          type="button"
          onClick={handleAddNote}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold shrink-0 flex items-center justify-center gap-1 shadow-2xs"
        >
          <Send className="w-3 h-3" /> Add Note
        </button>
      </div>
    </div>
  );
}