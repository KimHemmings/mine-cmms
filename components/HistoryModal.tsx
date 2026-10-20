'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Send, User, Search, Clock } from 'lucide-react';
import { Asset, HistoryNote } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { generateSapNotesText, copyToClipboard } from '@/utils/sapFormatter';
import { createClient } from '@/utils/supabase/client';

interface ShiftHistoryModalProps {
  isOpen?: boolean;
  asset: Asset | null;
  notes?: HistoryNote[];
  activeFitter: string;
  userRole?: 'management' | 'fitter';
  onClose: () => void;
  onRefresh?: () => void;
}

type TimeScope = 'CURRENT_EVENT' | 'ROSTER_7D' | 'ALL';

const STAGE_BADGES: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-900 border-blue-300',
  WAITING_PARTS: 'bg-amber-100 text-amber-900 border-amber-300',
  WAITING_LABOUR: 'bg-purple-100 text-purple-900 border-purple-300',
  WAITING_PRODUCTION: 'bg-teal-100 text-teal-900 border-teal-300',
  WEATHER_DELAY: 'bg-slate-200 text-slate-800 border-slate-300',
  COMPLETED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  DIAGNOSING: 'bg-amber-50 text-amber-900 border-amber-200',
};

function formatStageLabel(rawStage?: string): string {
  if (!rawStage) return 'IN PROGRESS';
  return rawStage.replace(/_/g, ' ').toUpperCase();
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
  const [fitterName, setFitterName] = useState(activeFitter || 'D. Kelly (#4821)');
  const [searchFilter, setSearchFilter] = useState('');
  const [timeScope, setTimeScope] = useState<TimeScope>('CURRENT_EVENT');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  if (!isOpen || !asset) return null;

  const assetNotes = notes.filter((n) => n.asset_id === asset.id);

  // Time-Scope Filtering (Current Breakdown Event vs 7-Day Swing vs All History)
  const scopedNotes = assetNotes.filter((n) => {
    if (timeScope === 'CURRENT_EVENT') {
      if (!asset.down_since) return true;
      return new Date(n.created_at).getTime() >= new Date(asset.down_since).getTime();
    }
    if (timeScope === 'ROSTER_7D') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return new Date(n.created_at).getTime() >= sevenDaysAgo;
    }
    return true;
  });

  // Keyword / Fitter / Stage Search Filter
  const filteredNotes = scopedNotes.filter((n) => {
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
        {/* Header */}
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

        {/* Filter Controls & Roster Scope Pills */}
        <div className="p-3 bg-slate-50/70 border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter notes by keyword, fitter name, or stage..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> Scope:
              </span>
              <button
                type="button"
                onClick={() => setTimeScope('CURRENT_EVENT')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                  timeScope === 'CURRENT_EVENT'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Current Breakdown Event
              </button>
              <button
                type="button"
                onClick={() => setTimeScope('ROSTER_7D')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                  timeScope === 'ROSTER_7D'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                7-Day Swing
              </button>
              <button
                type="button"
                onClick={() => setTimeScope('ALL')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                  timeScope === 'ALL'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                All History ({assetNotes.length})
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-medium">
              Showing {filteredNotes.length} entry/entries
            </span>
          </div>
        </div>

        {/* Scrollable Note Feed */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-white">
          {filteredNotes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No shift notes found matching the selected scope or filter.
            </div>
          ) : (
            filteredNotes.map((n) => {
              const cleanStage = (n.stage || 'IN_PROGRESS').toUpperCase();
              const badgeTheme = STAGE_BADGES[cleanStage] || STAGE_BADGES.IN_PROGRESS;

              return (
                <div key={n.id} className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-600" /> {n.fitter_name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {n.note}
                  </p>

                  <div className="pt-1">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${badgeTheme}`}>
                      STAGE: {formatStageLabel(n.stage)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Progressive Note Input Bar */}
        <form onSubmit={handleAddNote} className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
          <input
            type="text"
            value={fitterName}
            onChange={(e) => setFitterName(e.target.value)}
            className="w-40 bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
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
            className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}