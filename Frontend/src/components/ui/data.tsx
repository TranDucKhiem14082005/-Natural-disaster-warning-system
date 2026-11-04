import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import type { Paginated } from '../../types/api';
import { Button } from './button';

const STAT_TONES = {
  slate: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900' },
  blue: { icon: 'bg-blue-50 text-blue-600', value: 'text-slate-900' },
  green: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-slate-900' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-slate-900' },
  orange: { icon: 'bg-orange-50 text-orange-600', value: 'text-slate-900' },
  red: { icon: 'bg-red-50 text-red-600', value: 'text-red-600' },
  violet: { icon: 'bg-violet-50 text-violet-600', value: 'text-slate-900' },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'slate',
  hint,
  to,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof STAT_TONES;
  hint?: ReactNode;
  to?: string;
}) {
  const t = STAT_TONES[tone];
  const body = (
    <div className="flex h-full items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:shadow-raised">
      {Icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl ${t.value}`}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Kept for pages not yet moved to StatCard. */
export function Stat({ label, value }: { label: string; value: ReactNode; tone?: string }) {
  return <StatCard label={label} value={value} />;
}

export function Pagination<T>({ page, onChange }: { page: Paginated<T> | null; onChange: (p: number) => void }) {
  if (!page || page.last_page <= 1) return null;
  return (
    <nav aria-label="Phân trang" className="mt-4 flex items-center justify-between gap-2 text-sm">
      <span className="text-slate-500">
        {page.total} mục · trang {page.current_page}/{page.last_page}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page.current_page <= 1} onClick={() => onChange(page.current_page - 1)}>
          Trước
        </Button>
        <Button variant="secondary" size="sm" iconRight={ChevronRight} disabled={page.current_page >= page.last_page} onClick={() => onChange(page.current_page + 1)}>
          Sau
        </Button>
      </div>
    </nav>
  );
}

/** Horizontally scrollable table wrapper; use inside <Card flush>. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={`border-y border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 first:pl-5 last:pr-5 ${className}`} {...props} />;
}

export function Td({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`border-b border-slate-100 px-4 py-3 align-middle first:pl-5 last:pr-5 ${className}`} {...props} />;
}
