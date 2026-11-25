'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, RefreshCw, Sparkles } from 'lucide-react';
import { Asset, CrewMember, HistoryNote, HandoverLogEntry, MachineWorkOrder, ShiftRecord } from '@/types';
import {
  fallbackMachineSummaries,
  HandoverAiMachineContext,
  limitMachineBullets,
  normalizeMachineSummaries,
} from '@/utils/handoverMachineSummaries';
import { handoverNotesFor } from '@/utils/handoverNotes';
import { comparePriorityThenUnit, effectivePriority, normalizePriority, priorityBadgeClass } from '@/utils/handoverPriority';

interface AiHandoverDigestProps {
  activeShift: ShiftRecord | null;
  shiftJobs: Asset[];
  completedJobs: Asset[];
  workOrders: MachineWorkOrder[];
  notes: HistoryNote[];
  logEntries: HandoverLogEntry[];
  crew: CrewMember[];
  summaryText: string;
  machineSummaries: Record<string, string[]>;
  generateRequest: number;
  onGeneratingChange: (loading: boolean) => void;
  onMachineSummariesChange: (summaries: Record<string, string[]>) => void;
  onSummaryGenerated: (summary: string, summaries: Record<string, string[]>, offlineFallback: boolean) => void;
}

function isInShift(timestamp: string | null | undefined, shiftStart: number | null) {
  return shiftStart === null || (timestamp ? new Date(timestamp).getTime() >= shiftStart : false);
}

function renderInlineMarkdown(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2).replaceAll('#', '')}</strong>;
    }
    return <React.Fragment key={index}>{part.replaceAll('**', '').replaceAll('#', '')}</React.Fragment>;
  });
}

function ExecutiveBriefing({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  while (lines.length > 0 && /^#{1,6}\s/.test(lines[0])) lines.shift();
  const bullets = lines.filter((line) => /^[-*]\s+/.test(line));
  const otherLines = lines.filter((line) => !/^[-*]\s+/.test(line));

  return (
    <div className="break-inside-avoid space-y-1">
      {bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {bullets.map((line, index) => {
            const content = line.replace(/^[-*]\s+/, '');
            const labeled = content.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
            if (labeled) {
              return (
                <li key={`bullet-${index}`} className="text-sm leading-relaxed">
                  <strong>{labeled[1].replaceAll('#', '')}{labeled[1].endsWith(':') ? '' : ':'}</strong>
                  {labeled[2] ? <> {renderInlineMarkdown(labeled[2])}</> : null}
                </li>
              );
            }

            return (
              <li key={`bullet-${index}`} className="text-sm leading-relaxed">
                {renderInlineMarkdown(content)}
              </li>
            );
          })}
        </ul>
      )}
      {otherLines.map((line, index) => (
        <p key={`line-${index}`} className="text-sm leading-relaxed">
          {renderInlineMarkdown(line.replace(/^#{1,6}\s*/, ''))}
        </p>
      ))}
    </div>
  );
}

export default function AiHandoverDigest({
  activeShift,
  shiftJobs,
  completedJobs,
  workOrders,
  notes,
  logEntries,
  crew,
  summaryText,
  machineSummaries,
  generateRequest,
  onGeneratingChange,
  onMachineSummariesChange,
  onSummaryGenerated,
}: AiHandoverDigestProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usedOfflineFallback, setUsedOfflineFallback] = useState(false);
  const generationLock = useRef(false);
  const handledRequest = useRef(0);
  const machineLabels = new Map([...shiftJobs, ...completedJobs].map((asset) => {
    const jobs = workOrders.filter((order) => order.asset_id === asset.id && (
      order.status === 'OPEN'
      || order.shift_id === activeShift?.id
      || (activeShift?.started_at && order.completed_at && order.completed_at >= activeShift.started_at)
    ));
    return [asset.id, {
      unit: asset.fleet_id,
      model: asset.make_model,
      priority: effectivePriority(asset.priority, jobs.map((order) => order.priority)),
    }] as const;
  }));
  const machineLabel = (machineId: string) => {
    const machine = machineLabels.get(machineId);
    return machine ? `${machine.unit}${machine.model ? ` — ${machine.model}` : ''}` : machineId;
  };

  const handleGenerateDigest = useCallback(async () => {
    if (generationLock.current) return;
    generationLock.current = true;
    setLoading(true);
    onGeneratingChange(true);

    const shiftStart = activeShift?.started_at ? new Date(activeShift.started_at).getTime() : null;
    const activeMachines = shiftJobs.filter((asset) => asset.in_shift && asset.status !== 'OPERATIONAL');
    const uniqueAssets = [...activeMachines, ...completedJobs].filter((asset, index, list) =>
      list.findIndex((item) => item.id === asset.id) === index
    );
    const machines: HandoverAiMachineContext[] = uniqueAssets.map((asset) => {
      const released = completedJobs.some((item) => item.id === asset.id);
      const assetComponents = [...new Set([
        ...(asset.component_systems ?? []),
        asset.component_system,
      ].filter((component): component is string => Boolean(component?.trim())))];
      const orders = workOrders.filter((order) => {
        if (order.asset_id !== asset.id) return false;
        if (order.status === 'OPEN' || order.shift_id === activeShift?.id) return true;
        return shiftStart !== null && isInShift(order.completed_at, shiftStart);
      });
      const assignedCrew = (order: MachineWorkOrder) => {
        const linked = (order.crew ?? [])
          .map((row) => crew.find((person) => person.id === row.crew_member_id)?.display_name)
          .filter((name): name is string => Boolean(name));
        const fitter = order.fitter_assigned?.trim();
        return [...new Set([...linked, ...(fitter && fitter.toLowerCase() !== 'unassigned' ? [fitter] : [])])];
      };
      const jobs: HandoverAiMachineContext['jobs'] = orders.map((order) => ({
        wo_number: order.wo_number,
        title: order.task_description,
        components: order.component_systems?.length ? order.component_systems : assetComponents,
        priority: normalizePriority(order.priority),
        stage: order.stage,
        assigned_crew: assignedCrew(order),
      }));
      if (jobs.length === 0 && asset.shift_task) {
        jobs.push({
          wo_number: asset.work_order_num ?? null,
          title: asset.shift_task,
          components: assetComponents,
          priority: normalizePriority(asset.priority),
          stage: asset.shift_stage || 'IN_PROGRESS',
          assigned_crew: asset.fitter_assigned && asset.fitter_assigned.toLowerCase() !== 'unassigned'
            ? [asset.fitter_assigned]
            : [],
        });
      }

      return {
        machine_id: asset.id,
        fleet_id: asset.fleet_id,
        model: asset.make_model,
        priority: effectivePriority(asset.priority, orders.map((order) => order.priority)),
        expected_up: asset.expected_up,
        status: released ? 'RELEASED' : 'DOWN',
        jobs,
        parts: orders.flatMap((order) => (order.parts ?? []).map((part) => ({
          description: part.description || part.part_number || 'Part',
          part_number: part.part_number ?? null,
          status: part.status,
          eta: part.eta ?? null,
          hotshot: part.is_special_run,
          carrier: part.carrier_details ?? null,
        }))),
        shift_notes: notes
          .filter((note) => note.asset_id === asset.id && isInShift(note.created_at, shiftStart))
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((note) => ({ at: note.created_at, by: note.fitter_name, note: note.note })),
        updates: logEntries
          .filter((entry) => entry.fleet_id?.trim().toUpperCase() === asset.fleet_id.toUpperCase()
            && isInShift(entry.logged_at, shiftStart))
          .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
          .map((entry) => ({
            at: entry.logged_at,
            category: entry.category,
            details: entry.details,
            action_required: entry.action_required ?? null,
          })),
      };
    });

    try {
      const response = await fetch('/api/ai-handover', {
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
          activeMachines: machines.filter((machine) => machine.status === 'DOWN'),
          releasedMachines: machines.filter((machine) => machine.status === 'RELEASED'),
          machines,
          logEntries,
        }),
      });
      if (!response.ok) throw new Error(`Handover summary request failed (${response.status})`);
      const data = await response.json() as { summary?: unknown; summaries?: unknown; offlineFallback?: unknown };
      const summaries = normalizeMachineSummaries(data.summaries, machines);
      const offlineFallback = data.offlineFallback === true;
      setUsedOfflineFallback(offlineFallback);
      onSummaryGenerated(
        typeof data.summary === 'string' && data.summary.trim() ? data.summary : summaryText,
        summaries,
        offlineFallback,
      );
    } catch (error) {
      console.error('[ai-handover] falling back to raw machine notes:', error);
      setUsedOfflineFallback(true);
      onSummaryGenerated(summaryText, fallbackMachineSummaries(machines), true);
    } finally {
      generationLock.current = false;
      setLoading(false);
      onGeneratingChange(false);
    }
  }, [
    activeShift,
    completedJobs,
    crew,
    logEntries,
    notes,
    onGeneratingChange,
    onSummaryGenerated,
    shiftJobs,
    summaryText,
    workOrders,
  ]);

  useEffect(() => {
    if (generateRequest > handledRequest.current) {
      handledRequest.current = generateRequest;
      void handleGenerateDigest();
    }
  }, [generateRequest, handleGenerateDigest]);

  async function handleCopy() {
    const machineLines = Object.entries(machineSummaries)
      .map(([machineId, bullets]) => `${machineLabel(machineId)}\n${bullets.map((bullet) => `- ${bullet}`).join('\n')}`)
      .join('\n');
    const text = [summaryText, machineLines].filter(Boolean).join('\n\n');
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function updateBullet(machineId: string, index: number, value: string) {
    const bullets = [...(machineSummaries[machineId] ?? [])];
    bullets[index] = value;
    onMachineSummariesChange({ ...machineSummaries, [machineId]: bullets });
  }

  function finishEditing(machineId: string) {
    onMachineSummariesChange({
      ...machineSummaries,
      [machineId]: limitMachineBullets(machineSummaries[machineId] ?? []),
    });
  }

  function addBullet(machineId: string) {
    onMachineSummariesChange({
      ...machineSummaries,
      [machineId]: [...(machineSummaries[machineId] ?? []), ''],
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Machine shift notes</h3>
            <p className="text-xs text-slate-500">One or two pit-ready bullets per machine; 25 words maximum.</p>
          </div>
        </div>
        {Object.keys(machineSummaries).length > 0 && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy notes'}
          </button>
        )}
      </div>

      {usedOfflineFallback && (
        <p className="text-xs text-amber-800">Offline fallback: the machine cards are using the shift notes as written.</p>
      )}
      <p className="text-sm text-slate-600">Each machine on the whiteboard shows the overview of this shift’s notes.</p>
      {loading && (
        <p className="flex items-center gap-2 text-xs font-bold text-indigo-700">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Writing machine notes…
        </p>
      )}
    </div>
  );
}
