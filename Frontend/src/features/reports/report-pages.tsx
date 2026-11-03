import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Marker } from 'react-leaflet';
import { ApiError, api, errorText } from '../../services/api';
import { useAuth } from '../../store/auth-context';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { Paginated, Report } from '../../types/api';
import type { LatLng } from '../../hooks/use-geolocation';
import { BaseMap, pinIcon } from '../../components/map/base-map';
import { LocationPicker } from '../../components/map/location-picker';
import { Badge, Button, Card, Empty, ErrorBox, Field, PageTitle, Pagination, Spinner, SuccessBox, inputClass } from '../../components/ui';
import { REPORT_STATUS_LABELS, fmtDateTime } from '../../utils/format';
import { compressImage } from '../../utils/compress-image';

export function MediaGallery({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u) =>
        /\.(mp4|mov)$/i.test(u) ? (
          <video key={u} src={u} controls className="h-32 rounded-lg" />
        ) : (
          <a key={u} href={u} target="_blank" rel="noreferrer">
            <img src={u} alt="Ảnh hiện trường" loading="lazy" className="h-32 w-32 rounded-lg object-cover" />
          </a>
        ),
      )}
    </div>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const { types } = useCatalog();
  const [typeId, setTypeId] = useState('');
  const [page, setPage] = useState(1);
  const [mine, setMine] = useState(false);
  const { data, error, loading } = useFetch(
    () => (mine ? api.get<Paginated<Report>>('/me/reports', { page }) : api.get<Paginated<Report>>('/reports', { disaster_type_id: typeId, page })),
    [typeId, page, mine],
  );

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap gap-2">
            {user && (
              <Button variant="secondary" onClick={() => { setMine((m) => !m); setPage(1); }}>
                {mine ? 'Báo cáo công khai' : 'Báo cáo của tôi'}
              </Button>
            )}
            <Link to="/reports/new" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + Gửi báo cáo
            </Link>
          </div>
        }
      >
        {mine ? 'Báo cáo của tôi' : 'Báo cáo từ người dân'}
      </PageTitle>
      {!mine && (
        <select className={`${inputClass} mb-4 max-w-xs`} aria-label="Loại sự cố" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Mọi loại sự cố</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <ErrorBox message={error} />
      {loading && !data && <Spinner />}
      {data && !data.data.length && <Empty />}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.data.map((r) => (
          <Link key={r.id} to={`/reports/${r.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500">
            <div className="flex flex-wrap items-center gap-2">
              {r.type && <Badge tone="blue">{r.type.name}</Badge>}
              <Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{REPORT_STATUS_LABELS[r.status]}</Badge>
              <span className="text-xs text-slate-500">👀 {r.confirm_count}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-slate-800">{r.description}</p>
            <p className="mt-1 text-xs text-slate-500">
              {r.user?.name ?? 'Ẩn danh'} · {fmtDateTime(r.created_at)}
            </p>
          </Link>
        ))}
      </div>
      <Pagination page={data} onChange={setPage} />
    </>
  );
}

export function ReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: r, error, loading, setData } = useFetch(() => api.get<Report>(`/reports/${id}`), [id]);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const confirm = async () => {
    setConfirmError(null);
    try {
      const res = await api.post<{ confirm_count: number }>(`/reports/${id}/confirm`);
      setData((prev) => (prev ? { ...prev, confirm_count: res.confirm_count } : prev));
      setMsg('Cảm ơn bạn đã xác nhận.');
    } catch (err) {
      setConfirmError(err instanceof ApiError && err.status === 409 ? 'Bạn đã xác nhận báo cáo này.' : errorText(err));
    }
  };

  if (loading) return <Spinner />;
  if (error || !r) return <ErrorBox message={error ?? 'Không tìm thấy báo cáo.'} />;

  return (
    <div className="space-y-4">
      <Link to="/reports" className="text-sm text-brand-600 hover:underline">
        ← Danh sách báo cáo
      </Link>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            {r.type && <Badge tone="blue">{r.type.name}</Badge>}
            <Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{REPORT_STATUS_LABELS[r.status]}</Badge>
          </div>
          <p className="mt-3 whitespace-pre-line text-slate-800">{r.description}</p>
          <p className="mt-2 text-xs text-slate-500">
            {r.user?.name ?? 'Ẩn danh'} · {r.region?.name ?? ''} · {fmtDateTime(r.created_at)}
          </p>
          {r.review_note && <p className="mt-2 text-sm text-slate-600">Ghi chú duyệt: {r.review_note}</p>}
          <div className="mt-3">
            <MediaGallery urls={r.media_urls} />
          </div>
          {r.status === 'approved' && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm">👀 {r.confirm_count} người cũng thấy</span>
              {user && user.id !== r.user_id && <Button onClick={confirm}>Tôi cũng thấy</Button>}
              {!user && (
                <Link to="/login" className="text-sm text-brand-600 hover:underline">
                  Đăng nhập để xác nhận
                </Link>
              )}
            </div>
          )}
          <div className="mt-2 space-y-2">
            <SuccessBox message={msg} />
            <ErrorBox message={confirmError} />
          </div>
        </Card>
        <BaseMap center={[r.lat, r.lng]} zoom={15} className="h-80">
          <Marker position={[r.lat, r.lng]} icon={pinIcon('#9333ea')} />
        </BaseMap>
      </div>
    </div>
  );
}

export function NewReportPage() {
  const { types } = useCatalog();
  const navigate = useNavigate();
  const [typeId, setTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!point) return setError('Vui lòng chọn vị trí trên bản đồ.');
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('disaster_type_id', typeId);
      form.append('description', description);
      form.append('lat', String(point.lat));
      form.append('lng', String(point.lng));
      const prepared = await Promise.all(files.map(compressImage));
      prepared.forEach((f) => form.append('media[]', f));
      const report = await api.post<Report>('/reports', form);
      navigate(`/reports/${report.id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle>Gửi báo cáo tình hình</PageTitle>
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="space-y-3">
            <Field label="Loại sự cố">
              <select className={inputClass} required value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">-- Chọn --</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mô tả">
              <textarea className={inputClass} rows={5} required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mực nước, đường bị chia cắt, số người cần hỗ trợ..." />
            </Field>
            <Field label="Ảnh / video (tối đa 5)" hint="Ảnh được nén trên trình duyệt trước khi tải lên.">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
                className="text-sm"
              />
            </Field>
            <ErrorBox message={error} />
            <p className="text-xs text-slate-500">Báo cáo sẽ hiển thị công khai sau khi cán bộ duyệt.</p>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </div>
        </Card>
        <Card title="Vị trí sự cố">
          <LocationPicker value={point} onChange={setPoint} className="h-96" />
        </Card>
      </form>
    </>
  );
}
