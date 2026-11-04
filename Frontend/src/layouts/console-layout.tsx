import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2,
  ChartColumn,
  ClipboardCheck,
  Database,
  Globe,
  LayoutDashboard,
  Megaphone,
  Menu,
  ScrollText,
  Siren,
  Tent,
  UserRound,
  Users,
  Waves,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../store/auth-context';
import { api } from '../services/api';
import type { StaffDashboard } from '../types/api';
import { Brand, NotificationBell, UserMenu } from '../components/shell/shell-parts';
import { NOTIFICATIONS_PATH, PROFILE_PATH } from '../utils/roles';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Key of the StaffDashboard counter shown as a badge. */
  count?: 'sos_unhandled' | 'reports_pending' | 'alerts_pending';
}

const OPERATIONS: NavItem[] = [
  { to: '/officer', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/officer/sos', label: 'Điều phối SOS', icon: Siren, count: 'sos_unhandled' },
  { to: '/officer/alerts', label: 'Cảnh báo', icon: Megaphone, count: 'alerts_pending' },
  { to: '/officer/reports', label: 'Duyệt báo cáo', icon: ClipboardCheck, count: 'reports_pending' },
  { to: '/officer/events', label: 'Sự kiện thiên tai', icon: Waves },
  { to: '/officer/shelters', label: 'Điểm trú ẩn', icon: Tent },
  { to: '/officer/stats', label: 'Thống kê', icon: ChartColumn },
];

const ADMINISTRATION: NavItem[] = [
  { to: '/admin', label: 'Tổng quan hệ thống', icon: Building2, end: true },
  { to: '/admin/users', label: 'Người dùng', icon: Users },
  { to: '/admin/catalog', label: 'Danh mục', icon: Database },
  { to: '/admin/logs', label: 'Nhật ký hoạt động', icon: ScrollText },
];

/** Back-office shell for officers and admins: sidebar with live work counters. */
export function ConsoleLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<StaffDashboard | null>(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get<StaffDashboard>('/dashboard')
        .then((d) => alive && setCounts(d))
        .catch(() => {});
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [pathname]);

  const groups = isAdmin
    ? [
        { title: 'Quản trị', items: ADMINISTRATION },
        { title: 'Điều hành', items: OPERATIONS },
      ]
    : [{ title: 'Điều hành', items: OPERATIONS }];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-slate-100 px-4">
        <Brand to={isAdmin ? '/admin' : '/officer'} subtitle={isAdmin ? 'Quản trị hệ thống' : `Cán bộ · ${counts?.region?.name ?? user?.region?.name ?? 'Toàn quốc'}`} />
      </div>
      <nav aria-label="Điều hướng quản lý" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const n = item.count && counts ? counts[item.count] : 0;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`
                      }
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{item.label}</span>
                      {n > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${item.count === 'sos_unhandled' ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                          {n}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <NavLink to="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <Globe className="h-4 w-4" aria-hidden />
          Xem trang công khai
        </NavLink>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-[1100] hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-[1900] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="relative h-full w-72 max-w-[85vw] animate-slide-up bg-white shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng menu">
              <X className="h-5 w-5" aria-hidden />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-[1000] flex h-16 items-center gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6">
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Mở menu" aria-expanded={open}>
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <div className="lg:hidden">
          <Brand to={isAdmin ? '/admin' : '/officer'} />
        </div>
        {counts && counts.sos_unhandled > 0 && (
          <NavLink
            to="/officer/sos"
            className="ml-2 hidden items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100 md:inline-flex"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden />
            {counts.sos_unhandled} SOS chưa xử lý
          </NavLink>
        )}
        <div className="ml-auto flex items-center gap-1">
          {user && <NotificationBell to={NOTIFICATIONS_PATH[user.role]} />}
          {user && <UserMenu links={[{ to: PROFILE_PATH[user.role], label: 'Hồ sơ cá nhân', icon: UserRound }, { to: '/', label: 'Trang công khai', icon: Globe }]} />}
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
