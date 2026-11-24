'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { OceReport } from '@/types';
import { EMPTY_OCE_BRIEFING } from '@/utils/oce';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import OcePdfLink, { isPdfDataUrl } from './OcePdfLink';

const SELECT = 'id, shift_id, file_name, storage_path, source_text, file_size, briefing, uploaded_at, uploaded_by';

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<OceReport | null>(null);
  const [busy, setBusy] = useState(false);

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
        const row = data as OceReport | null;
        const attached = row && (row.storage_path || isPdfDataUrl(row.source_text)) ? row : null;
        setReport(attached);
        onChange(attached);
      });
    return () => {
      cancelled = true;
    };
  }, [shiftId, supabase, onChange]);

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
    const previousPath = report?.storage_path ?? null;
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${shiftId}/${Date.now()}-${safe}`;
    const stored = await supabase.storage.from('oce-reports').upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    });
    let storagePath: string | null = path;
    let dataUrl: string | null = null;
    if (stored.error) {
      try {
        dataUrl = await fileToDataUrl(file);
        storagePath = null;
      } catch {
        setBusy(false);
        showToast({ message: 'Could not store that PDF.', tone: 'error' });
        return;
      }
    }
    const saved = await supabase.from('oce_reports').upsert(
      {
        shift_id: shiftId,
        file_name: file.name,
        storage_path: storagePath,
        source_text: dataUrl,
        file_size: file.size,
        briefing: EMPTY_OCE_BRIEFING,
      },
      { onConflict: 'shift_id' },
    ).select(SELECT).single();
    setBusy(false);
    if (saved.error || !saved.data) {
      showToast({ message: 'Could not save the OCE report.', tone: 'error' });
      return;
    }
    if (previousPath && previousPath !== storagePath) {
      await supabase.storage.from('oce-reports').remove([previousPath]);
    }
    const row = saved.data as OceReport;
    setReport(row);
    onChange(row);
    showToast({
      message: storagePath ? 'OCE report PDF saved.' : 'Storage was unavailable. The PDF is kept with this shift.',
      tone: 'success',
    });
  }

  async function remove() {
    if (!shiftId || !report || locked) return;
    setBusy(true);
    if (report.storage_path) await supabase.storage.from('oce-reports').remove([report.storage_path]);
    const { error } = await supabase.from('oce_reports').delete().eq('id', report.id);
    setBusy(false);
    if (error) {
      showToast({ message: 'Could not remove the OCE report.', tone: 'error' });
      return;
    }
    setReport(null);
    onChange(null);
  }

  const dataUrl = isPdfDataUrl(report?.source_text) ? report?.source_text : null;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-300 border-l-4 border-l-slate-700 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-5 py-3.5">
        <h3 className="text-base font-black text-slate-900">OCE report</h3>
        {!locked && (
          <label className={`min-h-10 px-3 rounded-lg bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            <FileUp className="w-4 h-4" /> {busy ? 'Saving...' : report ? 'Replace PDF' : 'Upload PDF'}
            <input
              ref={fileRef}
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
        )}
      </div>
      <div className="space-y-3 p-4">
        {!report ? (
          <p className="text-sm text-slate-500">No OCE report PDF for this shift yet.</p>
        ) : (
          <div className="space-y-2">
            <OcePdfLink
              fileName={report.file_name}
              storagePath={report.storage_path}
              dataUrl={dataUrl}
              fileSize={report.file_size}
            />
            {!locked && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="text-sm font-bold text-rose-700 underline disabled:opacity-50"
              >
                Remove PDF
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
