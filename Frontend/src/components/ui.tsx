import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '../utils/format';
import type { Paginated } from '../types/api';

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-slate-900">{children}</h1>
      {actions}
    </div>
  );
}

type Variant = 'primary' | 'danger' | 'secondary' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function SeverityBadge({ level }: { level: number }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: SEVERITY_COLORS[level] ?? '#64748b' }}
    >
      Mức {level} · {SEVERITY_LABELS[level] ?? ''}
    </span>
  );
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
};

export function Badge({ tone = 'slate', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Spinner({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export function SuccessBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
      {message}
    </div>
  );
}

export function Empty({ children = 'Không có dữ liệu.' }: { children?: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export function Pagination<T>({ page, onChange }: { page: Paginated<T> | null; onChange: (p: number) => void }) {
  if (!page || page.last_page <= 1) return null;
  return (
    <nav aria-label="Phân trang" className="mt-4 flex items-center justify-center gap-2 text-sm">
      <Button variant="secondary" disabled={page.current_page <= 1} onClick={() => onChange(page.current_page - 1)}>
        Trước
      </Button>
      <span className="text-slate-600">
        Trang {page.current_page}/{page.last_page} · {page.total} mục
      </span>
      <Button variant="secondary" disabled={page.current_page >= page.last_page} onClick={() => onChange(page.current_page + 1)}>
        Sau
      </Button>
    </nav>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** Without width, for controls given a fixed width (`w-40`...); `w-full` would otherwise win. */
export const inputBase =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';
export const inputClass = `w-full ${inputBase}`;
