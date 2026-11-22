import { RepeatFailure } from '@/utils/repeatFailures';

export default function RepeatFailurePill({ failure }: { failure: RepeatFailure }) {
  return (
    <span title={failure.detail} className="shrink-0 inline-flex rounded-full bg-rose-700 px-2 py-0.5 text-[11px] font-black text-white">
      REPEAT • {failure.count}× {failure.component}
    </span>
  );
}

export function RepeatFailureDetail({ failures }: { failures: RepeatFailure[] }) {
  if (failures.length === 0) return null;
  return (
    <div className="border-b border-rose-200 bg-rose-50 px-4 py-2">
      {failures.map((failure) => (
        <p key={failure.component} className="text-sm font-bold text-rose-950">{failure.detail}</p>
      ))}
    </div>
  );
}
