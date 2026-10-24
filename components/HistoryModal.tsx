'use client';

import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { Asset, HistoryNote } from '@/types';
import { generateSapNotesText, copyToClipboard } from '@/utils/sapFormatter';
import { createClient } from '@/utils/supabase/client';
import HistoryFilterBar, { TimeScope } from './history/HistoryFilterBar';
import HistoryTimelineList from './history/HistoryTimelineList';
import HistoryNoteInput from './history/HistoryNoteInput';

interface ShiftHistoryModalProps {
  isOpen?: boolean;
  asset: Asset | null;
  notes?: HistoryNote[];
  activeFitter: string;
  userRole?: 'management' | 'fitter';
  onClose: () => void;
  onRefresh?: () => void;
}

export default function ShiftHistoryModal({
  isOpen,
  asset,
  notes = [],
  activeFitter,
  onClose,
  onRefresh,
}: ShiftHistoryModalProps) {
  const [newNote, setNewNote] = useState('');
  const [fitterName, setFitterName] = useState(activeFitter || 'Shift Fitter');
  const [searchFilter, setSearchFilter] = useState('');
  const [timeScope, setTimeScope] = useState<TimeScope>('CURRENT_EVENT');
  const [selectedSystem, setSelectedSystem] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  if (!isOpen || !asset) return null;

  const assetNotes = notes.filter((n) => n.asset_id === asset.id);

  const scopedNotes = assetNotes.filter((n) => {
    if (timeScope === 'CURRENT_EVENT') {
      if (!asset.down_since) return true;
      return new Date(n.created_at).getTime() >= new Date(asset.down_since).getTime();
    }
    if (timeScope === 'ROSTER_7D') {
      return new Date(n.created_at).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }
    return true;
  });

  const systemFilteredNotes = scopedNotes.filter((n) => {
    if (selectedSystem === 'ALL') return true;
    return n.note.toLowerCase().includes(selectedSystem.toLowerCase());
  });

  const filteredNotes = systemFilteredNotes.filter((n) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      n.note.toLowerCase().includes(q) ||
      n.fitter_name.toLowerCase().includes(q) ||
      (n.stage && n.stage.toLowerCase().includes(q))
    );
  });

  async function handleCopyAllSap() {
    const text = generateSapNotesText(filteredNotes);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim() || !asset) return;
    setSubmitting(true);

    const { error } = await supabase.from('asset_history_notes').insert([
      {
        asset_id: asset.id,
        fitter_name: fitterName.trim() || 'Fitter',
        note: newNote.trim(),
        stage: asset.shift_stage || 'IN_PROGRESS',
      },
    ]);

    if (!error) {
      setNewNote('');
      setSubmitting(false);
      onRefresh?.();
    } else {
      alert('Error adding note: ' + error.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-2xl max-w-2xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="text-amber-600">📖</span> {asset.fleet_id} SAP NOTES & RUNNING LOG
            </h3>
            <p className="text-xs text-slate-500">
              {asset.make_model} • Owner: {asset.machine_owner || 'Central'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllSap}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
                copied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white hover:bg-slate-50 border-amber-300 text-amber-900'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
              {copied ? 'Copied to Clipboard!' : 'Copy SAP Notes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <HistoryFilterBar
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          timeScope={timeScope}
          setTimeScope={setTimeScope}
          selectedSystem={selectedSystem}
          setSelectedSystem={setSelectedSystem}
          totalNotesCount={assetNotes.length}
          filteredCount={filteredNotes.length}
        />

        <HistoryTimelineList notes={filteredNotes} />

        <HistoryNoteInput
          fitterName={fitterName}
          setFitterName={setFitterName}
          newNote={newNote}
          setNewNote={setNewNote}
          onSubmit={handleAddNote}
          submitting={submitting}
        />
      </div>
    </div>
  );
}