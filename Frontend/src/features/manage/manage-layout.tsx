import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/manage/alerts', label: 'Cảnh báo' },
  { to: '/manage/reports', label: 'Duyệt báo cáo' },
  { to: '/manage/events', label: 'Sự kiện' },
  { to: '/manage/shelters', label: 'Điểm trú ẩn' },
  { to: '/manage/stats', label: 'Thống kê' },
];

export function ManageLayout() {
  return (
    <div>
      <nav aria-label="Quản lý" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
