import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Megaphone, Plus, Search } from 'lucide-react';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useDebounced } from '../../hooks/use-debounced';
import type { Alert, Paginated } from '../../types/api';
import {
  AlertStatusBadge,
  Badge,
  Callout,
  Card,
  EmptyState,
  Input,
  LinkButton,
  ListSkeleton,
  PageHeader,
  Pagination,
  SegmentedControl,
  SeverityBadge,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { fmtDateTime } from '../../utils/format';
import { AlertActionButtons } from './alert-actions';

type Tab = '' | 'pending' | 'draft' | 'active' | 'ended';
const TABS: { value: Tab; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'draft', label: 'Nháp' },
  { value: 'active', label: 'Đang hiệu lực' },
  { value: 'ended', label: 'Đã kết thúc' },
];

export function AlertsManagePage() {
  const [tab, setTab] = useState<Tab>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useFetch(() => api.get<Paginated<Alert>>('/manage/alerts', { status: tab, q: dq, page }), [tab, dq, page]);
  // Per-tab totals: one cheap request each (per_page=1 only reads `total`).
  const counts = useFetch(
    () =>
      Promise.all(TABS.map((t) => api.get<Paginated<Alert>>('/manage/alerts', { status: t.value, q: dq, per_page: 1 }).then((r) => [t.value, r.total] as const))).then(
        (pairs) => Object.fromEntries(pairs) as Record<Tab, number>,
      ),
    [dq],
  );

  const refresh = () => {
    reload();
    counts.reload();
  };
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Quản lý cảnh báo"
        description="Tạo, duyệt và phát hành cảnh báo. Mỗi lần thay đổi đều được lưu thành một phiên bản."
        actions={
          <LinkButton to="/officer/alerts/new" icon={Plus}>
            Tạo cảnh báo
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl<Tab>
          label="Trạng thái cảnh báo"
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          options={TABS.map((t) => ({ ...t, count: counts.data?.[t.value] }))}
        />
        <Input
          icon={Search}
          aria-label="Tìm cảnh báo"
          placeholder="Tìm theo tiêu đề, mô tả, khu vực..."
          className="w-full sm:ml-auto sm:w-72"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <Callout tone="danger" className="mb-4">{error}</Callout>}

      <Card flush>
        {loading && !data ? (
          <div className="p-4">
            <ListSkeleton rows={4} />
          </div>
        ) : !rows.length ? (
          <EmptyState
            icon={Megaphone}
            title={q ? 'Không tìm thấy cảnh báo phù hợp' : 'Chưa có cảnh báo nào ở mục này'}
            description={tab === 'pending' ? 'Cảnh báo do cán bộ gửi duyệt và đề xuất tự động từ dữ liệu mưa sẽ nằm ở đây.' : undefined}
            action={
              <LinkButton to="/officer/alerts/new" icon={Plus} variant="soft">
                Tạo cảnh báo
              </LinkButton>
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Cảnh báo</Th>
                    <Th>Mức độ</Th>
                    <Th>Trạng thái</Th>
                    <Th>Cập nhật</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <Td className="max-w-md">
                        <Link to={`/officer/alerts/${a.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                          {a.title}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                          <span>{a.type?.name}</span>·<span>{a.region?.name ?? 'Toàn quốc'}</span>·<span>v{a.version}</span>
                          {a.creator && <>· <span>{a.creator.name}</span></>}
                          {a.source === 'auto' && (
                            <Badge tone="amber" icon={Bot}>
                              Tự động
                            </Badge>
                          )}
                        </p>
                      </Td>
                      <Td>
                        <SeverityBadge level={a.severity} />
                      </Td>
                      <Td>
                        <AlertStatusBadge status={a.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(a.updated_at)}</Td>
                      <Td>
                        <AlertActionButtons alert={a} onDone={refresh} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((a) => (
                <li key={a.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SeverityBadge level={a.severity} compact />
                    <AlertStatusBadge status={a.status} />
                    {a.source === 'auto' && (
                      <Badge tone="amber" icon={Bot}>
                        Tự động
                      </Badge>
                    )}
                  </div>
                  <Link to={`/officer/alerts/${a.id}`} className="block font-semibold text-slate-900">
                    {a.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {a.type?.name} · {a.region?.name ?? 'Toàn quốc'} · v{a.version} · {fmtDateTime(a.updated_at)}
                  </p>
                  <AlertActionButtons alert={a} onDone={refresh} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <Pagination page={data} onChange={setPage} />
    </>
  );
}
