import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, Inbox, LoaderCircle, TriangleAlert, type LucideIcon } from 'lucide-react';

export function Spinner({ label = 'Đang tải...', className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 py-10 text-sm text-slate-500 ${className}`}>
      <LoaderCircle className="h-5 w-5 animate-spin text-brand-600" aria-hidden />
      {label}
    </div>
  );
}

const CALLOUT = {
  info: { box: 'border-blue-200 bg-blue-50 text-blue-900', icon: Info, iconCls: 'text-blue-600' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CircleCheck, iconCls: 'text-emerald-600' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert, iconCls: 'text-amber-600' },
  danger: { box: 'border-red-200 bg-red-50 text-red-900', icon: CircleAlert, iconCls: 'text-red-600' },
};

export function Callout({
  tone = 'info',
  title,
  children,
  icon,
  actions,
  className = '',
}: {
  tone?: keyof typeof CALLOUT;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  const c = CALLOUT[tone];
  const Icon = icon ?? c.icon;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${c.box} ${className}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${c.iconCls}`} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <Callout tone="danger">{message}</Callout>;
}

export function SuccessBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <Callout tone="success">{message}</Callout>;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-12'}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Kept for pages not yet moved to EmptyState. */
export function Empty({ children = 'Không có dữ liệu.' }: { children?: ReactNode }) {
  return <EmptyState title={children} compact />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} aria-hidden />;
}

/** Placeholder rows while a list loads, so the layout does not jump. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Đang tải" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
