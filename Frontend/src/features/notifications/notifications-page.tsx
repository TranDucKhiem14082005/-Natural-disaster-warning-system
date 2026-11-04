import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellOff, Check, CheckCheck, ChevronRight, TriangleAlert } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useAuth } from '../../store/auth-context';
import { useNotifications } from '../../store/notifications-context';
import type { AppNotification, Paginated } from '../../types/api';
import { Button, Callout, Card, EmptyState, LinkButton, ListSkeleton, PageHeader, Pagination, SegmentedControl, SeverityBadge, useToast } from '../../components/ui';
import { ALERT_STATUS_LABELS, SEVERITY_COLORS, fmtDateTime } from '../../utils/format';
import { PROFILE_PATH } from '../../utils/roles';

type Filter = 'all' | 'unread';

export function NotificationsPage() {
  const { user } = useAuth();
  const { refreshUnread } = useNotifications();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const { data, error, loading, reload, setData } = useFetch(
    () => api.get<{ unread_count: number; items: Paginated<AppNotification> }>('/notifications', { page, unread: filter === 'unread' ? 1 : undefined }),
    [page, filter],
  );

  const markAll = async () => {
    setBusy('all');
    try {
      await api.post('/notifications/read-all');
      refreshUnread();
      reload();
      toast.success('Đã đánh dấu tất cả là đã đọc.');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const markOne = async (id: string) => {
    setBusy(id);
    try {
      await api.post(`/notifications/${id}/read`);
      const now = new Date().toISOString();
      setData((prev) =>
        prev
          ? {
              unread_count: Math.max(0, prev.unread_count - 1),
              items: {
                ...prev.items,
                data: filter === 'unread' ? prev.items.data.filter((n) => n.id !== id) : prev.items.data.map((n) => (n.id === id ? { ...n, read_at: now } : n)),
              },
            }
          : prev,
      );
      refreshUnread();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const items = data?.items.data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Thông báo"
        description="Cảnh báo được gửi khi vị trí quan tâm của bạn nằm trong vùng ảnh hưởng."
        actions={
          <Button variant="secondary" icon={CheckCheck} onClick={markAll} loading={busy === 'all'} disabled={!data?.unread_count}>
            Đánh dấu đã đọc hết
          </Button>
        }
      />

      <div className="mb-4">
        <SegmentedControl<Filter>
          label="Lọc thông báo"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'unread', label: 'Chưa đọc', count: data?.unread_count },
          ]}
        />
      </div>

      {error && <Callout tone="danger">{error}</Callout>}

      <Card flush>
        {loading && !data ? (
          <div className="p-4">
            <ListSkeleton rows={4} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
            description="Thêm vị trí quan tâm (nhà, nơi làm việc...) để nhận cảnh báo đúng khu vực của bạn."
            action={
              user && (
                <LinkButton to={PROFILE_PATH[user.role]} variant="secondary">
                  Quản lý vị trí quan tâm
                </LinkButton>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => {
              const unread = !n.read_at;
              return (
                <li key={n.id} className={`relative flex gap-3 px-4 py-4 sm:px-5 ${unread ? 'bg-brand-50/40' : ''}`}>
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: SEVERITY_COLORS[n.data.severity] ?? '#64748b' }}
                    aria-hidden
                  >
                    <TriangleAlert className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {unread && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Chưa đọc" />}
                      <SeverityBadge level={n.data.severity} />
                      <span className="text-xs text-slate-500">
                        {ALERT_STATUS_LABELS[n.data.status]} · phiên bản {n.data.version} · {fmtDateTime(n.created_at)}
                      </span>
                    </div>
                    <Link to={`/alerts/${n.data.alert_id}`} className={`mt-1 inline-flex items-center gap-1 text-base hover:underline ${unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                      {n.data.title}
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                    </Link>
                    {n.data.instructions && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{n.data.instructions}</p>}
                  </div>
                  {unread && (
                    <Button size="sm" variant="ghost" icon={Check} loading={busy === n.id} onClick={() => markOne(n.id)} className="self-start">
                      <span className="hidden sm:inline">Đã đọc</span>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {data && data.items.last_page > 1 && (
          <div className="border-t border-slate-100 px-4 pb-4 sm:px-5">
            <Pagination page={data.items} onChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
