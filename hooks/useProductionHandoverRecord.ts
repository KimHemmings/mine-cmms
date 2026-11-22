'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  HANDOVER_CHECK_COLUMNS,
  HandoverCheckRow,
  HandoverRecord,
  PitCheckKey,
  emptyHandoverRecord,
  handoverIsSigned,
  previousHandoverRow,
  recordFromRow,
  toHandoverWrite,
} from '@/utils/productionHandoverRecord';
import { clearHandoverDraft, handoverDraftKey, readHandoverDraft, updateHandoverDraft } from '@/utils/handoverDraft';

export function useProductionHandoverRecord({
  shiftDate,
  shiftName,
  crewGroup,
  supervisorName,
}: {
  shiftDate: string;
  shiftName: 'Day Shift' | 'Night Shift';
  crewGroup: string | null;
  supervisorName: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [record, setRecord] = useState<HandoverRecord>(emptyHandoverRecord);
  const [handoverId, setHandoverId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const recordRef = useRef(record);
  recordRef.current = record;
  const metaRef = useRef({ shiftDate, shiftName, crewGroup, supervisorName });
  metaRef.current = { shiftDate, shiftName, crewGroup, supervisorName };

  useEffect(() => {
    if (!crewGroup) {
      setRecord(emptyHandoverRecord());
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void supabase
      .from('production_handover_checks')
      .select(HANDOVER_CHECK_COLUMNS)
      .order('shift_date', { ascending: false })
      .limit(24)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError('The production handover could not be loaded.');
          setRecord(emptyHandoverRecord());
          setReady(true);
          return;
        }
        const rows = (data ?? []) as HandoverCheckRow[];
        const current = rows.find((row) => row.shift_date === shiftDate && row.shift_name === shiftName && row.crew_group === crewGroup);
        const next = current
          ? recordFromRow(current, false)
          : (() => {
              const previous = previousHandoverRow(rows, shiftDate, shiftName);
              return previous ? recordFromRow(previous, true) : emptyHandoverRecord();
            })();
        const draftKey = handoverDraftKey(shiftDate, shiftName, 'production');
        const draft = readHandoverDraft<{ record?: HandoverRecord }>(draftKey);
        const shown = !handoverIsSigned(next) && draft?.record
          ? {
              ...next,
              ...draft.record,
              outgoing_signed_by: next.outgoing_signed_by,
              outgoing_signed_at: next.outgoing_signed_at,
              oncoming_signed_by: next.oncoming_signed_by,
              oncoming_signed_at: next.oncoming_signed_at,
            }
          : next;
        if (handoverIsSigned(next)) clearHandoverDraft(draftKey);
        recordRef.current = shown;
        setRecord(shown);
        setHandoverId(current?.id ?? null);
        setError('');
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [crewGroup, shiftDate, shiftName, supabase]);

  const edit = useCallback((partial: Partial<HandoverRecord>) => {
    setRecord((current) => {
      if (handoverIsSigned(current)) return current;
      const next = { ...current, ...partial };
      recordRef.current = next;
      const meta = metaRef.current;
      if (meta.shiftDate && meta.shiftName) {
        updateHandoverDraft(handoverDraftKey(meta.shiftDate, meta.shiftName, 'production'), { record: next });
      }
      return next;
    });
  }, []);

  const save = useCallback(async (partial: Partial<HandoverRecord> = {}) => {
    const meta = metaRef.current;
    if (handoverIsSigned(recordRef.current)) {
      setError('STATUTORY RECORD LOCKED (SIGNED OFF)');
      return false;
    }
    const previous = recordRef.current;
    const next = { ...previous, ...partial };
    recordRef.current = next;
    setRecord(next);
    const draftKey = handoverDraftKey(meta.shiftDate, meta.shiftName, 'production');
    if (!meta.crewGroup) {
      updateHandoverDraft(draftKey, { record: next });
      return false;
    }
    const { data: saved, error: saveError } = await supabase.from('production_handover_checks').upsert(
      toHandoverWrite(next, {
        shiftDate: meta.shiftDate,
        shiftName: meta.shiftName,
        crewGroup: meta.crewGroup,
        supervisorName: meta.supervisorName,
      }),
      { onConflict: 'shift_date,shift_name,crew_group' },
    ).select('id').maybeSingle();
    if (saveError) {
      const kept = {
        ...next,
        outgoing_signed_by: previous.outgoing_signed_by,
        outgoing_signed_at: previous.outgoing_signed_at,
        oncoming_signed_by: previous.oncoming_signed_by,
        oncoming_signed_at: previous.oncoming_signed_at,
      };
      recordRef.current = kept;
      setRecord(kept);
      updateHandoverDraft(draftKey, { record: kept });
      setError('That handover change did not save. Check the pit signal and try again.');
      return false;
    }
    if (saved?.id) setHandoverId(saved.id);
    if (handoverIsSigned(next)) clearHandoverDraft(draftKey);
    else updateHandoverDraft(draftKey, { record: null });
    setError('');
    return true;
  }, [supabase]);

  const commitPit = useCallback(async (partial: Partial<HandoverRecord>, touched: PitCheckKey) => {
    const carried = recordRef.current.carried_fields.filter((key) => key !== touched);
    await save({ ...partial, carried_fields: carried });
  }, [save]);

  const uploadOceReport = useCallback(async (file: File) => {
    const meta = metaRef.current;
    if (!meta.crewGroup) return false;
    const named = file.name.toLowerCase();
    const allowed = file.type === 'application/pdf' || file.type.startsWith('image/') || named.endsWith('.pdf') || /\.(png|jpe?g|webp|gif|heic)$/i.test(named);
    if (!allowed) {
      setError('Upload the OCE report as a PDF or a photo.');
      return false;
    }
    if (file.size > 8_000_000) {
      setError('That file is over 8 MB.');
      return false;
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${meta.shiftDate}/${meta.shiftName.replace(/\s+/g, '-')}/${meta.crewGroup}/${Date.now()}-${safe}`;
    const uploaded = await supabase.storage.from('oce-reports').upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploaded.error) {
      setError('The OCE report did not upload. Check the pit signal and try again.');
      return false;
    }
    return save({
      oce_report_url: path,
      oce_report_filename: file.name,
      oce_report_uploaded_at: new Date().toISOString(),
      oce_inspection_status: 'Completed & Uploaded',
    });
  }, [save, supabase]);

  const openOceReport = useCallback(async () => {
    const path = recordRef.current.oce_report_url;
    if (!path) return;
    const { data, error: linkError } = await supabase.storage.from('oce-reports').createSignedUrl(path, 60 * 10);
    if (linkError || !data?.signedUrl) {
      setError('Could not open the OCE report.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  }, [supabase]);

  return { record, handoverId, signedOff: handoverIsSigned(record), ready, error, edit, save, commitPit, uploadOceReport, openOceReport };
}
