'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { OceBriefing, OceReport } from '@/types';
import { EMPTY_OCE_BRIEFING, normalizeOceBriefing } from '@/utils/oce';
import { useFeedback } from '@/components/ui/FeedbackProvider';

function Lines({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="text-sm mt-1 space-y-1">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export default function OceReportPanel({
  shiftId,
  onChange,
}: {
  shiftId: string | null;
  onChange: (report: OceReport | null) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const [report, setReport] = useState<OceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [writeBriefing, setWriteBriefing] = useState(true);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!shiftId) return;
    let cancelled = false;
    supabase
      .from('oce_reports')
      .select('id, shift_id, file_name, storage_path, source_text, briefing, uploaded_at, uploaded_by')
      .eq('shift_id', shiftId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('OCE report load failed:', error.message);
          return;
        }
        const row = data
          ? { ...(data as OceReport), briefing: normalizeOceBriefing((data as OceReport).briefing) }
          : null;
        setReport(row);
        onChangeRef.current(row);
      });
    return () => {
      cancelled = true;
    };
  }, [shiftId, supabase]);

  async function openOriginal() {
    if (!report?.storage_path) return;
    const { data, error } = await supabase.storage.from('oce-reports').createSignedUrl(report.storage_path, 60 * 10);
    if (error || !data?.signedUrl) {
      showToast({ message: 'Could not open the original report.', tone: 'error' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function upload(file: File) {
    if (!shiftId) {
      showToast({ message: 'There is no active shift to attach this report to.', tone: 'error' });
      return;
    }
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isText = file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt');
    if (!isPdf && !isText) {
      showToast({ message: 'Upload the OCE report as a PDF or a text file.', tone: 'error' });
      return;
    }
    if (file.size > 8_000_000) {
      showToast({ message: 'That file is over 8 MB.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      let text = '';
      let briefing: OceBriefing = EMPTY_OCE_BRIEFING;
      if (!writeBriefing && isText) {
        text = (await file.text()).slice(0, 60_000);
      } else {
        const response = isPdf
          ? await fetch('/api/ai-oce', {
              method: 'POST',
              body: (() => {
                const form = new FormData();
                form.set('file', file);
                form.set('brief', writeBriefing ? 'true' : 'false');
                return form;
              })(),
            })
          : await fetch('/api/ai-oce', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: (await file.text()).slice(0, 60_000), brief: writeBriefing }),
            });
        const payload = await response.json() as { text?: string; briefing?: unknown; error?: string };
        text = payload.text ?? '';
        if (payload.briefing) briefing = normalizeOceBriefing(payload.briefing);
        if (!response.ok && !text) {
          showToast({ message: payload.error || 'Could not read that report.', tone: 'error' });
          return;
        }
      }

      const path = `${shiftId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploaded = await supabase.storage.from('oce-reports').upload(path, file, {
        contentType: file.type || (isPdf ? 'application/pdf' : 'text/plain'),
        upsert: false,
      });
      if (uploaded.error) {
        showToast({ message: 'Could not store that report.', tone: 'error' });
        return;
      }
      const saved = await supabase.from('oce_reports').upsert(
        {
          shift_id: shiftId,
          file_name: file.name,
          storage_path: path,
          source_text: text.slice(0, 60_000),
          briefing,
        },
        { onConflict: 'shift_id' },
      ).select('id, shift_id, file_name, storage_path, source_text, briefing, uploaded_at, uploaded_by').single();
      if (saved.error || !saved.data) {
        showToast({ message: 'Could not save the OCE briefing.', tone: 'error' });
        return;
      }
      const row = { ...(saved.data as OceReport), briefing: normalizeOceBriefing((saved.data as OceReport).briefing) };
      setReport(row);
      onChange(row);
      showToast({
        message: !writeBriefing
          ? 'Report saved without a written briefing. The full text stays attached.'
          : briefing.summary
            ? 'OCE report briefed for both supervisor handovers'
            : 'Report saved. The briefing could not be written, so the full text is attached.',
        tone: !writeBriefing || briefing.summary ? 'success' : 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900">OCE report</h3>
          <p className="text-sm text-slate-600 mt-1">
            One report for the shift. The original stays attached. The written briefing is optional and stays in Australia when you ask for it.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-800">
            <input type="checkbox" checked={writeBriefing} onChange={(event) => setWriteBriefing(event.target.checked)} />
            Write the crew briefing from this report
          </label>
        </div>
        <label className={`min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          <FileUp className="w-4 h-4" /> {busy ? 'Reading...' : 'Upload report'}
          <input
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void upload(file);
            }}
          />
        </label>
      </div>

      {!report ? (
        <p className="text-sm text-slate-500">No OCE report for this shift yet.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            <strong>{report.file_name}</strong>
            {report.storage_path && (
              <button type="button" onClick={() => void openOriginal()} className="ml-2 font-bold underline">Open original</button>
            )}
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.briefing.summary || 'No briefing yet. The full report is below.'}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Lines title="Hazards" items={report.briefing.hazards} />
            <Lines title="Incidents in the report" items={report.briefing.incidents} />
            <Lines title="Restrictions" items={report.briefing.restrictions} />
            <Lines title="Conditions" items={report.briefing.conditions} />
          </div>
          {report.source_text && (
            <details>
              <summary className="text-sm font-bold cursor-pointer">Full report text</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-700 max-h-80 overflow-auto">{report.source_text}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
