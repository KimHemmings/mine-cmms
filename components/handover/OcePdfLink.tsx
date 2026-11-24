'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPdfDataUrl(value: string | null | undefined) {
  return typeof value === 'string' && value.startsWith('data:application/pdf');
}

export async function openOcePdf(storagePath: string | null | undefined, dataUrl?: string | null) {
  if (isPdfDataUrl(dataUrl)) {
    const response = await fetch(dataUrl!);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    return true;
  }
  if (!storagePath) return false;
  const { data, error } = await createClient().storage.from('oce-reports').createSignedUrl(storagePath, 60 * 10);
  if (error || !data?.signedUrl) return false;
  window.open(data.signedUrl, '_blank', 'noopener');
  return true;
}

export default function OcePdfLink({
  fileName,
  storagePath,
  dataUrl,
  fileSize,
}: {
  fileName: string;
  storagePath?: string | null;
  dataUrl?: string | null;
  fileSize?: number | null;
}) {
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  async function open() {
    setOpening(true);
    setFailed(false);
    const opened = await openOcePdf(storagePath, dataUrl);
    setOpening(false);
    if (!opened) setFailed(true);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-slate-500" />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">OCE Report PDF</p>
          <p className="truncate text-sm font-bold text-slate-900">
            {fileName}
            {fileSize ? <span className="font-medium text-slate-500"> · {formatFileSize(fileSize)}</span> : null}
          </p>
          {failed && <p className="text-xs font-bold text-rose-700">Could not open that PDF.</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void open()}
        disabled={opening}
        className="min-h-9 shrink-0 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {opening ? 'Opening...' : 'Open PDF'}
      </button>
    </div>
  );
}
