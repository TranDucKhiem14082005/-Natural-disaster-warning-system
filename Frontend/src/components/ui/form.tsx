import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Check, type LucideIcon } from 'lucide-react';

/** Without width, for controls given a fixed width (`w-40`...); `w-full` would otherwise win. */
export const inputBase =
  'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:bg-slate-50 disabled:text-slate-500';
export const inputClass = `w-full ${inputBase}`;
const textareaClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15';

export function Field({
  label,
  children,
  hint,
  error,
  required,
  className = '',
  as = 'label',
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** 'div' when children hold several controls (button groups, maps): a <label> would forward clicks to the first one. */
  as?: 'label' | 'div';
}) {
  const Tag = as;
  return (
    <Tag className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </Tag>
  );
}

export function Input({ icon: Icon, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }) {
  if (!Icon) return <input className={`${inputClass} ${className}`} {...props} />;
  return (
    <span className={`relative block ${className}`}>
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input className={`${inputClass} pl-9`} {...props} />
    </span>
  );
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputClass} pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${textareaClass} ${className}`} {...props} />;
}

export function Checkbox({ label, className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 ${className}`}>
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...props} />
      {label}
    </label>
  );
}

/** Large toggle chip for multi-select choices (SOS conditions, amenities, layers). */
export function ToggleChip({
  checked,
  onChange,
  icon: Icon,
  children,
  tone = 'brand',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  icon?: LucideIcon;
  children: ReactNode;
  tone?: 'brand' | 'red';
}) {
  const on = tone === 'red' ? 'border-red-500 bg-red-50 text-red-700' : 'border-brand-500 bg-brand-50 text-brand-700';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${checked ? on : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
    >
      {checked ? <Check className="h-4 w-4" aria-hidden /> : Icon && <Icon className="h-4 w-4 text-slate-500" aria-hidden />}
      {children}
    </button>
  );
}

/** Single-choice pill group, e.g. tabs inside a card or a filter switch. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
