import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AlertStatus, ReportStatus, SosStatus } from '../../types/api';
import { ALERT_STATUS_LABELS, REPORT_STATUS_LABELS, SEVERITY_COLORS, SEVERITY_LABELS, SOS_STATUS_LABELS } from '../../utils/format';

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export type Tone = keyof typeof TONES;

export function Badge({ tone = 'slate', icon: Icon, children, dot }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

export function SeverityBadge({ level, compact }: { level: number; compact?: boolean }) {
  const color = SEVERITY_COLORS[level] ?? '#64748b';
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: color }}
      title={`Mức nguy hiểm ${level}: ${SEVERITY_LABELS[level] ?? ''}`}
    >
      Mức {level}
      {!compact && <span className="font-medium opacity-90">· {SEVERITY_LABELS[level] ?? ''}</span>}
    </span>
  );
}

const ALERT_TONES: Record<AlertStatus, Tone> = { draft: 'slate', pending: 'amber', published: 'red', updated: 'orange', ended: 'slate' };
export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return (
    <Badge tone={ALERT_TONES[status]} dot>
      {ALERT_STATUS_LABELS[status]}
    </Badge>
  );
}

const SOS_TONES: Record<SosStatus, Tone> = { new: 'red', received: 'amber', rescuing: 'blue', safe: 'green' };
export function SosStatusBadge({ status }: { status: SosStatus }) {
  return (
    <Badge tone={SOS_TONES[status]} dot>
      {SOS_STATUS_LABELS[status]}
    </Badge>
  );
}

const REPORT_TONES: Record<ReportStatus, Tone> = { pending: 'amber', approved: 'green', rejected: 'slate' };
export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <Badge tone={REPORT_TONES[status]} dot>
      {REPORT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** SOS priority 1-5 (5 = most urgent). */
export function PriorityBadge({ priority }: { priority: number }) {
  const tone: Tone = priority >= 5 ? 'red' : priority >= 4 ? 'orange' : priority >= 3 ? 'amber' : 'slate';
  return <Badge tone={tone}>Ưu tiên {priority}</Badge>;
}

export const PRIORITY_BAR: Record<number, string> = {
  1: 'bg-slate-300',
  2: 'bg-slate-400',
  3: 'bg-amber-400',
  4: 'bg-orange-500',
  5: 'bg-red-600',
};
