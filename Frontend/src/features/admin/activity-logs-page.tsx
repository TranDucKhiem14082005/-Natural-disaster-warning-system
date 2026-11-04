import { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, ScrollText } from 'lucide-react';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import type { ActivityLog, Paginated, User } from '../../types/api';
import {
  Button,
  Card,
  Checkbox,
  DescriptionList,
  Drawer,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  ListSkeleton,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { fmtDateTime } from '../../utils/format';
import { MethodBadge, RoleBadge, StatusCodeBadge, describeAction } from './admin-shared';

type MethodFilter = 'all' | 'POST' | 'PATCH' | 'DELETE';
type ResultFilter = 'all' | 'ok' | 'error';

const isNoise = (l: ActivityLog) => l.path.endsWith('broadcasting/auth');

/** Officers and admins: the only accounts whose writes are logged. */
function useStaffUsers() {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    Promise.all(['admin', 'officer'].map((role) => api.get<Paginated<User>>('/admin/users', { role, per_page: 100 })))
      .then((pages) => setUsers(pages.flatMap((p) => p.data)))
      .catch(() => {});
  }, []);
  return users;
}

export function ActivityLogsPage() {
  const staff = useStaffUsers();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ user_id: '', from: '', to: '' });
  const [method, setMethod] = useState<MethodFilter>('all');
  const [result, setResult] = useState<ResultFilter>('all');
  const [hideNoise, setHideNoise] = useState(true);
  const [open, setOpen] = useState<ActivityLog | null>(null);

  const { data, error, loading, reload } = useFetch(
    () => api.get<Paginated<ActivityLog>>('/admin/activity-logs', { user_id: filters.user_id || undefined, from: filters.from, to: filters.to, page }),
    [filters, page],
  );

  const rows = useMemo(
    () =>
      (data?.data ?? []).filter(
        (l) =>
          (!hideNoise || !isNoise(l)) &&
          (method === 'all' || l.method === method) &&
          (result === 'all' || (result === 'ok' ? l.status_code < 400 : l.status_code >= 400)),
      ),
    [data, hideNoise, method, result],
  );

  const setFilter = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Nhật ký hoạt động"
        description="Mọi thao tác ghi dữ liệu của cán bộ và quản trị viên: ai làm gì, lúc nào, kết quả ra sao. Mật khẩu và token không được lưu."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
            Làm mới
          </Button>
        }
      />

      <Card flush>
        <div className="space-y-3 border-b border-slate-100 p-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Người thực hiện">
              <Select value={filters.user_id} onChange={(e) => setFilter({ user_id: e.target.value })}>
                <option value="">Tất cả</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Từ ngày">
              <Input type="date" value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} />
            </Field>
            <Field label="Đến ngày">
              <Input type="date" value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox label="Ẩn kết nối realtime" checked={hideNoise} onChange={(e) => setHideNoise(e.target.checked)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<MethodFilter>
              size="sm"
              label="Loại thao tác"
              value={method}
              onChange={setMethod}
              options={[
                { value: 'all', label: 'Mọi thao tác' },
                { value: 'POST', label: 'Tạo' },
                { value: 'PATCH', label: 'Sửa' },
                { value: 'DELETE', label: 'Xoá' },
              ]}
            />
            <SegmentedControl<ResultFilter>
              size="sm"
              label="Kết quả"
              value={result}
              onChange={setResult}
              options={[
                { value: 'all', label: 'Mọi kết quả' },
                { value: 'ok', label: 'Thành công' },
                { value: 'error', label: 'Lỗi' },
              ]}
            />
            <span className="text-xs text-slate-500">Lọc loại thao tác và kết quả áp dụng trên trang hiện tại.</span>
          </div>
        </div>

        {error && (
          <div className="p-4">
            <ErrorBox message={error} />
          </div>
        )}
        {loading && !data ? (
          <div className="p-4">
            <ListSkeleton rows={8} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="Không có hoạt động nào" description="Thử đổi người thực hiện, khoảng thời gian hoặc bỏ bớt bộ lọc." />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Thời gian</Th>
                    <Th>Người thực hiện</Th>
                    <Th>Thao tác</Th>
                    <Th>Kết quả</Th>
                    <Th>IP</Th>
                    <Th className="text-right">
                      <span className="sr-only">Chi tiết</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(l)}>
                      <Td className="whitespace-nowrap text-slate-500">{fmtDateTime(l.created_at)}</Td>
                      <Td>
                        {l.user ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-semibold text-slate-900">{l.user.name}</span>
                            <RoleBadge role={l.user.role} />
                          </div>
                        ) : (
                          <span className="text-slate-400">Khách</span>
                        )}
                      </Td>
                      <Td>
                        <p className="font-medium text-slate-900">{describeAction(l.method, l.path)}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-slate-500">
                          <MethodBadge method={l.method} />
                          <span className="truncate">/{l.path}</span>
                        </p>
                      </Td>
                      <Td>
                        <StatusCodeBadge code={l.status_code} />
                      </Td>
                      <Td className="font-mono text-xs text-slate-500">{l.ip_address ?? '-'}</Td>
                      <Td className="text-right">
                        <Button variant="ghost" size="sm" icon={Eye}>
                          Xem
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setOpen(l)} className="w-full px-4 py-3 text-left hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-slate-900">{describeAction(l.method, l.path)}</p>
                      <StatusCodeBadge code={l.status_code} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {l.user?.name ?? 'Khách'} · {fmtDateTime(l.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="px-4 pb-4 sm:px-5">
          <Pagination page={data} onChange={setPage} />
        </div>
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? describeAction(open.method, open.path) : ''} description={open ? fmtDateTime(open.created_at) : undefined}>
        {open && (
          <div className="space-y-5">
            <DescriptionList
              items={[
                { label: 'Người thực hiện', value: open.user ? <span className="inline-flex items-center gap-2">{open.user.name} <RoleBadge role={open.user.role} /></span> : 'Khách' },
                { label: 'Kết quả', value: <StatusCodeBadge code={open.status_code} /> },
                {
                  label: 'Đường dẫn',
                  value: (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                      <MethodBadge method={open.method} />/{open.path}
                    </span>
                  ),
                },
                { label: 'Địa chỉ IP', value: <span className="font-mono text-xs">{open.ip_address ?? '-'}</span> },
              ]}
            />
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Dữ liệu gửi lên</p>
              {open.payload && Object.keys(open.payload).length ? (
                <pre className="max-h-[50vh] overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{JSON.stringify(open.payload, null, 2)}</pre>
              ) : (
                <p className="text-sm text-slate-500">Không có dữ liệu.</p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
