import { X } from 'lucide-react';

export interface RepeatScan {
  insufficientData?: boolean;
  message?: string;
  bullets?: string[];
  error?: string;
}

function leadIn(line: string) {
  const clean = line.replace(/^•\s*/, '');
  const split = clean.indexOf(':');
  if (split > 8 && split < 90) {
    return { title: clean.slice(0, split), rest: clean.slice(split) };
  }
  return { title: '', rest: clean };
}

export default function RepeatFailureCallout({
  result,
  onHide,
  onRefresh,
  refreshing,
}: {
  result: RepeatScan;
  onHide: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const quiet = Boolean(
    result.error
    || result.insufficientData
    || (result.bullets ?? []).every((line) => /no recurring failure patterns/i.test(line))
  );
  const lines = result.error
    ? [result.error]
    : result.insufficientData
    ? [result.message || 'Not enough maintenance history to identify repeat failure patterns yet.']
    : result.bullets ?? [];

  return (
    <div className={`mb-3 rounded-xl border-2 p-3 ${quiet ? 'border-slate-300 bg-slate-50' : 'border-amber-300 bg-amber-50/80'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-black text-slate-900">Repeat failures, last 12 months</p>
        <button
          type="button"
          onClick={onHide}
          className="min-h-[40px] px-3 inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 bg-white text-sm font-bold text-slate-800"
        >
          <X className="w-4 h-4" /> Hide
        </button>
      </div>
      <ul className="space-y-2">
        {lines.map((line) => {
          const parts = leadIn(line);
          return (
            <li key={line} className="text-base leading-snug text-slate-900">
              {parts.title ? <strong className="font-black">{parts.title}</strong> : null}
              {parts.rest}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="mt-2 text-sm font-bold text-slate-700 underline disabled:opacity-50"
      >
        {refreshing ? 'Scanning 12-Mo History...' : 'Refresh'}
      </button>
    </div>
  );
}
