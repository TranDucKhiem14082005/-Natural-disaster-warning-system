import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { LoaderCircle, type LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'danger' | 'success' | 'warning' | 'secondary' | 'ghost' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800',
  warning: 'bg-amber-500 text-white shadow-sm hover:bg-amber-600 active:bg-amber-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-xs',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-base',
  xl: 'h-14 gap-2.5 rounded-2xl px-6 text-lg',
};

const ICON_SIZES: Record<ButtonSize, string> = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5', xl: 'h-6 w-6' };

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return `inline-flex shrink-0 select-none items-center justify-center font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  block?: boolean;
  children?: ReactNode;
}

function Inner({ icon: Icon, iconRight: IconRight, size = 'md', loading, children }: CommonProps & { loading?: boolean }) {
  const cls = ICON_SIZES[size];
  return (
    <>
      {loading ? <LoaderCircle className={`${cls} animate-spin`} aria-hidden /> : Icon && <Icon className={cls} aria-hidden />}
      {children}
      {IconRight && <IconRight className={cls} aria-hidden />}
    </>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  loading,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & CommonProps & { loading?: boolean }) {
  return (
    <button
      type="button"
      className={buttonClass(variant, size, `${block ? 'w-full' : ''} ${className}`)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <Inner icon={icon} iconRight={iconRight} size={size} loading={loading}>
        {children}
      </Inner>
    </button>
  );
}

export function LinkButton({ variant = 'primary', size = 'md', icon, iconRight, block, className = '', children, ...props }: LinkProps & CommonProps) {
  return (
    <Link className={buttonClass(variant, size, `${block ? 'w-full' : ''} ${className}`)} {...props}>
      <Inner icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </Link>
  );
}

/** Plain <a> for tel:, mailto: and external links. */
export function AnchorButton({ variant = 'primary', size = 'md', icon, iconRight, block, className = '', children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & CommonProps) {
  return (
    <a className={buttonClass(variant, size, `${block ? 'w-full' : ''} ${className}`)} {...props}>
      <Inner icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </a>
  );
}

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: LucideIcon; label: string; variant?: ButtonVariant; size?: ButtonSize }) {
  const box = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-lg', lg: 'h-12 w-12 rounded-xl', xl: 'h-14 w-14 rounded-2xl' }[size];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${box} ${className}`}
      {...props}
    >
      <Icon className={ICON_SIZES[size]} aria-hidden />
    </button>
  );
}
