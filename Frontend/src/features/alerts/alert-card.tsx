import { Link } from 'react-router-dom';
import type { Alert } from '../../types/api';
import { Badge, SeverityBadge } from '../../components/ui';
import { ALERT_STATUS_LABELS, fmtDateTime } from '../../utils/format';

export function AlertCard({ alert }: { alert: Alert }) {
  const tone = alert.status === 'ended' ? 'slate' : alert.status === 'updated' ? 'amber' : 'red';
  return (
    <Link
      to={`/alerts/${alert.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-500 hover:shadow"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge level={alert.severity} />
        <Badge tone={tone}>{ALERT_STATUS_LABELS[alert.status]}</Badge>
        {alert.type && <Badge tone="blue">{alert.type.name}</Badge>}
        {alert.source === 'auto' && <Badge tone="amber">Tự động</Badge>}
      </div>
      <h3 className="mt-2 font-semibold text-slate-900">{alert.title}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {/* `region` is only eager-loaded by some endpoints; undefined means "not loaded", null means national. */}
        {alert.region !== undefined && `${alert.region?.name ?? 'Toàn quốc'} · `}
        {fmtDateTime(alert.published_at ?? alert.created_at)}
      </p>
    </Link>
  );
}
