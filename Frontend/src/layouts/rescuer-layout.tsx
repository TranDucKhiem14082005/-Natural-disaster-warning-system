import { NavLink, Outlet } from 'react-router-dom';
import { CircleCheck, ClipboardList, Globe, Map as MapIcon, UserRound } from 'lucide-react';
import { useAuth } from '../store/auth-context';
import { Brand, NotificationBell, UserMenu } from '../components/shell/shell-parts';

const TABS = [
  { to: '/rescuer', label: 'Nhiệm vụ', icon: ClipboardList, end: true },
  { to: '/rescuer/map', label: 'Bản đồ', icon: MapIcon },
  { to: '/rescuer/history', label: 'Đã xong', icon: CircleCheck },
  { to: '/rescuer/profile', label: 'Tài khoản', icon: UserRound },
];

/** Field app for rescue teams: dark header, big touch targets, bottom tabs on phones. */
export function RescuerLayout() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-[1000] bg-slate-900 text-white shadow-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Brand to="/rescuer" subtitle={user?.region?.name ? `Đội cứu hộ · ${user.region.name}` : 'Đội cứu hộ'} dark />
          <span className="ml-1 hidden items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 sm:inline-flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
            Đang trực
          </span>
          <nav aria-label="Cứu hộ" className="ml-4 hidden flex-1 items-center gap-1 md:flex">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`
                }
              >
                <t.icon className="h-4 w-4" aria-hidden />
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell to="/rescuer/notifications" dark />
            <UserMenu dark links={[{ to: '/rescuer/profile', label: 'Tài khoản', icon: UserRound }, { to: '/', label: 'Trang công khai', icon: Globe }]} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 md:pb-10">
        <Outlet />
      </main>

      <nav aria-label="Cứu hộ (di động)" className="pb-safe fixed inset-x-0 bottom-0 z-[1000] border-t border-slate-200 bg-white md:hidden">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-brand-700' : 'text-slate-500'}`}
            >
              <t.icon className="h-5 w-5" aria-hidden />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
