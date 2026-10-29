'use client';

import React, { useState } from 'react';
import { Sparkles, Copy, Check, RefreshCw } from 'lucide-react';
import { Asset, MachineWorkOrder, HistoryNote, ShiftRecord, HandoverLogEntry } from '@/types';


interface AiHandoverDigestProps {
  activeShift: ShiftRecord | null;
  shiftJobs?: any[];
  completedJobs?: any[];
  workOrders?: any[];
  notes?: any;
  logEntries?: HandoverLogEntry[];
  onSummaryGenerated?: (summary: string) => void;
}

export default function AiHandoverDigest({
  activeShift,
  shiftJobs = [],
  completedJobs = [],
  workOrders = [],
  notes = [],
  logEntries = [],
  onSummaryGenerated,
}: AiHandoverDigestProps) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeDown = shiftJobs.filter((a) => a.in_shift);
  const released = completedJobs.length > 0 ? completedJobs : shiftJobs.filter((a) => !a.in_shift && a.actual_up);

  async function handleGenerateDigest() {
    setLoading(true);
    try {
      // Map rich maintenance context per machine so the LLM doesn't guess
      const activePayload = activeDown.map((asset) => {
        const orders = workOrders.filter((w) => w.asset_id === asset.id);
        const assetNotes = notes.filter((n: any) => n.asset_id === asset.id);
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
          recent_notes: assetNotes.slice(-3).map((n: any) => `[${n.fitter_name}]: ${n.note}`),
        };
      });

      // Retrieve saved watch items from localStorage
      let watchItems = [];
      try {
        const savedWatch = localStorage.getItem('mine_cmms_watchlist');
        if (savedWatch) watchItems = JSON.parse(savedWatch);
      } catch {
        console.error('Failed to read watchlist');
      }

      const res = await fetch('/api/ai-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftName: activeShift?.shift_name || 'Current Shift',
          supervisor: activeShift?.supervisor || 'Shift Supervisor',
          activeMachines: activePayload,
          releasedMachines: released.map((r) => ({
            fleet_id: r.fleet_id,
            model: r.make_model,
          })),
          logEntries,
        }),
      });

      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        if (onSummaryGenerated) onSummaryGenerated(data.summary);
      }
    } catch {
      alert('Error generating AI handover summary');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
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
              <p className="text-xs text-slate-500">Synthesizes safety priorities, active breakdowns, and watch items</p>
            </div>
          </div>

        <div className="flex items-center gap-2">
          {summary && (
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
            {loading ? 'Synthesizing Shift...' : summary ? 'Re-generate' : 'Generate Summary'}
          </button>
        </div>
      </div>

      {summary ? (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 leading-relaxed whitespace-pre-wrap">
          {summary}
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