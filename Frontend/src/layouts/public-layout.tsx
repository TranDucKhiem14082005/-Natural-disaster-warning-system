import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  House,
  LayoutDashboard,
  Map as MapIcon,
  Megaphone,
  Phone,
  Siren,
  Tent,
  TriangleAlert,
  UserRound,
  Route as RouteIcon,
  Bell,
  FileText,
} from 'lucide-react';
import { useAuth } from '../store/auth-context';
import { Brand, NotificationBell, UserMenu, type MenuLink } from '../components/shell/shell-parts';
import { LinkButton } from '../components/ui';
import { PORTAL_HOME, PORTAL_LABEL } from '../utils/roles';

const DESKTOP_NAV = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/map', label: 'Bản đồ' },
  { to: '/alerts', label: 'Cảnh báo' },
  { to: '/events', label: 'Sự kiện' },
  { to: '/shelters', label: 'Trú ẩn' },
  { to: '/reports', label: 'Báo cáo' },
  { to: '/guides', label: 'Cẩm nang' },
];

const HOTLINES = [
  { n: '112', label: 'Cứu nạn' },
  { n: '113', label: 'Công an' },
  { n: '114', label: 'Cứu hoả' },
  { n: '115', label: 'Cấp cứu' },
];

/** Public site + citizen area: phone-first, SOS always one tap away. */
export function PublicLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const onSosPage = pathname.startsWith('/sos');

  const citizenLinks: MenuLink[] = [
    { to: '/me', label: 'Trang của tôi', icon: LayoutDashboard },
    { to: '/me/notifications', label: 'Thông báo', icon: Bell },
    { to: '/me/reports', label: 'Báo cáo của tôi', icon: FileText },
    { to: '/me/profile', label: 'Hồ sơ & vị trí', icon: UserRound },
  ];
  const menuLinks: MenuLink[] =
    user && user.role !== 'citizen'
      ? [{ to: PORTAL_HOME[user.role], label: PORTAL_LABEL[user.role], icon: LayoutDashboard }, { to: '/me/notifications', label: 'Thông báo', icon: Bell }]
      : citizenLinks;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded-lg focus:bg-white focus:p-2">
        Bỏ qua điều hướng
      </a>

      <header className="sticky top-0 z-[1000] border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Brand />
          <nav aria-label="Chính" className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
            {DESKTOP_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            {user && user.role !== 'citizen' && (
              <LinkButton to={PORTAL_HOME[user.role]} variant="soft" size="sm" icon={LayoutDashboard} className="hidden sm:inline-flex">
                {PORTAL_LABEL[user.role]}
              </LinkButton>
            )}
            <LinkButton to="/sos" variant="danger" size="md" icon={Siren} className="hidden shadow-sos sm:inline-flex">
              Gửi SOS
            </LinkButton>
            {user ? (
              <>
                <NotificationBell />
                <UserMenu links={menuLinks} />
              </>
            ) : (
              <LinkButton to="/login" variant="secondary" size="md" className="hidden sm:inline-flex">
                Đăng nhập
              </LinkButton>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 sm:pt-8 lg:pb-12">
        <Outlet />
      </main>

      <footer className="hidden border-t border-slate-200 bg-white lg:block">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Phone className="h-4 w-4 text-red-600" aria-hidden />
            Đường dây nóng
          </span>
          {HOTLINES.map((h) => (
            <a key={h.n} href={`tel:${h.n}`} className="text-slate-600 hover:text-red-700">
              <strong className="text-red-600">{h.n}</strong> {h.label}
            </a>
          ))}
          <NavLink to="/contacts" className="font-medium text-brand-700 hover:underline">
            Danh bạ khẩn cấp
          </NavLink>
          <span className="ml-auto text-slate-400">Dữ liệu: cán bộ địa phương · Open-Meteo · USGS · © OpenStreetMap</span>
        </div>
      </footer>

      {!onSosPage && <MobileTabBar loggedIn={!!user} meTo={user ? (user.role === 'citizen' ? '/me' : PORTAL_HOME[user.role]) : '/login'} />}
    </div>
  );
}

function MobileTabBar({ loggedIn, meTo }: { loggedIn: boolean; meTo: string }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-brand-700' : 'text-slate-500'}`;
  return (
    <nav aria-label="Điều hướng nhanh" className="pb-safe fixed inset-x-0 bottom-0 z-[1000] border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
      <div className="relative mx-auto flex max-w-lg items-stretch">
        <NavLink to="/" end className={tab}>
          <House className="h-5 w-5" aria-hidden />
          Trang chủ
        </NavLink>
        <NavLink to="/map" className={tab}>
          <MapIcon className="h-5 w-5" aria-hidden />
          Bản đồ
        </NavLink>
        <div className="flex flex-1 justify-center">
          <NavLink
            to="/sos"
            aria-label="Gửi yêu cầu cứu hộ SOS"
            className="relative -mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-red-600 text-white shadow-sos ring-4 ring-white"
          >
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-red-500" aria-hidden />
            <Siren className="relative h-6 w-6" aria-hidden />
            <span className="relative text-[11px] font-extrabold leading-none">SOS</span>
          </NavLink>
        </div>
        <NavLink to="/alerts" className={tab}>
          <TriangleAlert className="h-5 w-5" aria-hidden />
          Cảnh báo
        </NavLink>
        <NavLink to={meTo} className={tab}>
          <UserRound className="h-5 w-5" aria-hidden />
          {loggedIn ? 'Của tôi' : 'Đăng nhập'}
        </NavLink>
      </div>
    </nav>
  );
}

/** Shortcuts shown on the home page for screens that are not in the tab bar. */
export const QUICK_LINKS = [
  { to: '/shelters', label: 'Điểm trú ẩn', icon: Tent },
  { to: '/evacuation', label: 'Tuyến sơ tán', icon: RouteIcon },
  { to: '/reports/new', label: 'Báo cáo sự cố', icon: Megaphone },
  { to: '/guides', label: 'Cẩm nang', icon: BookOpen },
  { to: '/events', label: 'Sự kiện', icon: ClipboardList },
  { to: '/contacts', label: 'Danh bạ', icon: Phone },
];
