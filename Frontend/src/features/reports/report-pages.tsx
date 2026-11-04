import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Marker } from 'react-leaflet';
import {
  Camera,
  ChevronRight,
  Clock,
  FileText,
  Film,
  ImagePlus,
  Info,
  LocateFixed,
  MapPin,
  Megaphone,
  Plus,
  Send,
  ThumbsUp,
  UserRound,
  X,
} from 'lucide-react';
import { ApiError, api, errorText } from '../../services/api';
import { useAuth } from '../../store/auth-context';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import { useGeolocation, type LatLng } from '../../hooks/use-geolocation';
import type { Paginated, Report } from '../../types/api';
import { BaseMap, pinIcon } from '../../components/map/base-map';
import { LocationPicker } from '../../components/map/location-picker';
import {
  Badge,
  Button,
  Callout,
  Card,
  DescriptionList,
  EmptyState,
  Field,
  LinkButton,
  ListSkeleton,
  PageHeader,
  Pagination,
  ReportStatusBadge,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '../../components/ui';
import { fmtDateTime } from '../../utils/format';
import { compressImage } from '../../utils/compress-image';

const isVideo = (u: string) => /\.(mp4|mov)$/i.test(u);

export function MediaGallery({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!urls.length) return null;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {urls.map((u) =>
          isVideo(u) ? (
            <video key={u} src={u} controls preload="metadata" className="aspect-square w-full rounded-xl bg-slate-900 object-cover" />
          ) : (
            <button key={u} type="button" onClick={() => setOpen(u)} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100" aria-label="Xem ảnh lớn">
              <img src={u} alt="Ảnh hiện trường" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
            </button>
          ),
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label="Ảnh hiện trường">
          <img src={open} alt="Ảnh hiện trường" className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" onClick={() => setOpen(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Đóng">
            <X className="h-6 w-6" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}

function ReportThumb({ report }: { report: Report }) {
  const img = report.media_urls.find((u) => !isVideo(u));
  const video = report.media_urls.find(isVideo);
  if (img) return <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />;
  return (
    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-50 to-slate-100 text-violet-400">
      {video ? <Film className="h-8 w-8" aria-hidden /> : <Megaphone className="h-8 w-8" aria-hidden />}
    </span>
  );
}

function ReportCard({ report, showStatus }: { report: Report; showStatus?: boolean }) {
  return (
    <Link to={`/reports/${report.id}`} className="group flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card transition hover:shadow-raised">
      <span className="relative h-auto w-28 shrink-0 overflow-hidden sm:w-36">
        <ReportThumb report={report} />
        {report.media_urls.length > 1 && (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">+{report.media_urls.length - 1}</span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {report.type && <Badge tone="violet">{report.type.name}</Badge>}
          {showStatus && <ReportStatusBadge status={report.status} />}
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-800">{report.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-slate-500">
          {report.user && !showStatus && (
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              {report.user.name}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {fmtDateTime(report.created_at)}
          </span>
          {report.status === 'approved' && (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
              {report.confirm_count}
            </span>
          )}
          <ChevronRight className="ml-auto h-4 w-4 text-slate-300 group-hover:text-slate-500" aria-hidden />
        </div>
      </div>
    </Link>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const { types } = useCatalog();
  const geo = useGeolocation();
  const [typeId, setTypeId] = useState('');
  const [near, setNear] = useState(false);
  const [page, setPage] = useState(1);
  const point = near ? geo.position : null;
  const { data, error, loading } = useFetch(
    () => api.get<Paginated<Report>>('/reports', { disaster_type_id: typeId, page, ...(point ? { lat: point.lat, lng: point.lng, radius_km: 10 } : {}) }),
    [typeId, page, point?.lat, point?.lng],
    !near || !!point,
  );

  const toggleNear = async () => {
    setPage(1);
    if (near) return setNear(false);
    try {
      await geo.locate();
      setNear(true);
    } catch {
      // geo.error is shown below
    }
  };

  const chip = (active: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`;

  return (
    <>
      <PageHeader
        title="Báo cáo từ cộng đồng"
        description="Tình hình thực tế do người dân gửi về, đã được cán bộ địa phương xác minh."
        actions={
          <>
            {user && (
              <LinkButton to="/me/reports" variant="secondary" icon={FileText}>
                Báo cáo của tôi
              </LinkButton>
            )}
            <LinkButton to="/reports/new" icon={Plus}>
              Gửi báo cáo
            </LinkButton>
          </>
        }
      />

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        <button type="button" onClick={toggleNear} className={chip(near)} aria-pressed={near}>
          <LocateFixed className="h-4 w-4" aria-hidden />
          {geo.locating ? 'Đang định vị...' : 'Gần tôi (10 km)'}
        </button>
        <span className="mx-1 w-px shrink-0 bg-slate-200" aria-hidden />
        <button type="button" onClick={() => { setTypeId(''); setPage(1); }} className={chip(typeId === '')} aria-pressed={typeId === ''}>
          Tất cả
        </button>
        {types.map((t) => (
          <button key={t.id} type="button" onClick={() => { setTypeId(String(t.id)); setPage(1); }} className={chip(typeId === String(t.id))} aria-pressed={typeId === String(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      {geo.error && near === false && <Callout tone="warning" className="mb-4">{geo.error}</Callout>}
      {error && <Callout tone="danger" className="mb-4">{error}</Callout>}

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : data && data.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="Chưa có báo cáo nào"
            description={near ? 'Không có báo cáo đã duyệt trong bán kính 10 km quanh bạn.' : 'Chưa có báo cáo đã duyệt cho bộ lọc này.'}
            action={<LinkButton to="/reports/new" icon={Plus}>Gửi báo cáo đầu tiên</LinkButton>}
          />
        </Card>
      ) : (
        <div className={`grid gap-4 md:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
          {data?.data.map((r) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
      <Pagination page={data} onChange={setPage} />
    </>
  );
}

export function ReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data: r, error, loading, setData } = useFetch(() => api.get<Report>(`/reports/${id}`), [id]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ confirm_count: number }>(`/reports/${id}/confirm`);
      setData((prev) => (prev ? { ...prev, confirm_count: res.confirm_count } : prev));
      setConfirmed(true);
      toast.success('Cảm ơn bạn đã xác nhận, báo cáo đáng tin cậy hơn.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConfirmed(true);
        toast.info('Bạn đã xác nhận báo cáo này trước đó.');
      } else toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  if (error || !r) {
    return (
      <Card>
        <EmptyState
          icon={Megaphone}
          title="Không tìm thấy báo cáo"
          description="Báo cáo không tồn tại hoặc chưa được cán bộ duyệt."
          action={<LinkButton to="/reports" variant="secondary">Về danh sách báo cáo</LinkButton>}
        />
      </Card>
    );
  }

  const own = user?.id === r.user_id;

  return (
    <>
      <PageHeader
        back={{ to: own ? '/me/reports' : '/reports', label: own ? 'Báo cáo của tôi' : 'Báo cáo cộng đồng' }}
        eyebrow={
          <div className="flex flex-wrap gap-1.5">
            {r.type && <Badge tone="violet">{r.type.name}</Badge>}
            <ReportStatusBadge status={r.status} />
          </div>
        }
        title={r.type ? `Báo cáo ${r.type.name.toLowerCase()}` : 'Báo cáo sự cố'}
        description={`${r.user?.name ?? 'Người dân'} · ${fmtDateTime(r.created_at)}`}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {own && r.status === 'pending' && <Callout tone="info" title="Đang chờ cán bộ duyệt">Báo cáo sẽ hiển thị công khai trên bản đồ sau khi được duyệt.</Callout>}
          {own && r.status === 'rejected' && (
            <Callout tone="warning" title="Báo cáo không được duyệt">
              {r.review_note ?? 'Cán bộ không thể xác minh thông tin trong báo cáo.'}
            </Callout>
          )}
          <Card title="Mô tả">
            <p className="whitespace-pre-line text-slate-800">{r.description}</p>
            {r.media_urls.length > 0 && (
              <div className="mt-4">
                <MediaGallery urls={r.media_urls} />
              </div>
            )}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <DescriptionList
                items={[
                  { label: 'Khu vực', value: r.region?.name ?? 'Chưa xác định' },
                  { label: 'Tọa độ', value: `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` },
                  ...(r.review_note && r.status === 'approved' ? [{ label: 'Ghi chú của cán bộ', value: r.review_note }] : []),
                ]}
              />
            </div>
          </Card>

          {r.status === 'approved' && (
            <Card>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <ThumbsUp className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-bold tabular-nums text-slate-900">{r.confirm_count}</p>
                  <p className="text-sm text-slate-500">người cũng thấy tình trạng này</p>
                </div>
                {!user && (
                  <LinkButton to="/login" state={{ from: `/reports/${r.id}` }} variant="secondary">
                    Đăng nhập để xác nhận
                  </LinkButton>
                )}
                {user && !own && (
                  <Button size="lg" icon={ThumbsUp} onClick={confirm} loading={busy} disabled={confirmed} variant={confirmed ? 'secondary' : 'primary'}>
                    {confirmed ? 'Đã xác nhận' : 'Tôi cũng thấy'}
                  </Button>
                )}
                {own && <span className="text-sm text-slate-500">Báo cáo của bạn</span>}
              </div>
            </Card>
          )}
        </div>
        <Card title="Vị trí sự cố" icon={MapPin} flush className="lg:sticky lg:top-24 lg:self-start">
          <BaseMap center={[r.lat, r.lng]} zoom={15} className="h-80 rounded-none border-0 lg:h-[26rem]">
            <Marker position={[r.lat, r.lng]} icon={pinIcon('#7c3aed')} />
          </BaseMap>
        </Card>
      </div>
    </>
  );
}

interface Picked {
  file: File;
  url: string;
}

const MAX_FILES = 5;

export function NewReportPage() {
  const { types } = useCatalog();
  const navigate = useNavigate();
  const toast = useToast();
  const geo = useGeolocation();
  const [typeId, setTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [files, setFiles] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { locate } = geo;

  useEffect(() => {
    locate()
      .then((p) => setPoint((cur) => cur ?? p))
      .catch(() => {});
  }, [locate]);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const addFiles = (list: FileList | null) => {
    const incoming = Array.from(list ?? []).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFiles((cur) => [...cur, ...incoming].slice(0, MAX_FILES));
  };

  const selectedType = useMemo(() => types.find((t) => String(t.id) === typeId), [types, typeId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!typeId) return setError('Chọn loại sự cố.');
    if (!point) return setError('Chọn vị trí sự cố trên bản đồ hoặc dùng vị trí hiện tại.');
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('disaster_type_id', typeId);
      form.append('description', description);
      form.append('lat', String(point.lat));
      form.append('lng', String(point.lng));
      const prepared = await Promise.all(files.map((f) => compressImage(f.file)));
      prepared.forEach((f) => form.append('media[]', f));
      const report = await api.post<Report>('/reports', form);
      toast.success('Đã gửi báo cáo. Cán bộ sẽ xác minh và hiển thị trên bản đồ.');
      navigate(`/reports/${report.id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: '/reports', label: 'Báo cáo cộng đồng' }}
        title="Báo cáo sự cố"
        description="Ảnh và vị trí chính xác giúp cán bộ xác minh nhanh và cảnh báo cho mọi người xung quanh."
      />
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card title="Chuyện gì đang xảy ra?">
            <div className="space-y-4">
              <Field label="Loại sự cố" required>
                <Select required value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                  <option value="">Chọn loại sự cố</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Mô tả" required hint={`${description.length}/2000 ký tự`}>
                <Textarea
                  rows={5}
                  required
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={selectedType ? `Mô tả tình hình ${selectedType.name.toLowerCase()}: mức độ, đường bị chia cắt, người cần hỗ trợ...` : 'Mực nước, đường bị chia cắt, số người cần hỗ trợ...'}
                />
              </Field>
            </div>
          </Card>

          <Card title="Ảnh / video" description={`Tối đa ${MAX_FILES} tệp. Ảnh được nén trên máy trước khi gửi.`} icon={Camera}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {files.map((f, i) => (
                <div key={f.url} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                  {f.file.type.startsWith('video/') ? (
                    <span className="flex h-full w-full items-center justify-center text-slate-500">
                      <Film className="h-7 w-7" aria-hidden />
                    </span>
                  ) : (
                    <img src={f.url} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => setFiles((cur) => cur.filter((x) => x.url !== f.url))}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                    aria-label={`Bỏ tệp ${f.file.name}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
              {files.length < MAX_FILES && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700">
                  <ImagePlus className="h-6 w-6" aria-hidden />
                  <span className="text-xs font-semibold">Thêm</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                    className="sr-only"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Vị trí sự cố" icon={MapPin} description="Mặc định là vị trí hiện tại. Bấm lên bản đồ nếu sự cố ở chỗ khác.">
            <LocationPicker value={point} onChange={setPoint} className="h-80" />
          </Card>
          <Callout tone="info" icon={Info}>
            Báo cáo hiển thị công khai sau khi cán bộ duyệt. Mỗi tài khoản gửi tối đa 10 báo cáo mỗi giờ.
          </Callout>
          {error && <Callout tone="danger">{error}</Callout>}
          <Button type="submit" size="lg" block icon={Send} loading={busy}>
            Gửi báo cáo
          </Button>
        </div>
      </form>
    </>
  );
}

export function MyReportsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useFetch(() => api.get<Paginated<Report>>('/me/reports', { page }), [page]);

  return (
    <>
      <PageHeader
        title="Báo cáo của tôi"
        description="Theo dõi trạng thái duyệt các báo cáo bạn đã gửi."
        actions={
          <LinkButton to="/reports/new" icon={Plus}>
            Gửi báo cáo
          </LinkButton>
        }
      />
      {error && <Callout tone="danger" className="mb-4">{error}</Callout>}
      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : data && data.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Bạn chưa gửi báo cáo nào"
            description="Thấy ngập lụt, sạt lở hay cây đổ? Gửi ảnh và vị trí để cán bộ cảnh báo kịp thời cho mọi người."
            action={<LinkButton to="/reports/new" icon={Plus}>Gửi báo cáo đầu tiên</LinkButton>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.data.map((r) => <ReportCard key={r.id} report={r} showStatus />)}
        </div>
      )}
      <Pagination page={data} onChange={setPage} />
    </>
  );
}
