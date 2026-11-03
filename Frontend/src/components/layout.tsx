import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth-context';
import { useUnreadNotifications } from '../features/notifications/use-unread-notifications';
import { ROLE_LABELS } from '../utils/format';
import type { Role } from '../types/api';

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const STAFF: Role[] = ['officer', 'admin'];

const NAV: NavItem[] = [
  { to: '/', label: 'Tổng quan' },
  { to: '/map', label: 'Bản đồ' },
  { to: '/alerts', label: 'Cảnh báo' },
  { to: '/events', label: 'Sự kiện' },
  { to: '/shelters', label: 'Trú ẩn' },
  { to: '/reports', label: 'Báo cáo' },
  { to: '/guides', label: 'Cẩm nang' },
  { to: '/sos-board', label: 'Điều phối SOS', roles: ['rescuer', 'officer', 'admin'] },
  { to: '/manage', label: 'Quản lý', roles: STAFF },
  { to: '/admin', label: 'Quản trị', roles: ['admin'] },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { unread, toast, dismissToast } = useUnreadNotifications(user);

  const items = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-white focus:p-2">
        Bỏ qua điều hướng
      </a>
      <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-700">
            <span aria-hidden className="text-xl">⚠️</span>
            <span className="hidden sm:inline">Cảnh báo thiên tai</span>
          </Link>

          <nav aria-label="Chính" className="ml-2 hidden flex-1 items-center gap-1 lg:flex">
            {items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/sos" className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-red-700">
              SOS
            </Link>
            {user ? (
              <>
                <Link to="/notifications" className="relative rounded-lg p-2 hover:bg-slate-100" aria-label={`Thông báo, ${unread} chưa đọc`}>
                  <span aria-hidden>🔔</span>
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[11px] font-bold text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
                <Link to="/dashboard" className="hidden text-right text-xs leading-tight sm:block">
                  <span className="block font-semibold text-slate-800">{user.name}</span>
                  <span className="text-slate-500">{ROLE_LABELS[user.role]}</span>
                </Link>
              </>
            ) : (
              <Link to="/login" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Đăng nhập
              </Link>
            )}
            <button
              type="button"
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label="Mở menu"
              onClick={() => setOpen((o) => !o)}
            >
              ☰
            </button>
          </div>
        </div>

        {open && (
          <nav id="mobile-nav" aria-label="Chính (di động)" className="border-t border-slate-200 px-4 py-2 lg:hidden" onClick={() => setOpen(false)}>
            {items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={navClass}>
                {n.label}
              </NavLink>
            ))}
            {user && (
              <>
                <NavLink to="/dashboard" className={navClass}>
                  Trang của tôi
                </NavLink>
                <NavLink to="/profile" className={navClass}>
                  Hồ sơ
                </NavLink>
              </>
            )}
          </nav>
        )}
      </header>

      {toast && (
        <div role="alert" className="fixed bottom-4 right-4 z-[1500] max-w-sm rounded-xl border border-red-200 bg-white p-4 shadow-xl">
          <p className="text-xs font-semibold uppercase text-red-600">Cảnh báo mới trong khu vực của bạn · Mức {toast.severity}</p>
          <p className="mt-1 font-semibold text-slate-900">{toast.title}</p>
          {toast.instructions && <p className="mt-1 text-sm text-slate-600">{toast.instructions}</p>}
          <div className="mt-3 flex gap-2">
            <Link to={`/alerts/${toast.alert_id}`} onClick={dismissToast} className="text-sm font-medium text-brand-600 hover:underline">
              Xem chi tiết
            </Link>
            <button type="button" onClick={dismissToast} className="ml-auto text-sm text-slate-500 hover:underline">
              Đóng
            </button>
          </div>
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm text-slate-600">
          <span>Khẩn cấp:</span>
          {['112', '113', '114', '115'].map((n) => (
            <a key={n} href={`tel:${n}`} className="font-semibold text-red-600 hover:underline">
              {n}
            </a>
          ))}
          <Link to="/contacts" className="hover:underline">
            Danh bạ
          </Link>
          {user && (
            <span className="ml-auto flex gap-3">
              <Link to="/profile" className="hover:underline">
                Hồ sơ
              </Link>
              <button
                type="button"
                className="hover:underline"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                Đăng xuất
              </button>
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
