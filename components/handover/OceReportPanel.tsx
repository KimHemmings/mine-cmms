'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { OceBriefing, OceReport } from '@/types';
import { EMPTY_OCE_BRIEFING } from '@/utils/oce';
import { useFeedback } from '@/components/ui/FeedbackProvider';

const SELECT = 'id, shift_id, file_name, storage_path, source_text, file_size, briefing, uploaded_at, uploaded_by';

function reportText(value: string | null | undefined) {
  if (!value || value.startsWith('data:application/pdf')) return '';
  return value;
}

export function blankPageMessage(blankPages: number[], pageCount?: number) {
  if (blankPages.length === 0) return '';
  if (pageCount && blankPages.length >= pageCount) {
    return 'This PDF has no extractable text layer. It may be a scan. Paste the report so a section is not missed.';
  }
  const pages = blankPages.join(', ');
  return `Page ${pages} ${blankPages.length === 1 ? 'has' : 'have'} no extractable text layer. Check ${blankPages.length === 1 ? 'that page' : 'those pages'} so a section is not missed.`;
}

export default function OceReportPanel({
  shiftId,
  onChange,
  locked = false,
}: {
  shiftId: string | null;
  onChange: (report: OceReport | null) => void;
  savedOce?: unknown;
  summaryText?: string;
  onSummaryChange?: (summary: string) => void;
  locked?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const [report, setReport] = useState<OceReport | null>(null);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!shiftId) return;
    let cancelled = false;
    supabase
      .from('oce_reports')
      .select(SELECT)
      .eq('shift_id', shiftId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('OCE report load failed:', error.message);
          return;
        }
        const row = (data as OceReport | null) ?? null;
        setReport(row);
        setPaste(reportText(row?.source_text));
        setNotice(blankPageMessage(row?.briefing?.blankPages ?? []));
        onChange(row && (row.storage_path || reportText(row.source_text)) ? row : null);
      });
    return () => {
      cancelled = true;
    };
  }, [shiftId, supabase, onChange]);

  async function saveRow(input: {
    fileName: string;
    storagePath: string | null;
    fileSize: number | null;
    text: string;
    briefing: OceBriefing;
    previousPath?: string | null;
  }) {
    if (!shiftId) return;
    const saved = await supabase.from('oce_reports').upsert(
      {
        shift_id: shiftId,
        file_name: input.fileName,
        storage_path: input.storagePath,
        source_text: input.text,
        file_size: input.fileSize,
        briefing: input.briefing,
      },
      { onConflict: 'shift_id' },
    ).select(SELECT).single();
    if (saved.error || !saved.data) {
      showToast({ message: 'Could not save the OCE report.', tone: 'error' });
      return;
    }
    if (input.previousPath && input.previousPath !== input.storagePath) {
      await supabase.storage.from('oce-reports').remove([input.previousPath]);
    }
    const row = saved.data as OceReport;
    setReport(row);
    setPaste(reportText(row.source_text));
    onChange(row);
    showToast({ message: 'OCE report saved.', tone: 'success' });
  }

  async function upload(file: File) {
    if (!shiftId) {
      showToast({ message: 'There is no active shift to attach this report to.', tone: 'error' });
      return;
    }
    const pdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!pdf) {
      showToast({ message: 'Upload the OCE report as a PDF.', tone: 'error' });
      return;
    }
    if (file.size > 8_000_000) {
      showToast({ message: 'That PDF is over 8 MB.', tone: 'error' });
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const form = new FormData();
      form.set('file', file);
      const response = await fetch('/api/oce-text', { method: 'POST', body: form });
      const payload = await response.json() as { text?: string; blankPages?: number[]; pages?: number; error?: string };
      if (!response.ok) {
        showToast({ message: payload.error || 'Could not read that PDF.', tone: 'error' });
        return;
      }
      const text = typeof payload.text === 'string' ? payload.text : '';
      const blankPages = Array.isArray(payload.blankPages) ? payload.blankPages : [];
      const message = blankPageMessage(blankPages, payload.pages);
      setNotice(message);
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${shiftId}/${Date.now()}-${safe}`;
      const stored = await supabase.storage.from('oce-reports').upload(path, file, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (stored.error) {
        showToast({ message: 'Could not store that PDF.', tone: 'error' });
        return;
      }
      await saveRow({
        fileName: file.name,
        storagePath: path,
        fileSize: file.size,
        text,
        briefing: { ...EMPTY_OCE_BRIEFING, blankPages },
        previousPath: report?.storage_path,
      });
    } finally {
      setBusy(false);
    }
  }

  async function savePaste() {
    if (!shiftId) {
      showToast({ message: 'There is no active shift to attach this report to.', tone: 'error' });
      return;
    }
    setBusy(true);
    setNotice('');
    await saveRow({
      fileName: report?.file_name && report.storage_path ? report.file_name : 'Pasted OCE report',
      storagePath: report?.storage_path ?? null,
      fileSize: report?.file_size ?? null,
      text: paste,
      briefing: { ...EMPTY_OCE_BRIEFING, blankPages: [] },
    });
    setBusy(false);
  }

  return (
    <div className="mb-3 space-y-3 print:hidden">
      {!locked && (
        <div className="flex flex-wrap items-center gap-2">
          <label className={`min-h-10 px-3 rounded-lg bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            <FileUp className="w-4 h-4" /> {busy ? 'Reading...' : report ? 'Replace PDF' : 'Upload PDF'}
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void upload(file);
              }}
            />
          </label>
        </div>
      )}
      {notice && <p className="text-sm font-bold text-amber-900">{notice}</p>}
    </div>
  );
}
