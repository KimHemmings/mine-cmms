import { useState, useEffect } from 'react';
import { X, BookOpen, Filter, User, Send } from 'lucide-react';
import { Asset, HistoryNote } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { formatDateTime } from '@/utils/helpers';

interface HistoryModalProps {
  asset: Asset | null;
  onClose: () => void;
  userRole: 'management' | 'fitter';
}

export default function HistoryModal({ asset, onClose, userRole }: HistoryModalProps) {
  const [notes, setNotes] = useState<HistoryNote[]>([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteAuthor, setNewNoteAuthor] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    if (asset) {
      setNewNoteAuthor(asset.fitter_assigned ? asset.fitter_assigned.split('/')[0].trim() : (userRole === 'management' ? 'Planner' : 'Fitter'));
      setHistoryFilter('');
      fetchNotes();
    }
  }, [asset]);

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
      stage: asset.shift_stage || 'N/A'
    }]);

    if (!error) {
      setNewNoteText('');
      fetchNotes();
    }
  }

  const displayedNotes = notes.filter(n => n.note.toLowerCase().includes(historyFilter.toLowerCase()) || n.fitter_name.toLowerCase().includes(historyFilter.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end">
      <div className="bg-white border-l border-slate-300 w-full max-w-2xl h-full p-6 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" /> {asset.fleet_id} DOSSIER
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{asset.make_model} • Owner: {asset.machine_owner || 'Central'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>
        
        {/* Filter */}
        <div className="mt-4 relative">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input 
            type="text" 
            placeholder="Filter history by keyword, fitter, or stage..." 
            value={historyFilter} 
            onChange={(e) => setHistoryFilter(e.target.value)} 
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500" 
          />
        </div>

        {/* Notes Timeline */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-2">
          {displayedNotes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center mt-10 italic">No history logs found for this machine.</p>
          ) : (
            displayedNotes.map((item) => (
               <div key={item.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm shadow-sm">
                 <div className="flex justify-between font-bold text-slate-800 mb-2">
                   <span className="flex items-center gap-1.5"><User className="w-4 h-4 text-amber-600"/> {item.fitter_name}</span>
                   <span className="text-slate-500 font-medium text-xs">{formatDateTime(item.created_at)}</span>
                 </div>
                 <p className="text-slate-700 leading-relaxed">{item.note}</p>
                 <span className="inline-block mt-3 text-[10px] font-bold px-2.5 py-1 bg-white text-slate-600 border border-slate-300 rounded-md uppercase shadow-sm">
                   Stage: {item.stage?.replace('_',' ')}
                 </span>
               </div>
            ))
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleAddNote} className="pt-4 border-t border-slate-200 space-y-3 shrink-0">
          <input 
            type="text" 
            placeholder="Your Name" 
            value={newNoteAuthor} 
            onChange={(e) => setNewNoteAuthor(e.target.value)} 
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 shadow-sm" 
            required 
          />
          <div className="flex gap-2">
            <textarea 
              rows={2} 
              placeholder="Add new history log or update..." 
              value={newNoteText} 
              onChange={(e) => setNewNoteText(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 shadow-sm" 
              required 
            />
            <button type="submit" className="px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition shadow-md flex items-center justify-center">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}