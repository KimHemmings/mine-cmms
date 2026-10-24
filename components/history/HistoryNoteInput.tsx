'use client';

import React from 'react';
import { Send, Loader2 } from 'lucide-react';

interface HistoryNoteInputProps {
  fitterName: string;
  setFitterName: (val: string) => void;
  newNote: string;
  setNewNote: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export default function HistoryNoteInput({
  fitterName,
  setFitterName,
  newNote,
  setNewNote,
  onSubmit,
  submitting,
}: HistoryNoteInputProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2"
    >
      <input
        type="text"
        value={fitterName}
        onChange={(e) => setFitterName(e.target.value)}
        className="w-36 bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        placeholder="Fitter Name"
        required
      />
      <input
        type="text"
        value={newNote}
        onChange={(e) => setNewNote(e.target.value)}
        placeholder="Add progressive repair / SAP note..."
        className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        required
      />
      <button
        type="submit"
        disabled={submitting}
        className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center"
        title="Post Note"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </form>
  );
}