import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import type { AppNotification, Paginated } from '../../types/api';
import { Button, Card, Empty, ErrorBox, PageTitle, Pagination, SeverityBadge, Spinner } from '../../components/ui';
import { ALERT_STATUS_LABELS, fmtDateTime } from '../../utils/format';

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, error, loading, reload } = useFetch(
    () => api.get<{ unread_count: number; items: Paginated<AppNotification> }>('/notifications', { page, unread: unreadOnly ? 1 : undefined }),
    [page, unreadOnly],
  );

  const markAll = async () => {
    await api.post('/notifications/read-all');
    reload();
  };
  const markOne = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    reload();
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setUnreadOnly((v) => !v)}>
              {unreadOnly ? 'Hiện tất cả' : 'Chỉ chưa đọc'}
            </Button>
            <Button onClick={markAll} disabled={!data?.unread_count}>
              Đánh dấu đã đọc hết
            </Button>
          </div>
        }
      >
        Thông báo {data ? `(${data.unread_count} chưa đọc)` : ''}
      </PageTitle>
      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : (
        <Card>
          {data?.items.data.length ? (
            <ul className="divide-y divide-slate-100">
              {data.items.data.map((n) => (
                <li key={n.id} className={`flex flex-wrap items-start gap-3 py-3 ${n.read_at ? 'opacity-60' : ''}`}>
                  <SeverityBadge level={n.data.severity} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/alerts/${n.data.alert_id}`} className="font-medium text-slate-900 hover:underline">
                      {n.data.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {ALERT_STATUS_LABELS[n.data.status]} · phiên bản {n.data.version} · {fmtDateTime(n.created_at)}
                    </p>
                    {n.data.instructions && <p className="mt-1 text-sm text-slate-600">{n.data.instructions}</p>}
                  </div>
                  {!n.read_at && (
                    <Button variant="ghost" onClick={() => markOne(n.id)}>
                      Đã đọc
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Chưa có thông báo. Thêm vị trí quan tâm trong Hồ sơ để nhận cảnh báo theo khu vực.</Empty>
          )}
          <Pagination page={data?.items ?? null} onChange={setPage} />
        </Card>
      )}
    </>
  );
}
