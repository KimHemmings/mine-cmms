'use client';

import React, { useState } from 'react';
import { Sparkles, Copy, Check, RefreshCw } from 'lucide-react';
import { Asset, MachineWorkOrder, HistoryNote, ShiftRecord, HandoverLogEntry, HandoverMachineNote } from '@/types';
import { handoverNotesFor } from '@/utils/handoverNotes';


interface AiHandoverDigestProps {
  activeShift: ShiftRecord | null;
  shiftJobs?: Asset[];
  completedJobs?: Asset[];
  workOrders?: MachineWorkOrder[];
  notes?: HistoryNote[];
  logEntries?: HandoverLogEntry[];
  summaryText?: string;
  machineNotes?: HandoverMachineNote[];
  onSummaryGenerated?: (summary: string, machineNotes: HandoverMachineNote[]) => void;
}

export default function AiHandoverDigest({
  activeShift,
  shiftJobs = [],
  completedJobs = [],
  workOrders = [],
  notes = [],
  logEntries = [],
  summaryText = '',
  machineNotes = [],
  onSummaryGenerated,
}: AiHandoverDigestProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeDown = shiftJobs.filter((a) => a.in_shift && a.status !== 'OPERATIONAL');
  const released = completedJobs;

  async function handleGenerateDigest() {
    setLoading(true);
    try {
      // Map rich maintenance context per machine so the LLM doesn't guess
      const shiftStart = activeShift?.started_at ? new Date(activeShift.started_at).getTime() : null;
      const notesFor = (assetId: string) =>
        notes
          .filter((note) => note.asset_id === assetId && (shiftStart === null || new Date(note.created_at).getTime() >= shiftStart))
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(-12)
          .map((note) => ({
            at: note.created_at,
            by: note.fitter_name,
            note: note.note.slice(0, 300),
          }));

      const activePayload = activeDown.map((asset) => {
        const orders = workOrders.filter((w) => w.asset_id === asset.id && w.status !== 'COMPLETED');
        const hotshots = orders.flatMap((w) => w.parts || []).filter((p) => p.is_special_run);

        return {
          fleet_id: asset.fleet_id,
          model: asset.make_model,
          location: asset.location || 'Workshop',
          priority: asset.priority || 'P3',
          expected_up: asset.expected_up,
          tasks: orders.map((o) => ({
            wo_number: o.wo_number || 'N/A',
            scope: o.task_description,
            stage: o.stage,
            fitter: o.fitter_assigned || 'Unassigned',
          })),
          hotshots: hotshots.map((h) => ({
            part: h.description || h.part_number,
            eta: h.eta,
          })),
          shift_notes: notesFor(asset.id),
        };
      });

      const watchItems = logEntries
        .filter((entry) => entry.category === 'WATCHLIST')
        .map((entry) => ({
          fleet_id: entry.fleet_id,
          details: entry.details,
          action_required: entry.action_required,
        }));

      const res = await fetch('/api/ai-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftName: activeShift?.shift_name || 'Current Shift',
          supervisor: activeShift?.supervisor || 'Shift Supervisor',
          weatherNotes: handoverNotesFor(logEntries, ['WEATHER']),
          safetyNotes: handoverNotesFor(logEntries, ['SAFETY']),
          manningNotes: handoverNotesFor(logEntries, ['MANNING']),
          priorityNotes: handoverNotesFor(logEntries, ['PRIORITY']),
          complianceNotes: handoverNotesFor(logEntries, ['BRAKE_TEST', 'TOOLING']),
          activeMachines: activePayload,
          releasedMachines: released.map((asset) => ({
            fleet_id: asset.fleet_id,
            model: asset.make_model,
            shift_notes: notesFor(asset.id),
          })),
          machinesWithNotes: [...shiftJobs, ...released]
            .filter((asset, index, list) => list.findIndex((item) => item.id === asset.id) === index)
            .map((asset) => ({ fleet_id: asset.fleet_id, shift_notes: notesFor(asset.id) }))
            .filter((asset) => asset.shift_notes.length > 0),
          watchItems,
          logEntries,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.summary) {
        alert(data.error || 'Error generating the handover summary');
        return;
      }
      onSummaryGenerated?.(data.summary, Array.isArray(data.machines) ? data.machines : []);
    } catch {
      alert('Error generating AI handover summary');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    const machineLines = machineNotes.map((note) => `${note.fleetId}. ${note.summary}`).join('\n');
    const text = [summaryText, machineLines].filter(Boolean).join('\n\n');
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Shift Operational Summary</h3>
              <p className="text-xs text-slate-500">A short brief, plus one line on what was written up for each machine this shift</p>
            </div>
          </div>

        <div className="flex items-center gap-2">
          {summaryText && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Digest'}
            </button>
          )}

          <button
            type="button"
            onClick={handleGenerateDigest}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Writing...' : summaryText ? 'Re-generate' : 'Generate summary'}
          </button>
        </div>
      </div>

      {summaryText ? (
        <div className="space-y-3">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
            {summaryText}
          </div>
          {machineNotes.length > 0 && (
            <ul className="text-sm space-y-1">
              {machineNotes.map((note) => (
                <li key={note.fleetId}><strong>{note.fleetId}.</strong> {note.summary}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          <p className="text-xs text-slate-400">
            Click &quot;Generate Summary&quot; to compile all shift logs into an executive handover report.
          </p>
        </div>
      )}
    </div>
  );
}