import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChartColumn,
  ChevronRight,
  ClipboardCheck,
  Database,
  HardHat,
  MapPinned,
  Megaphone,
  Phone,
  Plus,
  ScrollText,
  ShieldCheck,
  Siren,
  Tent,
  TriangleAlert,
  UserPlus,
  UserRound,
  Users,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../services/api';
import type { ActivityLog, Overview, Paginated, Role, StaffDashboard, User } from '../../types/api';
import { Callout, Card, EmptyState, LinkButton, ListSkeleton, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { fmtDateTime } from '../../utils/format';
import { RESOURCES, type Resource } from './catalog-page';
import { StatusCodeBadge, describeAction } from './admin-shared';

interface AdminSummary {
  users: Record<Role | 'all', number>;
  catalog: Record<Resource, number>;
  staff: StaffDashboard;
  overview: Overview;
  logs: ActivityLog[];
}

const total = (p: Paginated<unknown>) => p.total;

async function loadSummary(): Promise<AdminSummary> {
  const roles: (Role | 'all')[] = ['all', 'citizen', 'rescuer', 'officer', 'admin'];
  const resources = Object.keys(RESOURCES) as Resource[];
  const [userTotals, catalogTotals, staff, overview, logs] = await Promise.all([
    Promise.all(roles.map((r) => api.get<Paginated<User>>('/admin/users', { role: r === 'all' ? undefined : r, per_page: 1 }).then(total))),
    Promise.all(resources.map((r) => api.get<Paginated<unknown>>(`/admin/catalog/${r}`, { per_page: 1 }).then(total))),
    api.get<StaffDashboard>('/dashboard'),
    api.get<Overview>('/overview'),
    api.get<Paginated<ActivityLog>>('/admin/activity-logs', { per_page: 30 }),
  ]);
  return {
    users: Object.fromEntries(roles.map((r, i) => [r, userTotals[i]])) as AdminSummary['users'],
    catalog: Object.fromEntries(resources.map((r, i) => [r, catalogTotals[i]])) as AdminSummary['catalog'],
    staff,
    overview,
    logs: logs.data.filter((l) => !l.path.endsWith('broadcasting/auth')).slice(0, 8),
  };
}

const CATALOG_ICON: Record<Resource, LucideIcon> = { regions: MapPinned, 'disaster-types': TriangleAlert, guides: BookOpen, 'emergency-contacts': Phone };

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary()
      .then(setData)
      .catch(() => setError('Không tải được số liệu tổng quan. Kiểm tra kết nối tới máy chủ rồi tải lại trang.'));
  }, []);

  const s = data?.staff;
  const ops: { label: string; value: number | undefined; to: string; icon: LucideIcon; urgent?: boolean }[] = [
    { label: 'SOS chưa xử lý', value: s?.sos_unhandled, to: '/officer/sos', icon: Siren, urgent: true },
    { label: 'SOS đang cứu hộ', value: s?.sos_in_progress, to: '/officer/sos', icon: HardHat },
    { label: 'Báo cáo chờ duyệt', value: s?.reports_pending, to: '/officer/reports', icon: ClipboardCheck },
    { label: 'Cảnh báo chờ duyệt', value: s?.alerts_pending, to: '/officer/alerts', icon: Megaphone },
    { label: 'Cảnh báo đang hiệu lực', value: s?.alerts_active, to: '/officer/alerts', icon: TriangleAlert },
    { label: 'Sự kiện đang diễn ra', value: data?.overview.ongoing_events, to: '/officer/events', icon: Waves },
  ];

  return (
    <>
      <PageHeader
        title="Tổng quan hệ thống"
        description="Tài khoản, dữ liệu nền và tình hình điều hành trên toàn hệ thống."
        actions={
          <>
            <LinkButton to="/admin/users?new=1" variant="secondary" icon={UserPlus}>
              Thêm tài khoản
            </LinkButton>
            <LinkButton to="/officer/alerts/new" icon={Plus}>
              Tạo cảnh báo
            </LinkButton>
          </>
        }
      />

      {error && <Callout tone="danger" className="mb-5">{error}</Callout>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng tài khoản" value={data ? data.users.all : '–'} icon={Users} tone="blue" hint={data ? `${data.users.admin} quản trị viên` : undefined} to="/admin/users" />
        <StatCard label="Người dân" value={data ? data.users.citizen : '–'} icon={UserRound} tone="slate" to="/admin/users" />
        <StatCard label="Đội cứu hộ" value={data ? data.users.rescuer : '–'} icon={HardHat} tone="orange" to="/admin/users" />
        <StatCard label="Cán bộ" value={data ? data.users.officer : '–'} icon={ShieldCheck} tone="violet" to="/admin/users" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Tình hình điều hành" description={s ? `Toàn quốc · ${data?.overview.open_shelters ?? 0} điểm trú ẩn còn chỗ` : undefined} icon={Siren} className="xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ops.map((o) => (
              <Link
                key={o.label}
                to={o.to}
                className={`group flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-card ${o.urgent && (o.value ?? 0) > 0 ? 'border-red-200 bg-red-50/60' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${o.urgent && (o.value ?? 0) > 0 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <o.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-slate-500">{o.label}</span>
                  {o.value === undefined ? <Skeleton className="mt-1 h-6 w-10" /> : <span className="block text-xl font-bold tabular-nums text-slate-900">{o.value}</span>}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" aria-hidden />
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Dữ liệu nền" description="Danh mục dùng chung" icon={Database} actions={<Link to="/admin/catalog" className="text-sm font-semibold text-brand-700 hover:underline">Quản lý</Link>}>
          <ul className="space-y-1">
            {(Object.keys(RESOURCES) as Resource[]).map((r) => {
              const Icon = CATALOG_ICON[r];
              return (
                <li key={r}>
                  <Link to={`/admin/catalog?tab=${r}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <Icon className="h-4 w-4 text-slate-400" aria-hidden />
                    <span className="flex-1 text-sm font-medium text-slate-700">{RESOURCES[r].label}</span>
                    {data ? <span className="text-sm font-bold tabular-nums text-slate-900">{data.catalog[r]}</span> : <Skeleton className="h-4 w-6" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card
          title="Hoạt động gần đây"
          description="Thao tác ghi của cán bộ và quản trị viên"
          icon={ScrollText}
          className="xl:col-span-2"
          actions={<Link to="/admin/logs" className="text-sm font-semibold text-brand-700 hover:underline">Xem tất cả</Link>}
        >
          {!data ? (
            <ListSkeleton rows={4} />
          ) : data.logs.length === 0 ? (
            <EmptyState compact icon={ScrollText} title="Chưa có hoạt động nào" />
          ) : (
            <ol className="divide-y divide-slate-100">
              {data.logs.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{describeAction(l.method, l.path)}</p>
                    <p className="truncate text-xs text-slate-500">
                      {l.user?.name ?? 'Khách'} · {fmtDateTime(l.created_at)}
                    </p>
                  </div>
                  <StatusCodeBadge code={l.status_code} />
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Lối tắt điều hành" icon={ChartColumn}>
          <div className="grid gap-2">
            {[
              { to: '/officer/sos', label: 'Điều phối SOS', icon: Siren },
              { to: '/officer/alerts/new', label: 'Tạo cảnh báo mới', icon: Megaphone },
              { to: '/officer/reports', label: 'Duyệt báo cáo người dân', icon: ClipboardCheck },
              { to: '/officer/shelters', label: 'Điểm trú ẩn', icon: Tent },
              { to: '/officer/stats', label: 'Thống kê', icon: ChartColumn },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-700">
                <l.icon className="h-4 w-4 text-slate-400 group-hover:text-brand-600" aria-hidden />
                <span className="flex-1">{l.label}</span>
                <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
