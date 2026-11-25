'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, FileSpreadsheet, Mic, MicOff, PenLine, Printer, Presentation, RotateCw,
} from 'lucide-react';
import { 
  Asset, 
  MachineWorkOrder, 
  DefectItem, 
  ShiftRecord, 
  HistoryNote, 
  HandoverLogEntry, 
  HandoverLogCategory 
} from '@/types';
import AiHandoverDigest from './handover/AiHandoverDigest';
import ShiftHandoverLog from './handover/ShiftHandoverLog';
import HandoverDocumentView from './handover/HandoverDocumentView';
import HandoverHistory from './handover/HandoverHistory';
import BriefingSlides from './handover/BriefingSlides';
import SafetyBriefingFields from './handover/SafetyBriefingFields';
import OceReportPanel from './handover/OceReportPanel';
import RecordTrail from './training/RecordTrail';
import { formatDateTime } from '@/utils/helpers';
import { formatStartDay, shiftIsPast } from '@/utils/crewStanding';
import { generateHandoverPptx } from '@/utils/handoverPptx';
import { buildHandoverSnapshot, normalizeHandoverDocument } from '@/utils/handoverDocument';
import { HandoverMachineNote, HandoverManning, HandoverSlide, HandoverSnapshot, OceReport, PartsBoardRow, SafetyIncident, SavedHandover } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import IncomingCrewDialog from './crew/IncomingCrewDialog';
import { useCrewData } from './crew/CrewDataContext';
import { siteCover } from '@/utils/crewStanding';
import { IncomingCrewPicker } from './handover/IncomingCrewPicker';
import { inWindow, windowFor } from '@/utils/shiftClock';
import { isWorkshopHandoverMember, workshopHandoverManning, workshopSigners } from '@/utils/workshopHandover';
import { fallbackMachineSummaries, HandoverAiMachineContext } from '@/utils/handoverMachineSummaries';
import { getHandoverCrewsForShift } from '@/utils/rosterCycle';
import { useRosterCycleSettings } from '@/hooks/useRosterCycleSettings';
import { leaveCovers, shiftDateIso } from '@/utils/crewLeave';

function oceText(value: string | null | undefined) {
  if (!value || value.startsWith('data:application/pdf')) return null;
  return value;
}

function oceAttachment(report: OceReport, briefing = report.briefing): HandoverSnapshot['oce'] {
  return {
    fileName: report.file_name,
    storagePath: report.storage_path,
    fileSize: report.file_size ?? null,
    sourceText: oceText(report.source_text),
    dataUrl: report.source_text?.startsWith('data:application/pdf') ? report.source_text : null,
    briefing: briefing ?? { summary: '', hazards: [], incidents: [], restrictions: [], conditions: [] },
  };
}

function attachShiftOce(document: HandoverSnapshot, report: OceReport | null): HandoverSnapshot {
  if (!report || (!report.storage_path && !oceText(report.source_text))) return document;
  return { ...document, oce: oceAttachment(report, report.briefing ?? document.oce?.briefing) };
}
import { exportHandoverPdf, handoverPdfFilename, printHandoverDocument } from '@/utils/exportHandoverPdf';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const LOG_CATEGORIES: HandoverLogCategory[] = [
  'SAFETY', 'WEATHER', 'MANNING', 'WATCHLIST', 'BRAKE_TEST', 'TOOLING', 'PRIORITY',
];

interface HandoverReportTabProps {
  activeShift: ShiftRecord | null;
  shiftJobs: Asset[];
  completedJobs: Asset[];
  workOrders: MachineWorkOrder[];
  defects: DefectItem[];
  notes: HistoryNote[];
  assets: Asset[];
  handoverLog: HandoverLogEntry[];
  loading: boolean;
  onRefresh: () => void;
  onRolloverShift: (nextCrew?: string) => Promise<boolean>;
  readOnly?: boolean;
  accessLevel?: number;
  signedByName?: string | null;
  homeCrew?: string | null;
  coveringCrew?: string | null;
}

function isLogCategory(value: unknown): value is HandoverLogCategory {
  return typeof value === 'string' && LOG_CATEGORIES.includes(value as HandoverLogCategory);
}

function readBrowserLog(storageKey: string): HandoverLogEntry[] {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((entry) => isLogCategory(entry?.category) && entry?.details);
    }
    const legacyWatch = localStorage.getItem('mine_cmms_watchlist');
    if (!legacyWatch) return [];
    const parsed = JSON.parse(legacyWatch);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.issue_description)
      .map((item) => ({
        id: crypto.randomUUID(),
        category: 'WATCHLIST' as const,
        fleet_id: item.fleet_id,
        details: item.issue_description,
        action_required: item.inspection_action || undefined,
        logged_at: new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export default function HandoverReportTab({
  activeShift,
  shiftJobs,
  completedJobs,
  workOrders,
  defects,
  notes,
  assets,
  handoverLog,
  loading,
  onRefresh,
  onRolloverShift,
  readOnly = false,
  accessLevel = 2,
  signedByName = null,
  homeCrew = null,
  coveringCrew = null,
}: HandoverReportTabProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRollover, setShowRollover] = useState(false);
  const [view, setView] = useState<'current' | 'history'>('current');
  const [opened, setOpened] = useState<SavedHandover | null>(null);
  const [handovers, setHandovers] = useState<SavedHandover[]>([]);
  const [slides, setSlides] = useState<HandoverSlide[]>([]);
  const [shiftSummary, setShiftSummary] = useState('');
  const [oceSummary, setOceSummary] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [isRefiningSummary, setIsRefiningSummary] = useState(false);
  const [machineNotes, setMachineNotes] = useState<HandoverMachineNote[]>([]);
  const [machineSummaries, setMachineSummaries] = useState<Record<string, string[]>>({});
  const [aiRefreshRequest, setAiRefreshRequest] = useState(0);
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [safetyFocus, setSafetyFocus] = useState('');
  const [oceReport, setOceReport] = useState<OceReport | null>(null);
  const [boardParts, setBoardParts] = useState<PartsBoardRow[]>([]);
  const importedShift = React.useRef<string | null>(null);
  const slidesLoadedFor = React.useRef<string | null>(null);
  const speechRecognition = React.useRef<SpeechRecognitionLike | null>(null);

  const supabase = React.useMemo(() => createClient(), []);

  useEffect(() => {
    if (!activeShift?.id) return;
    let cancelled = false;
    supabase
      .from('oce_reports')
      .select('id, shift_id, file_name, storage_path, source_text, file_size, briefing, uploaded_at, uploaded_by')
      .eq('shift_id', activeShift.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const row = data as OceReport;
        if (row.storage_path || row.source_text) setOceReport(row);
      });
    return () => {
      cancelled = true;
    };
  }, [activeShift?.id, supabase]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('parts_board')
      .select('id, asset_id, fleet_id, kind, supplier, ordered_on, eta, description, reason, created_by, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled && data) setBoardParts(data as PartsBoardRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);
  const { showToast } = useFeedback();
  const { crew, leave, onShiftIds, authorisations, holdings, supervision } = useCrewData();
  const rosterSettings = useRosterCycleSettings();
  const workshopCrew = crew.filter((member) => isWorkshopHandoverMember(member));
  const cover = siteCover(
    workshopCrew.filter((member) => onShiftIds.has(member.id)),
    supervision,
    authorisations,
    holdings,
    workshopCrew,
  );
  const [incomingOverride, setIncomingOverride] = useState<{ key: string; panel: string } | null>(null);
  const [outgoingId, setOutgoingId] = useState('');
  const [oncomingId, setOncomingId] = useState('');
  const activeShiftDate = shiftDateIso(activeShift?.shift_date);
  const shiftId = activeShift?.id ?? null;
  const shiftType = activeShift?.shift_type;
  const rosterCrewPlan = shiftType === 'DAY' || shiftType === 'NIGHT'
    ? getHandoverCrewsForShift(
        shiftType,
        activeShiftDate,
        rosterSettings.roster_anchor_date,
        rosterSettings.crew_rotation_order,
      )
    : null;
  const rosterContextKey = [
    shiftId,
    activeShiftDate,
    shiftType,
    rosterSettings.roster_anchor_date,
    rosterSettings.crew_rotation_order.join(','),
  ].join(':');
  const incomingPanel = incomingOverride?.key === rosterContextKey
    ? incomingOverride.panel
    : rosterCrewPlan?.incomingCrew ?? null;
  const outgoingCrew = rosterCrewPlan?.outgoingCrew ?? null;
  const incomingDate = rosterCrewPlan?.incomingDate ?? activeShiftDate;
  const supervisorName = activeShift?.supervisor || 'Workshop Management';
  const outgoingSignerName = signedByName?.trim() || '';
  const reliefSignoffSuffix = coveringCrew && homeCrew && coveringCrew !== homeCrew
    ? ` (Relief Coverage — Home: ${homeCrew})`
    : '';
  const signedByLabel = (name: string) => `${name}${reliefSignoffSuffix}`;
  const handedOver = shiftJobs.filter((asset) => asset.in_shift && asset.status !== 'OPERATIONAL');
  const currentSaved = handovers.find((handover) => handover.shift_id === activeShift?.id) ?? null;
  const currentLocked = Boolean(currentSaved?.outgoing_signed_at);
  const pendingPrevious = accessLevel >= 3 && !readOnly
    ? handovers.find((handover) => Boolean(handover.outgoing_signed_at) && !handover.oncoming_signed_at)
    : undefined;

  const bounds = windowFor('12h');
  const inReport = (iso?: string | null) => inWindow(iso, bounds.start, bounds.end);
  const windowedLog = handoverLog.filter((entry) => inReport(entry.logged_at) && entry.department !== 'production' && entry.department !== 'training');
  const shiftLog = handoverLog.filter((entry) =>
    entry.department !== 'production'
    && entry.department !== 'training'
    && (!activeShift?.started_at || entry.logged_at >= activeShift.started_at)
  );
  const windowedReleased = completedJobs.filter((asset) => inReport(asset.actual_up));
  const incomingCrewForManning = workshopCrew
    .filter((member) => member.panel === incomingPanel)
    .map((member) => {
      const leaveRow = leave.find((row) => row.crew_member_id === member.id && leaveCovers(row, incomingDate, true));
      return {
        ...member,
        away: leaveRow ? true : member.on_leave ? false : member.away,
        on_leave: Boolean(leaveRow),
        leave_type: leaveRow?.leave_type ?? null,
      };
    });
  const manning = workshopHandoverManning(incomingCrewForManning, incomingPanel, workOrders, assets);
  const signers = useMemo(() => workshopSigners(crew), [crew]);
  const outgoingSigner = signers.find((person) => person.id === outgoingId)?.name ?? null;
  const oncomingSigner = signers.find((person) => person.id === oncomingId)?.name ?? null;
  const reliefSuffix = coveringCrew && homeCrew && coveringCrew !== homeCrew
    ? ` (Relief Coverage — Home: ${homeCrew})`
    : '';
  const manningRecord: HandoverManning = {
    panel: manning.panel,
    onShift: manning.onShift.map((person) => person.name),
    away: manning.away.map((person) => person.name),
    overtime: manning.overtime.map((person) => person.name),
    unallocated: manning.unallocated.map((person) => person.name),
    assigned: manning.assigned.map((person) => `${person.name} — ${person.detail}`),
    outgoing: outgoingSigner ? `${outgoingSigner}${reliefSuffix}` : null,
    oncoming: oncomingSigner ? `${oncomingSigner}${reliefSuffix}` : null,
  };
  const fallbackMachines: HandoverAiMachineContext[] = [...handedOver, ...windowedReleased]
    .filter((asset, index, list) => list.findIndex((candidate) => candidate.id === asset.id) === index)
    .map((asset) => {
      const released = windowedReleased.some((candidate) => candidate.id === asset.id);
      return {
        machine_id: asset.id,
        fleet_id: asset.fleet_id,
        model: asset.make_model,
        priority: asset.priority ?? 'P3',
        expected_up: asset.expected_up,
        status: released ? 'RELEASED' : 'DOWN',
        jobs: [],
        parts: [],
        shift_notes: notes
          .filter((note) => note.asset_id === asset.id
            && (!activeShift?.started_at || note.created_at >= activeShift.started_at))
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((note) => ({ at: note.created_at, by: note.fitter_name ?? '', note: note.note })),
        updates: shiftLog
          .filter((entry) => entry.fleet_id?.trim().toUpperCase() === asset.fleet_id.toUpperCase())
          .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
          .map((entry) => ({
            at: entry.logged_at,
            category: entry.category,
            details: entry.details,
            action_required: entry.action_required ?? null,
          })),
      };
    });
  const fallbackSummaries = fallbackMachineSummaries(fallbackMachines);
  const populatedMachineSummaries = Object.fromEntries(
    fallbackMachines.map(({ machine_id }) => [
      machine_id,
      machineSummaries[machine_id]?.length ? machineSummaries[machine_id] : fallbackSummaries[machine_id],
    ]),
  );
  const liveSnapshot = buildHandoverSnapshot({
    assets,
    handedOver,
    released: windowedReleased,
    workOrders,
    defects,
    log: shiftLog,
    notes,
    shiftId: activeShift?.id ?? null,
    shiftStartedAt: activeShift?.started_at ?? null,
    summary: shiftSummary,
    oceSummary,
    outgoingCrew,
    incomingCrew: incomingPanel,
    machineNotes,
    machine_summaries: populatedMachineSummaries,
    customSlides: slides,
    crew: incomingCrewForManning,
    incomingPanel,
    manning: manningRecord,
    safetyIncidents: incidents,
    safetyFocus,
    oce: oceReport && (oceReport.storage_path || oceText(oceReport.source_text))
      ? oceAttachment(oceReport)
      : null,
    inTraining: cover.inTraining,
    ertOnSite: cover.ertOnSite,
    assessorsOnSite: cover.assessorsOnSite,
  });
  if (boardParts.length > 0) {
    liveSnapshot.parts = boardParts.map((row) => ({
      fleetId: row.fleet_id,
      woNumber: null,
      description: row.description,
      partNumber: null,
      po: row.reason,
      status: row.kind,
      eta: row.eta,
      hotshot: row.kind === 'hotshot',
      carrier: row.supplier,
      kind: row.kind,
      orderedOn: row.ordered_on,
      reason: row.reason,
    }));
  }

  const loadHandovers = React.useCallback(async () => {
    const optionalColumns = [
      'outgoing_signed_by',
      'outgoing_signed_at',
      'oncoming_signed_by',
      'oncoming_signed_at',
      'shift_summary',
      'oce_summary',
    ];
    const baseColumns = ['id', 'shift_id', 'shift_name', 'shift_date', 'shift_type', 'crew', 'supervisor', 'document', 'saved_at', 'saved_by'];
    let columns = [...baseColumns, ...optionalColumns];
    let result = await supabase
      .from('shift_handovers')
      .select(columns.join(', '))
      .order('saved_at', { ascending: false });
    while (
      result.error
      && (result.error.code === 'PGRST204' || result.error.code === '42703')
    ) {
      const missingColumn = optionalColumns.find((column) =>
        columns.includes(column) && result.error?.message.includes(column));
      if (!missingColumn) break;
      columns = columns.filter((column) => column !== missingColumn);
      result = await supabase
        .from('shift_handovers')
        .select(columns.join(', '))
        .order('saved_at', { ascending: false });
    }
    const data = result.data as SavedHandover[] | null;
    const error = result.error;
    if (error) {
      console.error('Handover history load failed:', error.message);
      return;
    }
    const rows = ((data ?? []) as SavedHandover[]).map((handover) => {
      const document = normalizeHandoverDocument(handover.document);
      const shiftSummary = handover.shift_summary ?? document.shift_summary ?? document.summary;
      const oceSummary = handover.oce_summary ?? document.oce_summary ?? document.oce?.briefing.summary ?? null;
      return {
        ...handover,
        outgoing_signed_by: handover.outgoing_signed_by ?? null,
        outgoing_signed_at: handover.outgoing_signed_at ?? null,
        oncoming_signed_by: handover.oncoming_signed_by ?? null,
        oncoming_signed_at: handover.oncoming_signed_at ?? null,
        shift_summary: shiftSummary,
        oce_summary: oceSummary,
        document: {
          ...document,
          summary: shiftSummary,
          shift_summary: shiftSummary,
          oce_summary: oceSummary,
          oce: document.oce
            ? { ...document.oce, briefing: { ...document.oce.briefing, summary: oceSummary ?? '' } }
            : null,
        },
      };
    });
    setHandovers(rows);
    const savedForShift = rows.find((handover) => handover.shift_id === activeShift?.id);
    if (savedForShift && slidesLoadedFor.current !== savedForShift.id) {
      slidesLoadedFor.current = savedForShift.id;
      setSlides(savedForShift.document.customSlides ?? []);
      setShiftSummary(savedForShift.shift_summary ?? savedForShift.document.summary ?? '');
      setOceSummary(savedForShift.oce_summary ?? savedForShift.document.oce?.briefing.summary ?? '');
      setMachineNotes(savedForShift.document.machineNotes ?? []);
      setMachineSummaries(savedForShift.document.machine_summaries ?? {});
      setIncidents(savedForShift.document.safetyIncidents ?? []);
      setSafetyFocus(savedForShift.document.safetyFocus ?? '');
    }
  }, [supabase, activeShift?.id]);

  useEffect(() => {
    const channel = supabase
      .channel('shift-handovers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_handovers' }, () => {
        void loadHandovers();
      })
      .subscribe();
    const firstLoad = setTimeout(() => { void loadHandovers(); }, 0);
    return () => {
      clearTimeout(firstLoad);
      supabase.removeChannel(channel);
    };
  }, [loadHandovers, supabase]);

  const [trackedRosterShiftKey, setTrackedRosterShiftKey] = useState(`${shiftId}:${activeShiftDate}:${shiftType}`);
  const rosterShiftKey = `${shiftId}:${activeShiftDate}:${shiftType}`;
  if (rosterShiftKey !== trackedRosterShiftKey) {
    setTrackedRosterShiftKey(rosterShiftKey);
    setIncomingOverride(null);
    setOutgoingId('');
    setOncomingId('');
    setShiftSummary('');
    setOceSummary('');
    setMachineNotes([]);
    setMachineSummaries({});
  }

  const saveHandover = async () => {
    if (accessLevel < 3 || readOnly) {
      alert('A Level 3+ supervisor must save the handover.');
      return false;
    }
    if (currentLocked) {
      return undoOutgoingSignature();
    }
    if (!activeShift?.id) {
      alert('There is no active shift to save.');
      return false;
    }
    if (!outgoingSignerName) {
      alert('Your supervisor name is not available to sign the handover.');
      return false;
    }
    setSaving(true);
    const { error } = await supabase.from('shift_handovers').upsert(
      {
        shift_id: activeShift.id,
        shift_name: activeShift.shift_name,
        shift_date: activeShift.shift_date,
        shift_type: activeShift.shift_type,
        crew: outgoingCrew ?? activeShift.crew,
        supervisor: supervisorName,
        document: liveSnapshot,
        shift_summary: shiftSummary.trim() || null,
        oce_summary: oceSummary.trim() || null,
        outgoing_signed_by: signedByLabel(outgoingSignerName),
        outgoing_signed_at: new Date().toISOString(),
      },
      { onConflict: 'shift_id' }
    );
    setSaving(false);
    if (error) {
      alert(`Couldn't save the handover: ${error.message}`);
      return false;
    }
    showToast({ message: `Electronically signed by ${signedByLabel(outgoingSignerName)}` });
    await loadHandovers();
    return true;
  };

  const undoOutgoingSignature = async (handover: SavedHandover | null = currentSaved) => {
    if (accessLevel < 3 || readOnly || !handover?.id) return false;
    setSaving(true);
    const { error } = await supabase
      .from('shift_handovers')
      .update({
        outgoing_signed_by: null,
        outgoing_signed_at: null,
        oncoming_signed_by: null,
        oncoming_signed_at: null,
      })
      .eq('id', handover.id)
      .not('outgoing_signed_at', 'is', null);
    setSaving(false);
    if (error) {
      alert(`Couldn't remove the signature: ${error.message}`);
      return false;
    }
    setOpened((current) => current?.id === handover.id
      ? { ...current, outgoing_signed_by: null, outgoing_signed_at: null, oncoming_signed_by: null, oncoming_signed_at: null }
      : current);
    showToast({ message: 'Signature removed' });
    await loadHandovers();
    return true;
  };

  const toggleDictation = () => {
    if (isDictating) {
      speechRecognition.current?.stop();
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = 'en-AU';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (!transcript) return;
      setShiftSummary((current) => {
        const existing = current.trimEnd();
        return `${existing}${existing && !/\s$/.test(existing) ? ' ' : ''}${transcript}`;
      });
    };
    recognition.onerror = () => {
      setIsDictating(false);
      showToast({ message: 'Voice dictation stopped. Check microphone access and try again.', tone: 'error' });
    };
    recognition.onend = () => setIsDictating(false);
    speechRecognition.current = recognition;
    try {
      recognition.start();
      setIsDictating(true);
    } catch (error) {
      speechRecognition.current = null;
      console.error('Voice dictation failed to start:', error);
      showToast({ message: 'Could not start voice dictation.', tone: 'error' });
    }
  };

  const refineShiftSummary = async () => {
    if (!shiftSummary.trim()) return;
    setIsRefiningSummary(true);
    try {
      const response = await fetch('/api/refine-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: shiftSummary }),
      });
      const result = await response.json() as { text?: string; error?: string };
      if (!response.ok || !result.text) {
        showToast({ message: result.error || 'Could not refine the shift summary.', tone: 'error' });
        return;
      }
      setShiftSummary(result.text);
      showToast({ message: 'Shift summary refined' });
    } catch (error) {
      console.error('Shift summary refinement failed:', error);
      showToast({ message: 'Could not refine the shift summary.', tone: 'error' });
    } finally {
      setIsRefiningSummary(false);
    }
  };

  React.useEffect(() => () => {
    const recognition = speechRecognition.current;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(
      () => setSpeechAvailable(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    speechRecognition.current?.stop();
  }, [rosterShiftKey]);

  const exportBriefing = async (handover: { shiftName: string; shiftDate: string | null; crew: string | null; supervisor: string | null; document: typeof liveSnapshot }) => {
    setIsExporting(true);
    try {
      await generateHandoverPptx({
        shiftName: handover.shiftName,
        shiftDate: handover.shiftDate,
        crew: handover.crew,
        supervisor: handover.supervisor,
        document: handover.document,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // One-time copy of a log that was only saved in this browser.
  useEffect(() => {
    const shiftId = activeShift?.id;
    if (!shiftId || loading || importedShift.current === shiftId) return;
    importedShift.current = shiftId;

    const storageKey = `mine_cmms_handover_log_${shiftId}`;
    if (handoverLog.length > 0) {
      localStorage.removeItem(storageKey);
      return;
    }

    const imported = readBrowserLog(storageKey);
    if (imported.length === 0) return;

    supabase
      .from('handover_log_entries')
      .insert(
        imported.map((entry) => ({
          shift_id: shiftId,
          category: entry.category,
          fleet_id: entry.fleet_id || null,
          details: entry.details.trim(),
          action_required: entry.action_required?.trim() || null,
        }))
      )
      .then(({ error }) => {
        if (error) {
          importedShift.current = null;
          console.error('Handover log import failed:', error.message);
          return;
        }
        localStorage.removeItem(storageKey);
        localStorage.removeItem('mine_cmms_watchlist');
        onRefresh();
      });
  }, [activeShift?.id, handoverLog.length, loading, onRefresh, supabase]);

  const handleAddLogEntry = async (entry: Omit<HandoverLogEntry, 'id' | 'logged_at'>) => {
    if (!activeShift?.id) {
      alert('There is no active shift to log against.');
      return false;
    }
    const { error } = await supabase.from('handover_log_entries').insert({
      shift_id: activeShift.id,
      category: entry.category,
      fleet_id: entry.fleet_id || null,
      details: entry.details.trim(),
      action_required: entry.action_required?.trim() || null,
    });
    if (error) {
      alert(`Couldn't save that entry: ${error.message}`);
      return false;
    }
    showToast({ message: 'Handover entry saved' });
    onRefresh();
    return true;
  };

  const handleUpdateCategory = async (id: string, newCategory: HandoverLogCategory) => {
    const { error } = await supabase.from('handover_log_entries').update({ category: newCategory }).eq('id', id);
    if (error) return alert(`Couldn't update that entry: ${error.message}`);
    onRefresh();
  };

  const handleDeleteLogEntry = async (id: string) => {
    const { error } = await supabase.from('handover_log_entries').delete().eq('id', id);
    if (error) return alert(`Couldn't remove that entry: ${error.message}`);
    showToast({ message: 'Entry removed' });
    onRefresh();
  };

  const createDowntime = async (assetId: string, reason: string) => {
    if (!activeShift?.id || readOnly || accessLevel < 3) return false;
    const task = reason.trim();
    if (!assetId || !task) return false;
    await supabase.from('machine_work_orders').update({ is_main_event: false }).eq('asset_id', assetId).eq('is_main_event', true);
    const { error } = await supabase.from('machine_work_orders').insert({
      asset_id: assetId,
      shift_id: activeShift.id,
      order_type: 'UNPLANNED',
      task_description: task,
      component_systems: ['General'],
      fitter_assigned: 'Unassigned',
      stage: 'IN_PROGRESS',
      status: 'OPEN',
      is_main_event: true,
      takes_machine_down: true,
    });
    if (error) {
      alert(`Couldn't add that downtime event: ${error.message}`);
      return false;
    }
    const back = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    await supabase.from('assets').update({
      in_shift: true,
      status: 'DOWN_UNPLANNED',
      priority: 'P3',
      down_since: new Date().toISOString(),
      expected_up: back,
    }).eq('id', assetId);
    showToast({ message: 'Downtime event is on the whiteboard' });
    onRefresh();
    return true;
  };

  const handleFinalizeAndRoll = async (nextCrew: string) => {
    if (accessLevel < 3 || readOnly) {
      alert('A Level 3+ supervisor must finish and sign off this shift.');
      return;
    }
    if (!currentSaved?.outgoing_signed_at) {
      if (!activeShift?.id) {
        alert('There is no active shift to finish.');
        return;
      }
      if (!outgoingSignerName) {
        alert('Your supervisor name is not available for statutory sign-off.');
        return;
      }
      setSaving(true);
      const signedAt = new Date().toISOString();
      const { error } = await supabase.from('shift_handovers').upsert(
        {
          shift_id: activeShift.id,
          shift_name: activeShift.shift_name,
          shift_date: activeShift.shift_date,
          shift_type: activeShift.shift_type,
          crew: outgoingCrew ?? activeShift.crew,
          supervisor: supervisorName,
          document: liveSnapshot,
          shift_summary: shiftSummary.trim() || null,
          oce_summary: oceSummary.trim() || null,
          outgoing_signed_by: signedByLabel(outgoingSignerName),
          outgoing_signed_at: signedAt,
        },
        { onConflict: 'shift_id' },
      );
      setSaving(false);
      if (error) {
        alert(`Couldn't sign off the handover: ${error.message}`);
        return;
      }
      await loadHandovers();
    }
    const ok = await onRolloverShift(nextCrew);
    if (ok) setShowRollover(false);
  };

  const acknowledgeOncoming = async (handover: SavedHandover) => {
    if (accessLevel < 3 || readOnly) return;
    if (handover.oncoming_signed_at) {
      const { error } = await supabase
        .from('shift_handovers')
        .update({ oncoming_signed_by: null, oncoming_signed_at: null })
        .eq('id', handover.id)
        .not('oncoming_signed_at', 'is', null);
      if (error) {
        alert(`Couldn't remove the acknowledgement: ${error.message}`);
        return;
      }
      setHandovers((current) => current.map((item) => item.id === handover.id ? { ...item, oncoming_signed_by: null, oncoming_signed_at: null } : item));
      setOpened((current) => current?.id === handover.id ? { ...current, oncoming_signed_by: null, oncoming_signed_at: null } : current);
      showToast({ message: 'Acknowledgement removed' });
      await loadHandovers();
      return;
    }
    if (!outgoingSignerName) {
      alert('Your supervisor name is not available for statutory sign-off.');
      return;
    }
    const signedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('shift_handovers')
      .update({
        oncoming_signed_by: signedByLabel(outgoingSignerName),
        oncoming_signed_at: signedAt,
      })
      .eq('id', handover.id)
      .not('outgoing_signed_at', 'is', null)
      .is('oncoming_signed_at', null)
      .select('id')
      .maybeSingle();
    if (error) {
      alert(`Couldn't acknowledge the previous handover: ${error.message}`);
      return;
    }
    if (!data) {
      alert('This handover has already been acknowledged.');
      await loadHandovers();
      return;
    }
    const signedHandover = {
      ...handover,
      oncoming_signed_by: signedByLabel(outgoingSignerName),
      oncoming_signed_at: signedAt,
    };
    setHandovers((current) => current.map((item) => item.id === handover.id ? signedHandover : item));
    setOpened(signedHandover);
    showToast({ message: 'Oncoming handover acknowledged' });
    await loadHandovers();
  };

  const handleIncomingCrewOverride = (panel: string | null) => {
    setIncomingOverride(panel ? { key: rosterContextKey, panel } : null);
  };

  const openSavedHandover = async (handover: SavedHandover) => {
    const { data } = await supabase
      .from('oce_reports')
      .select('file_name, storage_path, source_text, file_size, briefing')
      .eq('shift_id', handover.shift_id)
      .maybeSingle();
    const row = data as OceReport | null;
    if (!row || (!row.storage_path && !oceText(row.source_text))) {
      setOpened(handover);
      return;
    }
    setOpened({
      ...handover,
      document: {
        ...handover.document,
        oce: oceAttachment(row, row.briefing ?? handover.document.oce?.briefing),
      },
    });
  };

  const printModel = opened
    ? {
        shiftName: opened.shift_name,
        shiftDate: opened.shift_date,
        crew: opened.crew,
        supervisor: opened.supervisor,
        savedAt: opened.saved_at,
        savedBy: opened.saved_by,
        document: opened.document,
        outgoingSignedBy: opened.outgoing_signed_by,
        outgoingSignedAt: opened.outgoing_signed_at,
        oncomingSignedBy: opened.oncoming_signed_by,
        oncomingSignedAt: opened.oncoming_signed_at,
      }
    : {
        shiftName: activeShift?.shift_name || 'Active shift',
        shiftDate: activeShift?.shift_date ?? null,
        crew: outgoingCrew ?? activeShift?.crew ?? null,
        supervisor: supervisorName,
        savedAt: currentSaved?.saved_at ?? null,
        savedBy: currentSaved?.saved_by ?? null,
        document: attachShiftOce(currentLocked && currentSaved ? currentSaved.document : liveSnapshot, oceReport),
        outgoingSignedBy: currentSaved?.outgoing_signed_by ?? null,
        outgoingSignedAt: currentSaved?.outgoing_signed_at ?? null,
        oncomingSignedBy: currentSaved?.oncoming_signed_by ?? null,
        oncomingSignedAt: currentSaved?.oncoming_signed_at ?? null,
      };

  const actionClass = 'min-h-11 px-4 rounded-xl text-sm font-bold flex items-center gap-1.5 disabled:opacity-50';
  const returnToCurrentShift = () => {
    setOpened(null);
    setView('current');
  };
  const saveHandoverPdf = async () => {
    setIsSavingPdf(true);
    try {
      await exportHandoverPdf({
        shift_name: printModel.shiftName,
        shift_date: printModel.shiftDate,
        crew: printModel.crew,
        supervisor: printModel.supervisor,
        document: printModel.document,
        outgoing_signed_by: printModel.outgoingSignedBy,
        outgoing_signed_at: printModel.outgoingSignedAt,
        oncoming_signed_by: printModel.oncomingSignedBy,
        oncoming_signed_at: printModel.oncomingSignedAt,
      });
    } catch (error) {
      console.error('Handover PDF export failed:', error);
      alert('Could not create the handover PDF. Please try again.');
    } finally {
      setIsSavingPdf(false);
    }
  };
  const printHandover = () => {
    const printTitle = handoverPdfFilename({
      shift_name: printModel.shiftName,
      shift_date: printModel.shiftDate,
      crew: printModel.crew,
    });
    try {
      printHandoverDocument(printTitle);
    } catch (error) {
      console.error('Handover print failed:', error);
      alert('Could not open the print dialog.');
    }
  };

  return (
    <div className="font-sans">
      <div className="hidden print:block">
        <HandoverDocumentView {...printModel} />
      </div>

      {view === 'current' && !opened && pendingPrevious && (
        <SignoffAlert
          title={`Previous Handover Ready (${pendingPrevious.crew ?? pendingPrevious.document.outgoingCrew ?? 'Outgoing Crew'} · ${pendingPrevious.shift_name} · Signed by ${pendingPrevious.outgoing_signed_by ?? 'Supervisor'})`}
          action="Review & Sign Oncoming"
          onClick={() => {
            void openSavedHandover(pendingPrevious);
            setView('history');
          }}
        />
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:hidden">
      
      {/* Handover Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-200 gap-4 print:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-black text-slate-900">Shift handover</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm text-slate-600">
              <strong>{activeShift?.shift_name}{(outgoingCrew ?? activeShift?.crew) ? ` · ${outgoingCrew ?? activeShift?.crew}` : ''}</strong>
              {' · '}{supervisorName}
              {currentSaved ? ` · Last saved ${formatDateTime(currentSaved.saved_at)}` : ' · Not saved yet'}
            </p>
            {currentLocked || readOnly ? (
              <p className="text-sm font-bold text-slate-700">
                Incoming: <span className="font-black text-slate-900">{incomingPanel ?? 'Crew not matched'} - {rosterCrewPlan?.incomingShiftType === 'NIGHT' ? 'Night' : 'Day'} Shift</span>
              </p>
            ) : (
              <IncomingCrewPicker
                panel={incomingPanel}
                shiftType={rosterCrewPlan?.incomingShiftType ?? null}
                onChange={handleIncomingCrewOverride}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(view === 'history' || opened) && (
            <button type="button" onClick={returnToCurrentShift} className={`${actionClass} bg-white border border-slate-300 text-slate-800`}>
              <ArrowLeft className="w-4 h-4" /> Back to Current Shift
            </button>
          )}
          <button type="button" onClick={() => { setOpened(null); setView('history'); }} className={`${actionClass} ${view === 'history' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>
            Past handovers ({handovers.length})
          </button>
          {accessLevel >= 3 && (view === 'current' || opened) && (
            <button type="button" onClick={printHandover} className={`${actionClass} bg-slate-900 text-white`}>
              <Printer className="w-4 h-4" /> Print Handover
            </button>
          )}
          {(view === 'current' || opened) && (
            <button type="button" onClick={() => void saveHandoverPdf()} disabled={isSavingPdf} className={`${actionClass} bg-emerald-700 text-white`}>
              {isSavingPdf ? 'Saving PDF...' : 'Save PDF'}
            </button>
          )}
        </div>
      </div>

      {currentLocked && currentSaved && (
        <div className="mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-900">
          Outgoing Signed Off by {currentSaved.outgoing_signed_by ?? 'Supervisor'} · {formatDateTime(currentSaved.outgoing_signed_at)}
        </div>
      )}

      {view === 'current' && !opened && !readOnly && (
        <div className="sticky top-0 z-10 bg-white py-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {accessLevel >= 3 && <button type="button" onClick={() => void saveHandover()} disabled={saving} className={`${actionClass} ${currentLocked ? 'border border-slate-900 bg-white text-slate-900' : 'bg-emerald-600 text-white'}`}>
              {saving ? 'Saving...' : currentLocked ? 'Undo signature' : 'Save and sign'}
            </button>}
            {accessLevel >= 3 && (
              <button
                type="button"
                onClick={() => setShowRollover(true)}
                disabled={saving}
                className={`${actionClass} border-2 border-slate-900 bg-white text-slate-900`}
              >
                <RotateCw className="w-4 h-4" /> {currentLocked ? 'Complete shift rollover' : 'Finish shift'}
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600">
            {currentLocked
              ? 'Click Undo signature, or the signed line, to take the signature off.'
              : accessLevel >= 3
                ? 'Save and sign records you as the outgoing supervisor, with the time.'
                : 'A Level 3+ supervisor must save and sign this handover.'}
          </p>
        </div>
      )}
      {opened && (
      <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpened(null)} className={`${actionClass} bg-white border border-slate-300 text-slate-800`}>
              Back to history
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => exportBriefing({
                shiftName: opened.shift_name,
                shiftDate: opened.shift_date,
                crew: opened.crew,
                supervisor: opened.supervisor,
                document: opened.document,
              })}
              className={`${actionClass} bg-amber-600 text-white`}
            >
              <Presentation className="w-4 h-4" /> {isExporting ? 'Building...' : 'Crew briefing'}
            </button>
      </div>
      )}

      {view === 'history' && !opened && (
        <div className="mt-4 space-y-4">
          <RecordTrail title="Earlier saves of this handover" tables={['shift_handovers']} />
          <HandoverHistory handovers={handovers} activeShiftId={activeShift?.id} onOpen={(handover) => { void openSavedHandover(handover); }} />
        </div>
      )}

      {opened && (
        <div className="mt-4">
          {accessLevel >= 3 && !readOnly && opened.outgoing_signed_at && !opened.oncoming_signed_at && (
            <SignoffAlert
              title={`Previous Handover Ready (${opened.crew ?? opened.document.outgoingCrew ?? 'Outgoing Crew'} · ${opened.shift_name} · Signed by ${opened.outgoing_signed_by ?? 'Supervisor'})`}
              action="Acknowledge & Sign Oncoming"
              onClick={() => void acknowledgeOncoming(opened)}
            />
          )}
          <HandoverDocumentView
            {...printModel}
            canAcknowledge={Boolean(opened.outgoing_signed_at && accessLevel >= 3 && !readOnly)}
            onAcknowledge={() => { void acknowledgeOncoming(opened); }}
            onUndoOutgoing={opened.outgoing_signed_at && accessLevel >= 3 && !readOnly ? () => { void undoOutgoingSignature(opened); } : undefined}
          />
        </div>
      )}

      {view === 'current' && !opened && (
        <>
          {!currentLocked && !readOnly && <details className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-white shadow-sm">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 bg-slate-900 px-4 py-3 text-sm font-black text-white">
              <Presentation className="h-4 w-4" />
              Make the briefing
            </summary>
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => exportBriefing({
                    shiftName: activeShift?.shift_name || 'Active shift',
                    shiftDate: activeShift?.shift_date ?? null,
                    crew: outgoingCrew ?? activeShift?.crew ?? null,
                    supervisor: supervisorName,
                    document: liveSnapshot,
                  })}
                  className={`${actionClass} bg-amber-600 text-white`}
                >
                  <Presentation className="w-4 h-4" /> {isExporting ? 'Building...' : incomingPanel ? `Briefing for ${incomingPanel}` : 'Crew briefing'}
                </button>
              </div>
              <BriefingSlides slides={slides} onChange={setSlides} />
            </div>
          </details>}
          {!currentLocked && !readOnly && shiftIsPast(activeShift?.shift_date) && (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-950">
                This shift is still {formatStartDay(activeShift?.shift_date ?? '')}. Save the handover, then finish it so the next crew can start.
              </p>
            </div>
          )}
          <div className="mt-6">
            <HandoverDocumentView
              shiftName={activeShift?.shift_name || 'Active shift'}
              shiftDate={activeShift?.shift_date ?? null}
              crew={outgoingCrew ?? activeShift?.crew ?? null}
              supervisor={supervisorName}
              savedAt={currentSaved?.saved_at}
              savedBy={currentSaved?.saved_by}
              document={attachShiftOce(currentLocked && currentSaved ? currentSaved.document : liveSnapshot, oceReport)}
              emptyCrewMessage="Choose the crew coming on. Their names and current jobs will show here."
              isLivePreview={true}
              outgoingSignedBy={currentSaved?.outgoing_signed_by ?? null}
              outgoingSignedAt={currentSaved?.outgoing_signed_at ?? null}
              oncomingSignedBy={currentSaved?.oncoming_signed_by ?? null}
              oncomingSignedAt={currentSaved?.oncoming_signed_at ?? null}
              canAcknowledge={Boolean(currentLocked && currentSaved && accessLevel >= 3 && !readOnly)}
              onAcknowledge={() => { if (currentSaved) void acknowledgeOncoming(currentSaved); }}
              onUndoOutgoing={currentLocked && accessLevel >= 3 && !readOnly ? () => { void undoOutgoingSignature(); } : undefined}
              summaryControls={!currentLocked && !readOnly ? (
                <div className="space-y-3">
                  <textarea
                    value={shiftSummary}
                    onChange={(event) => setShiftSummary(event.target.value)}
                    rows={4}
                    placeholder="Dictate or type the shift. Include the safety share and anything the next crew must know."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed"
                  />
                  <div className="flex flex-wrap gap-2">
                    {speechAvailable && (
                      <button
                        type="button"
                        onClick={toggleDictation}
                        className={`${actionClass} ${isDictating ? 'animate-pulse bg-rose-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
                      >
                        {isDictating ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        {isDictating ? 'Listening... · Stop dictating' : 'Dictate'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void refineShiftSummary()}
                      disabled={!shiftSummary.trim() || isRefiningSummary}
                      className={`${actionClass} border border-slate-200 bg-white text-slate-700`}
                    >
                      <PenLine className="h-4 w-4" />
                      {isRefiningSummary ? 'Refining...' : 'Refine notes'}
                    </button>
                  </div>
                  <SafetyBriefingFields incidents={incidents} focus={safetyFocus} onIncidents={setIncidents} onFocus={setSafetyFocus} />
                </div>
              ) : null}
              oceControls={!currentLocked && !readOnly ? (
                <OceReportPanel
                  shiftId={activeShift?.id ?? null}
                  onChange={setOceReport}
                  locked={currentLocked || readOnly}
                />
              ) : null}
            />
          </div>

          {!currentLocked && <div className="mt-6 print:hidden">
            <ShiftHandoverLog
              readOnly={readOnly || currentLocked}
              shiftDate={activeShift?.shift_date ?? null}
              shiftName={activeShift?.shift_name ?? null}
              department="workshop"
              entries={windowedLog}
              onAddEntry={handleAddLogEntry}
              onUpdateCategory={handleUpdateCategory}
              onDeleteEntry={handleDeleteLogEntry}
              manning={manningRecord}
              signers={signers}
              outgoingId={outgoingId}
              oncomingId={oncomingId}
              onOutgoing={setOutgoingId}
              onOncoming={setOncomingId}
              actorName={supervisorName}
              canPrint={accessLevel >= 3}
              aiNotesLoading={aiNotesLoading}
              homeCrew={homeCrew}
              coveringCrew={coveringCrew}
              onRefreshAiNotes={() => setAiRefreshRequest((request) => request + 1)}
              downtimeMachines={assets
                .filter((asset) => !shiftJobs.some((down) => down.id === asset.id))
                .map((asset) => ({ id: asset.id, fleetId: asset.fleet_id }))
                .sort((a, b) => a.fleetId.localeCompare(b.fleetId))}
              onAddDowntime={accessLevel >= 3 && !readOnly ? createDowntime : undefined}
            >
              <AiHandoverDigest
                activeShift={activeShift}
                shiftJobs={shiftJobs}
                completedJobs={windowedReleased}
                workOrders={workOrders}
                notes={notes}
                logEntries={shiftLog}
                crew={workshopCrew}
                summaryText={shiftSummary}
                machineSummaries={machineSummaries}
                generateRequest={aiRefreshRequest}
                onGeneratingChange={setAiNotesLoading}
                onMachineSummariesChange={setMachineSummaries}
                onSummaryGenerated={(_text, summaries) => {
                  setMachineSummaries(summaries);
                  setMachineNotes([]);
                }}
              />
            </ShiftHandoverLog>
          </div>}

        </>
      )}

      {showRollover && activeShift && (
        <IncomingCrewDialog
          activeShift={activeShift}
          openJobsCount={workOrders.filter((w) => w.status === 'OPEN').length}
          outgoingCrew={outgoingCrew}
          nextCrew={incomingPanel}
          automaticNextCrew={rosterCrewPlan?.incomingCrew ?? null}
          onNextCrew={handleIncomingCrewOverride}
          onCancel={() => setShowRollover(false)}
          onConfirm={handleFinalizeAndRoll}
        />
      )}
      </div>
    </div>
  );
}

function SignoffAlert({
  title,
  action,
  onClick,
}: {
  title: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 print:hidden">
      <p className="text-sm font-black text-amber-950">{title}</p>
      <button
        type="button"
        onClick={onClick}
        className="min-h-10 rounded-lg bg-amber-700 px-3 text-sm font-black text-white hover:bg-amber-800"
      >
        {action}
      </button>
    </div>
  );
}