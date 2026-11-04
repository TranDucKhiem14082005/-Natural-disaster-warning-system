import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../store/auth-context';
import { useNotifications } from '../../store/notifications-context';
import { ROLE_LABELS } from '../../utils/format';
import { initials } from '../../utils/roles';

export function Brand({ to = '/', subtitle, dark }: { to?: string; subtitle?: string; dark?: boolean }) {
  return (
    <Link to={to} className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <ShieldAlert className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className={`block truncate text-[15px] font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>Cảnh báo thiên tai</span>
        {subtitle && <span className={`block truncate text-xs font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</span>}
      </span>
    </Link>
  );
}

export function NotificationBell({ to = '/me/notifications', dark }: { to?: string; dark?: boolean }) {
  const { unread } = useNotifications();
  return (
    <Link
      to={to}
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${dark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100'}`}
      aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}

export function Avatar({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 ${className}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

export interface MenuLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Avatar dropdown: who is signed in, portal links, sign out. */
export function UserMenu({ links, dark }: { links: MenuLink[]; dark?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-2 rounded-xl p-1 pr-2 transition ${dark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
      >
        <Avatar name={user.name} />
        <span className="hidden max-w-[10rem] text-left leading-tight md:block">
          <span className={`block truncate text-sm font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{user.name}</span>
          <span className={`block truncate text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown className={`hidden h-4 w-4 md:block ${dark ? 'text-slate-400' : 'text-slate-400'}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-[1600] mt-2 w-64 animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-raised">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email ?? user.phone}</p>
            <p className="mt-1 text-xs font-medium text-brand-700">{ROLE_LABELS[user.role]}</p>
          </div>
          {links.map((l) => (
            <Link key={l.to} role="menuitem" to={l.to} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <l.icon className="h-4 w-4 text-slate-400" aria-hidden />
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/');
            }}
            className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
