import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useDebounced } from '../../hooks/use-debounced';
import type { Alert, AlertStatus, Paginated } from '../../types/api';
import { Badge, Button, Card, Empty, ErrorBox, Pagination, SeverityBadge, Spinner, inputBase, inputClass } from '../../components/ui';
import { ALERT_STATUS_LABELS, fmtDateTime } from '../../utils/format';

const TONE: Record<AlertStatus, 'slate' | 'amber' | 'red' | 'blue'> = { draft: 'slate', pending: 'amber', published: 'red', updated: 'red', ended: 'blue' };

export function AlertsManagePage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useFetch(() => api.get<Paginated<Alert>>('/manage/alerts', { status, q: dq, page }), [status, dq, page]);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (alert: Alert, action: 'submit' | 'publish' | 'reject' | 'end' | 'delete') => {
    setActionError(null);
    let note: string | null = null;
    if (action === 'reject' || action === 'end') {
      note = window.prompt(action === 'reject' ? 'Lý do từ chối (tuỳ chọn):' : 'Ghi chú kết thúc (tuỳ chọn):');
      if (note === null) return;
    }
    if (action === 'delete' && !window.confirm(`Xoá cảnh báo nháp "${alert.title}"?`)) return;
    try {
      if (action === 'delete') await api.delete(`/manage/alerts/${alert.id}`);
      else await api.post(`/manage/alerts/${alert.id}/${action}`, note ? { note } : undefined);
      reload();
    } catch (err) {
      setActionError(errorText(err));
    }
  };

  return (
    <Card
      title="Quản lý cảnh báo"
      actions={
        <Link to="/manage/alerts/new" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Tạo cảnh báo
        </Link>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-xs`} placeholder="Tìm tiêu đề..." aria-label="Tìm" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className={`${inputBase} w-44`} aria-label="Trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(ALERT_STATUS_LABELS) as AlertStatus[]).map((s) => (
            <option key={s} value={s}>
              {ALERT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <ErrorBox message={error ?? actionError} />
      {loading && !data && <Spinner />}
      {data && !data.data.length && <Empty />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-2">Cảnh báo</th>
              <th className="py-2 pr-2">Mức</th>
              <th className="py-2 pr-2">Trạng thái</th>
              <th className="py-2 pr-2">Cập nhật</th>
              <th className="py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.data.map((a) => (
              <tr key={a.id}>
                <td className="py-2 pr-2">
                  <Link to={`/manage/alerts/${a.id}`} className="font-medium text-slate-900 hover:underline">
                    {a.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {a.type?.name} · {a.region?.name ?? 'Toàn quốc'} · v{a.version}
                    {a.source === 'auto' && ' · đề xuất tự động'}
                    {a.creator && ` · ${a.creator.name}`}
                  </p>
                </td>
                <td className="py-2 pr-2"><SeverityBadge level={a.severity} /></td>
                <td className="py-2 pr-2"><Badge tone={TONE[a.status]}>{ALERT_STATUS_LABELS[a.status]}</Badge></td>
                <td className="py-2 pr-2 text-xs text-slate-500">{fmtDateTime(a.updated_at)}</td>
                <td className="py-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    {a.status === 'draft' && <Button variant="secondary" onClick={() => act(a, 'submit')}>Gửi duyệt</Button>}
                    {(a.status === 'draft' || a.status === 'pending') && <Button onClick={() => act(a, 'publish')}>Phát hành</Button>}
                    {a.status === 'pending' && <Button variant="secondary" onClick={() => act(a, 'reject')}>Từ chối</Button>}
                    {(a.status === 'published' || a.status === 'updated') && <Button variant="danger" onClick={() => act(a, 'end')}>Kết thúc</Button>}
                    {a.status === 'draft' && <Button variant="ghost" onClick={() => act(a, 'delete')}>Xoá</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={data} onChange={setPage} />
    </Card>
  );
}
