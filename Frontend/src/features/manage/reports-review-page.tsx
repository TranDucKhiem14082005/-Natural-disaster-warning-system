import { useState } from 'react';
import { Check, ClipboardCheck, ExternalLink, MapPin, ThumbsUp, UserRound, X } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import type { Paginated, Report, ReportStatus } from '../../types/api';
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
  Pagination,
  ReportStatusBadge,
  SegmentedControl,
  Textarea,
  useToast,
} from '../../components/ui';
import { REPORT_STATUS_LABELS, fmtDateTime } from '../../utils/format';
import { MediaGallery } from '../reports/report-pages';
import { osmLink, timeAgo } from './manage-ui';

const STATUSES: ReportStatus[] = ['pending', 'approved', 'rejected'];

export function ReportsReviewPage() {
  const [status, setStatus] = useState<ReportStatus>('pending');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch(() => api.get<Paginated<Report>>('/manage/reports', { status, page }), [status, page]);
  const counts = useFetch(
    () => Promise.all(STATUSES.map((s) => api.get<Paginated<Report>>('/manage/reports', { status: s, per_page: 1 }).then((r) => [s, r.total] as const))).then((p) => Object.fromEntries(p) as Record<ReportStatus, number>),
    [],
  );
  const refresh = () => {
    reload();
    counts.reload();
  };

  return (
    <>
      <PageHeader
        title="Duyệt báo cáo người dân"
        description="Báo cáo được duyệt sẽ hiện trên bản đồ công khai để mọi người cùng theo dõi."
      />
      <div className="mb-4">
        <SegmentedControl<ReportStatus>
          label="Trạng thái báo cáo"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={STATUSES.map((s) => ({ value: s, label: REPORT_STATUS_LABELS[s], count: counts.data?.[s] }))}
        />
      </div>

      {error && <Callout tone="danger" className="mb-4">{error}</Callout>}

      {loading && !data ? (
        <ListSkeleton rows={3} />
      ) : !data?.data.length ? (
        <Card>
          <EmptyState icon={ClipboardCheck} title={status === 'pending' ? 'Không còn báo cáo chờ duyệt' : 'Chưa có báo cáo ở mục này'} description={status === 'pending' ? 'Báo cáo mới từ người dân sẽ xuất hiện ở đây.' : undefined} />
        </Card>
      ) : (
        <ul className="space-y-4">
          {data.data.map((r) => (
            <li key={r.id}>
              <ReportItem report={r} onReviewed={refresh} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={data} onChange={setPage} />
    </>
  );
}

function ReportItem({ report: r, onReviewed }: { report: Report; onReviewed: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (decision: 'approved' | 'rejected') => {
    setBusy(decision);
    setError(null);
    try {
      await api.patch(`/manage/reports/${r.id}/review`, { status: decision, review_note: note.trim() || null });
      toast.success(decision === 'approved' ? `Đã duyệt báo cáo #${r.id}, đang hiện trên bản đồ.` : `Đã từ chối báo cáo #${r.id}.`);
      onReviewed();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card flush>
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-900">#{r.id}</span>
            {r.type && <Badge tone="blue">{r.type.name}</Badge>}
            <ReportStatusBadge status={r.status} />
            {r.confirm_count > 0 && (
              <Badge tone="violet" icon={ThumbsUp}>
                {r.confirm_count} người cũng thấy
              </Badge>
            )}
            <span className="ml-auto text-xs text-slate-500" title={fmtDateTime(r.created_at)}>
              {timeAgo(r.created_at)}
            </span>
          </div>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800">{r.description}</p>
          {r.media_urls.length > 0 && <MediaGallery urls={r.media_urls} />}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              {r.user?.name ?? 'Ẩn danh'}
              {r.user?.phone && ` · ${r.user.phone}`}
            </span>
            <a className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline" target="_blank" rel="noreferrer" href={osmLink(r.lat, r.lng, 16)}>
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {r.region?.name ?? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 md:border-l md:border-t-0">
          {r.status === 'pending' ? (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">Ghi chú duyệt</span>
                <Textarea rows={3} maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: đã xác minh qua cán bộ phường" />
              </label>
              {error && <Callout tone="danger">{error}</Callout>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="success" icon={Check} loading={busy === 'approved'} disabled={!!busy} onClick={() => review('approved')}>
                  Duyệt
                </Button>
                <Button variant="secondary" icon={X} loading={busy === 'rejected'} disabled={!!busy} onClick={() => review('rejected')} className="!text-red-600">
                  Từ chối
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <p className="font-medium text-slate-700">Kết quả duyệt</p>
              <p className="mt-1 text-slate-600">{r.review_note || 'Không có ghi chú.'}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
