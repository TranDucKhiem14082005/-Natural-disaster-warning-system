import { Link } from 'react-router-dom';
import { ChevronRight, Clock, MapPin } from 'lucide-react';
import type { Alert } from '../../types/api';
import { AlertStatusBadge, Badge, SeverityBadge } from '../../components/ui';
import { SEVERITY_COLORS, fmtDateTime } from '../../utils/format';
import { DisasterIcon } from './disaster-icon';

export function AlertCard({ alert }: { alert: Alert }) {
  const ended = alert.status === 'ended';
  return (
    <Link
      to={`/alerts/${alert.id}`}
      className={`group relative flex gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 pl-5 shadow-card transition hover:border-slate-300 hover:shadow-raised ${ended ? 'opacity-80' : ''}`}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: ended ? '#cbd5e1' : SEVERITY_COLORS[alert.severity] }} aria-hidden />
      <DisasterIcon code={alert.type?.code} severity={alert.severity} muted={ended} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <SeverityBadge level={alert.severity} />
          <AlertStatusBadge status={alert.status} />
          {alert.source === 'auto' && <Badge tone="violet">Tự động</Badge>}
        </div>
        <h3 className="mt-1.5 line-clamp-2 font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{alert.title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {alert.type && <span className="font-medium text-slate-600">{alert.type.name}</span>}
          {/* `region` is only eager-loaded by some endpoints; undefined means "not loaded", null means national. */}
          {alert.region !== undefined && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {alert.region?.name ?? 'Toàn quốc'}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            {fmtDateTime(alert.published_at ?? alert.created_at)}
          </span>
        </p>
      </div>
      <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" aria-hidden />
    </Link>
  );
}
