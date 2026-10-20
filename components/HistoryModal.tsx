import { useState, useEffect } from 'react';
import { X, BookOpen, Filter, User, Send, Copy, Check } from 'lucide-react';
import { Asset, HistoryNote } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { formatDateTime } from '@/utils/helpers';
import { generateSapNotesText, copyToClipboard } from '@/utils/sapFormatter';

interface HistoryModalProps {
  asset: Asset | null;
  onClose: () => void;
  userRole: 'management' | 'fitter';
  activeFitter: string;
}

export default function HistoryModal({ asset, onClose, activeFitter }: HistoryModalProps) {
  const [notes, setNotes] = useState<HistoryNote[]>([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteAuthor, setNewNoteAuthor] = useState('');
  const [copied, setCopied] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    if (asset) {
      setNewNoteAuthor(activeFitter || (asset.fitter_assigned ? asset.fitter_assigned.split('/')[0].trim() : 'D. Kelly (#4821)'));
      setHistoryFilter('');
      fetchNotes();
    }
  }, [asset, activeFitter]);

  async function fetchNotes() {
    if (!asset) return;
    const { data } = await supabase.from('asset_history_notes').select('*').eq('asset_id', asset.id).order('created_at', { ascending: false });
    if (data) setNotes(data as HistoryNote[]);
  }

  if (!asset) return null;

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || !newNoteText.trim() || !newNoteAuthor.trim()) return;

    const { error } = await supabase.from('asset_history_notes').insert([{
      asset_id: asset.id,
      fitter_name: newNoteAuthor.trim(),
      note: newNoteText.trim(),
      stage: asset.shift_stage || 'IN_REPAIR'
    }]);

    if (!error) {
      setNewNoteText('');
      fetchNotes();
    }
  }

  async function handleCopyAllSapNotes() {
    const text = generateSapNotesText(displayedNotes);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const displayedNotes = notes.filter(n => n.note.toLowerCase().includes(historyFilter.toLowerCase()) || n.fitter_name.toLowerCase().includes(historyFilter.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end">
      <div className="bg-white border-l border-slate-300 w-full max-w-2xl h-full p-6 shadow-2xl flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" /> {asset.fleet_id} SAP NOTES & RUNNING LOG
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{asset.make_model} • Owner: {asset.machine_owner || 'Central'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAllSapNotes}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold rounded-lg transition"
              title="Copy only progressive notes for SAP confirmation"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied for SAP!' : 'Copy SAP Notes'}
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Filter */}
        <div className="mt-4 relative">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input 
            type="text" 
            placeholder="Filter SAP notes by keyword, fitter name, or stage..." 
            value={historyFilter} 
            onChange={(e) => setHistoryFilter(e.target.value)} 
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500" 
          />
        </div>

        {/* Notes Timeline */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-2">
          {displayedNotes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center mt-10 italic">No progressive notes recorded yet.</p>
          ) : (
            displayedNotes.map((item) => (
               <div key={item.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm shadow-2xs">
                 <div className="flex justify-between font-bold text-slate-800 mb-1.5">
                   <span className="flex items-center gap-1.5 text-xs text-amber-900"><User className="w-3.5 h-3.5 text-amber-600"/> {item.fitter_name}</span>
                   <span className="text-slate-500 font-medium text-[11px] font-mono">{formatDateTime(item.created_at)}</span>
                 </div>
                 <p className="text-slate-800 leading-relaxed text-xs">{item.note}</p>
                 {item.stage && (
                   <span className="inline-block mt-2 text-[9px] font-bold px-2 py-0.5 bg-white text-slate-600 border border-slate-300 rounded uppercase">
                     Stage: {item.stage.replace('_',' ')}
                   </span>
                 )}
               </div>
            ))
          )}
        </div>

        {/* Input Form with Real Fitter Stamp */}
        <form onSubmit={handleAddNote} className="pt-4 border-t border-slate-200 space-y-2.5 shrink-0">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Your Name & ID (e.g. D. Kelly #4821)" 
              value={newNoteAuthor} 
              onChange={(e) => setNewNoteAuthor(e.target.value)} 
              className="w-1/3 bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-900" 
              required 
            />
            <input
              type="text" 
              placeholder="Add progressive repair / SAP note..." 
              value={newNoteText} 
              onChange={(e) => setNewNoteText(e.target.value)} 
              className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900" 
              required 
            />
            <button type="submit" className="px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition shadow-sm flex items-center justify-center">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}