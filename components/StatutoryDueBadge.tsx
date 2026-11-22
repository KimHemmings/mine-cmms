import { Asset } from '@/types';
import { serviceAlerts } from '@/utils/statutoryCompliance';

export default function ServiceAlertPills({
  asset,
  suppressSmu = false,
}: {
  asset: Pick<Asset, 'current_smu' | 'next_service_smu' | 'statutory_inspection_due'>;
  suppressSmu?: boolean;
}) {
  const alerts = serviceAlerts(asset, { suppressSmu });
  if (alerts.length === 0) return null;
  return (
    <>
      {alerts.map((alert) => (
        <span
          key={alert.kind}
          title={alert.title}
          className={`shrink-0 inline-flex rounded-full border bg-white px-2 py-0.5 text-[11px] font-bold ${
            alert.kind === 'statutory' ? 'border-rose-400 text-rose-800' : 'border-amber-400 text-amber-900'
          }`}
        >
          {alert.label}
        </span>
      ))}
    </>
  );
}
