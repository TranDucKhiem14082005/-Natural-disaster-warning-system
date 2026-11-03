import { useState } from 'react';
import { api, errorText } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import type { Paginated, Report, ReportStatus } from '../../types/api';
import { Badge, Button, Card, Empty, ErrorBox, Pagination, Spinner, inputBase, inputClass } from '../../components/ui';
import { REPORT_STATUS_LABELS, fmtDateTime } from '../../utils/format';
import { MediaGallery } from '../reports/report-pages';

export function ReportsReviewPage() {
  const [status, setStatus] = useState<ReportStatus>('pending');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch(() => api.get<Paginated<Report>>('/manage/reports', { status, page }), [status, page]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const review = async (id: number, decision: 'approved' | 'rejected') => {
    setActionError(null);
    try {
      await api.patch(`/manage/reports/${id}/review`, { status: decision, review_note: notes[id] || null });
      reload();
    } catch (err) {
      setActionError(errorText(err));
    }
  };

  return (
    <Card
      title="Báo cáo từ người dân"
      actions={
        <select className={`${inputBase} w-40`} aria-label="Trạng thái" value={status} onChange={(e) => { setStatus(e.target.value as ReportStatus); setPage(1); }}>
          {(Object.keys(REPORT_STATUS_LABELS) as ReportStatus[]).map((s) => (
            <option key={s} value={s}>
              {REPORT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      }
    >
      <ErrorBox message={error ?? actionError} />
      {loading && !data && <Spinner />}
      {data && !data.data.length && <Empty>Không có báo cáo nào.</Empty>}
      <ul className="divide-y divide-slate-100">
        {data?.data.map((r) => (
          <li key={r.id} className="grid gap-3 py-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <strong>#{r.id}</strong>
                {r.type && <Badge tone="blue">{r.type.name}</Badge>}
                <span className="text-xs text-slate-500">
                  {r.user?.name} {r.user?.phone && `· ${r.user.phone}`} · {r.region?.name ?? '-'} · {fmtDateTime(r.created_at)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-slate-800">{r.description}</p>
              <a className="text-xs text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=16/${r.lat}/${r.lng}`}>
                📍 {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
              </a>
              <div className="mt-2">
                <MediaGallery urls={r.media_urls} />
              </div>
            </div>
            {status === 'pending' ? (
              <div className="space-y-2">
                <input className={inputClass} placeholder="Ghi chú (tuỳ chọn)" value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => review(r.id, 'approved')}>
                    Duyệt
                  </Button>
                  <Button className="flex-1" variant="danger" onClick={() => review(r.id, 'rejected')}>
                    Từ chối
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">{r.review_note ?? ''}</p>
            )}
          </li>
        ))}
      </ul>
      <Pagination page={data} onChange={setPage} />
    </Card>
  );
}
