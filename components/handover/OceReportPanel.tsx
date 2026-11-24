'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, FileUp, Plus } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { OceAttachment, OceBriefing, OceReport } from '@/types';
import { EMPTY_OCE_BRIEFING, normalizeOceBriefing } from '@/utils/oce';
import { useFeedback } from '@/components/ui/FeedbackProvider';

function reportSections(sourceText: string | null) {
  return (sourceText ?? '')
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => {
      const firstLine = text.split(/\r?\n/, 1)[0].trim();
      const title = firstLine.replace(/^#{1,6}\s*/, '');
      return {
        id: `${index}-${title.slice(0, 40)}`,
        title: /^#{1,6}\s/.test(firstLine) || (firstLine.length <= 100 && firstLine === firstLine.toUpperCase())
          ? title
          : `Section ${index + 1}`,
        text,
      };
    });
}

export default function OceReportPanel({
  shiftId,
  onChange,
  savedOce,
  summaryText,
  onSummaryChange,
}: {
  shiftId: string | null;
  onChange: (report: OceReport | null) => void;
  savedOce?: OceAttachment | null;
  summaryText?: string;
  onSummaryChange?: (summary: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const [report, setReport] = useState<OceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [writeBriefing, setWriteBriefing] = useState(true);
  const [addedSections, setAddedSections] = useState<Record<string, true>>({});
  const summaryTextRef = useRef(summaryText);
  const sections = reportSections(report?.source_text ?? null);

  useEffect(() => {
    summaryTextRef.current = summaryText;
  }, [summaryText]);

  function updateBriefing(briefing: OceReport['briefing']) {
    if (!report) return;
    const updated = { ...report, briefing };
    setReport(updated);
    onChange(updated);
    onSummaryChange?.(briefing.summary);
  }

  function updateSummary(summary: string) {
    if (!report) return;
    updateBriefing({ ...report.briefing, summary });
  }

  function addTextToSummary(text: string, key: string) {
    if (!report) return;
    const addedKey = `${report.id}:${key}`;
    if (addedSections[addedKey]) return;
    const summary = (summaryText ?? report.briefing.summary).trim();
    updateSummary(summary ? `${summary}\n\n${text}` : text);
    setAddedSections((current) => ({ ...current, [addedKey]: true }));
  }

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
        const loaded = data
          ? { ...(data as OceReport), briefing: normalizeOceBriefing((data as OceReport).briefing) }
          : null;
        const row = loaded && savedOce?.fileName === loaded.file_name
          ? { ...loaded, briefing: savedOce.briefing }
          : loaded;
        setReport(row);
        onChange(row);
        if (summaryTextRef.current === undefined) onSummaryChange?.(row?.briefing.summary ?? '');
      });
    return () => {
      cancelled = true;
    };
  }, [shiftId, supabase, onChange, onSummaryChange, savedOce]);

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
      onSummaryChange?.(row.briefing.summary);
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
    <section className="overflow-hidden rounded-xl border border-slate-300 border-l-4 border-l-slate-700 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-5 py-3.5">
        <h3 className="text-base font-black text-slate-900">OCE report</h3>
        <label className={`min-h-10 px-3 rounded-lg bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
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
      <div className="space-y-3 p-4">
        <div>
          <p className="text-sm text-slate-600 mt-1">
            One report for the shift. The original stays attached. The written briefing is optional and stays in Australia when you ask for it.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-800">
            <input type="checkbox" checked={writeBriefing} onChange={(event) => setWriteBriefing(event.target.checked)} />
            Write the crew briefing from this report
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
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">OCE summary</span>
            <textarea
              value={summaryText ?? report.briefing.summary}
              onChange={(event) => updateSummary(event.target.value)}
              rows={3}
              placeholder="No briefing yet. Add a concise operational summary."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            {([
              ['hazards', 'Hazards'],
              ['incidents', 'Incidents'],
              ['restrictions', 'Restrictions'],
              ['conditions', 'Conditions'],
            ] as const).map(([field, title]) => (
              <section key={field} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-600">{title}</h4>
                </div>
                {report.briefing[field].length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No items extracted.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {report.briefing[field].map((item, index) => (
                      <li key={`${field}-${index}`} className="flex items-start justify-between gap-2 text-sm">
                        <span className="min-w-0 flex-1 whitespace-pre-wrap">{item}</span>
                        <button
                          type="button"
                          disabled={Boolean(addedSections[`${report.id}:briefing:${field}:${index}`])}
                          onClick={() => addTextToSummary(item, `briefing:${field}:${index}`)}
                          className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded border border-slate-300 px-2 text-[11px] font-bold text-slate-700 disabled:border-emerald-300 disabled:text-emerald-800"
                        >
                          {addedSections[`${report.id}:briefing:${field}:${index}`] ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {addedSections[`${report.id}:briefing:${field}:${index}`] ? 'Added' : 'Add'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
          {report.source_text && (
            <details className="rounded-lg border border-slate-200">
              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-slate-800">Full report text</summary>
              <div className="max-h-96 space-y-3 overflow-auto border-t border-slate-200 p-3">
                {sections.map((section) => {
                  const added = addedSections[`${report.id}:${section.id}`];
                  return (
                    <section key={section.id} className="rounded-lg border border-slate-200 p-3">
                      <h4 className="text-xs font-black uppercase tracking-wide text-slate-600">{section.title}</h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{section.text}</p>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={Boolean(added)}
                          onClick={() => addTextToSummary(section.text, section.id)}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-300 px-2.5 text-xs font-bold text-slate-700 disabled:border-emerald-300 disabled:text-emerald-800"
                        >
                          {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {added ? 'Added' : '+ Add'}
                        </button>
                      </div>
                    </section>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
      </div>
    </section>
  );
}
