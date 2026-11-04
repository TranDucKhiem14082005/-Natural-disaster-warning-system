import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

export function Card({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className = '',
  bodyClassName = '',
  flush = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** No body padding: for tables, maps and lists that run edge to edge. */
  flush?: boolean;
}) {
  const hasHeader = title || actions;
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card ${className}`}>
      {hasHeader && (
        <header className={`flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 ${flush ? 'pb-3' : ''}`}>
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`${flush ? '' : `px-4 pb-4 sm:px-5 sm:pb-5 ${hasHeader ? 'pt-3' : 'pt-4 sm:pt-5'}`} ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Link target for the back arrow above the title. */
  back?: { to: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-5 space-y-2 sm:mb-6">
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1">{eyebrow}</div>}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-slate-600 sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Kept for pages not yet moved to PageHeader. */
export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <PageHeader title={children} actions={actions} />;
}

export function DescriptionList({ items, columns = 2 }: { items: { label: ReactNode; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  const cols = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[columns];
  return (
    <dl className={`grid gap-x-6 gap-y-3 ${cols}`}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-slate-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
