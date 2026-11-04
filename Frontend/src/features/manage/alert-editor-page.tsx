import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, Check, FileText, History, Info, Map as MapIcon, Megaphone, Save, Send, Sparkles, TriangleAlert } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { Alert, AlertArea, AlertVersion, DisasterEvent, Paginated } from '../../types/api';
import {
  AlertStatusBadge,
  Badge,
  Button,
  Callout,
  Card,
  DescriptionList,
  Field,
  Input,
  ListSkeleton,
  PageHeader,
  Select,
  SeverityBadge,
  Spinner,
  Textarea,
  useToast,
} from '../../components/ui';
import { SEVERITY_COLORS, fmtDateTime, fmtDistance, toLocalInput } from '../../utils/format';
import { AreaDrawer, isAreaComplete } from './area-drawer';
import { AlertActionButtons } from './alert-actions';
import { ActionDialog, FieldGroup, SeverityPicker, fromLocalInput } from './manage-ui';

interface FormState {
  title: string;
  description: string;
  instructions: string;
  disaster_type_id: string;
  disaster_event_id: string;
  region_id: string;
  severity: number;
  effective_from: string;
  effective_to: string;
  note: string;
}

const EMPTY: FormState = {
  title: '',
  description: '',
  instructions: '',
  disaster_type_id: '',
  disaster_event_id: '',
  region_id: '',
  severity: 3,
  effective_from: '',
  effective_to: '',
  note: '',
};

type Step = 'info' | 'area' | 'guide' | 'review';
const STEPS: { key: Step; label: string; icon: typeof Info }[] = [
  { key: 'info', label: 'Thông tin', icon: Info },
  { key: 'area', label: 'Vùng ảnh hưởng', icon: MapIcon },
  { key: 'guide', label: 'Hướng dẫn', icon: FileText },
  { key: 'review', label: 'Xem lại', icon: Check },
];

function areaFromAlert(a: Alert): AlertArea {
  if (a.area_type === 'circle' && a.center_lat !== null && a.center_lng !== null) {
    return { type: 'circle', center: { lat: a.center_lat, lng: a.center_lng }, radius_m: a.radius_m ?? 1000 };
  }
  const ring = a.area_geojson.coordinates[0] ?? [];
  return { type: 'polygon', coordinates: ring.slice(0, -1) };
}

export function AlertEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const { regions, types } = useCatalog();
  const events = useFetch(() => api.get<Paginated<DisasterEvent>>('/events', { status: 'ongoing', per_page: 100 }), []);
  const existing = useFetch(() => api.get<Alert>(`/alerts/${id}`), [id], !isNew);
  const versions = useFetch(() => api.get<AlertVersion[]>(`/manage/alerts/${id}/versions`), [id], !isNew);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [area, setArea] = useState<AlertArea>({ type: 'circle', center: { lat: 0, lng: 0 }, radius_m: 3000 });
  const [fitToken, setFitToken] = useState(0);
  const [step, setStep] = useState<Step>('info');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  useEffect(() => {
    const a = existing.data;
    if (!a) return;
    setForm({
      title: a.title,
      description: a.description ?? '',
      instructions: a.instructions ?? '',
      disaster_type_id: String(a.disaster_type_id),
      disaster_event_id: a.disaster_event_id ? String(a.disaster_event_id) : '',
      region_id: a.region_id ? String(a.region_id) : '',
      severity: a.severity,
      effective_from: toLocalInput(a.effective_from),
      effective_to: toLocalInput(a.effective_to),
      note: '',
    });
    setArea(areaFromAlert(a));
    setFitToken((t) => t + 1);
  }, [existing.data]);

  const alert = existing.data;
  const status = alert?.status;
  const readOnly = status === 'ended';
  const type = types.find((t) => String(t.id) === form.disaster_type_id);
  const valid: Record<Step, boolean> = {
    info: form.title.trim() !== '' && form.disaster_type_id !== '',
    area: isAreaComplete(area),
    guide: true,
    review: true,
  };
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const reachable = (i: number) => !isNew || STEPS.slice(0, i).every((s) => valid[s.key]);

  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Picking a disaster type pre-fills its template instructions when the field is still empty.
  const onTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const t = types.find((x) => String(x.id) === e.target.value);
    setForm((f) => ({ ...f, disaster_type_id: e.target.value, instructions: f.instructions || t?.default_instructions || '' }));
  };

  const body = () => ({
    ...form,
    disaster_type_id: Number(form.disaster_type_id),
    disaster_event_id: form.disaster_event_id ? Number(form.disaster_event_id) : null,
    region_id: form.region_id ? Number(form.region_id) : null,
    effective_from: fromLocalInput(form.effective_from),
    effective_to: fromLocalInput(form.effective_to),
    note: form.note || null,
    area,
  });

  const firstInvalid = (): Step | null => (STEPS.find((s) => !valid[s.key])?.key ?? null);

  const save = async (then?: 'submit' | 'publish') => {
    const bad = firstInvalid();
    if (bad) {
      setStep(bad);
      setError(bad === 'area' ? 'Hãy vẽ vùng ảnh hưởng trên bản đồ.' : 'Hãy nhập tiêu đề và chọn loại thiên tai.');
      return;
    }
    setBusy(then ?? 'save');
    setError(null);
    try {
      if (isNew) {
        const created = await api.post<Alert>('/manage/alerts', body());
        if (then) await api.post(`/manage/alerts/${created.id}/${then}`);
        toast.success(then === 'publish' ? 'Đã phát hành cảnh báo. Người dân trong vùng đang nhận thông báo.' : then === 'submit' ? 'Đã tạo và gửi duyệt cảnh báo.' : 'Đã lưu bản nháp.');
        navigate(`/officer/alerts/${created.id}`, { replace: true });
      } else {
        await api.patch(`/manage/alerts/${id}`, body());
        toast.success(status === 'published' || status === 'updated' ? 'Đã cập nhật. Người dân trong vùng sẽ nhận bản mới.' : 'Đã lưu thay đổi.');
        setForm((f) => ({ ...f, note: '' }));
        existing.reload();
        versions.reload();
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
      setConfirmPublish(false);
    }
  };

  if (!isNew && existing.loading && !alert) return <Spinner />;
  if (!isNew && existing.error && !alert) return <Callout tone="danger">{existing.error}</Callout>;

  const color = SEVERITY_COLORS[form.severity] ?? '#ef4444';

  return (
    <>
      <PageHeader
        back={{ to: '/officer/alerts', label: 'Danh sách cảnh báo' }}
        title={isNew ? 'Tạo cảnh báo mới' : alert?.title}
        eyebrow={
          alert && (
            <div className="flex flex-wrap items-center gap-1.5">
              <AlertStatusBadge status={alert.status} />
              <Badge tone="slate">Phiên bản {alert.version}</Badge>
              {alert.source === 'auto' && (
                <Badge tone="amber" icon={Bot}>
                  Đề xuất tự động
                </Badge>
              )}
            </div>
          )
        }
        actions={
          alert && (
            <AlertActionButtons
              alert={alert}
              size="md"
              onDone={(action) => {
                if (action === 'delete') navigate('/officer/alerts', { replace: true });
                else {
                  existing.reload();
                  versions.reload();
                }
              }}
            />
          )
        }
      />

      {readOnly && (
        <Callout tone="info" className="mb-4" title="Cảnh báo đã kết thúc">
          Nội dung chỉ để tra cứu. Tạo cảnh báo mới nếu tình hình diễn biến trở lại.
        </Callout>
      )}
      {alert?.source === 'auto' && status === 'pending' && (
        <Callout tone="warning" icon={Bot} className="mb-4" title="Hệ thống đề xuất từ dữ liệu dự báo mưa">
          Kiểm tra vùng ảnh hưởng và mức độ trước khi phát hành.
        </Callout>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <ol className="grid grid-cols-[repeat(4,auto)] justify-between gap-1 rounded-2xl sm:grid-cols-4 border border-slate-200/80 bg-white p-1.5 shadow-card">
            {STEPS.map((s, i) => {
              const active = s.key === step;
              const done = valid[s.key] && i < stepIndex;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    disabled={!reachable(i)}
                    onClick={() => setStep(s.key)}
                    aria-current={active ? 'step' : undefined}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${active ? 'bg-white/20' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>
                      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                    </span>
                    <span className={active ? 'truncate' : 'hidden sm:inline'}>{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {error && <Callout tone="danger">{error}</Callout>}

          <fieldset disabled={readOnly} className="min-w-0">
            {step === 'info' && (
              <Card title="Thông tin cảnh báo" description="Tiêu đề ngắn gọn, nêu rõ loại thiên tai và địa danh.">
                <div className="space-y-4">
                  <Field label="Tiêu đề" required>
                    <Input maxLength={255} value={form.title} onChange={set('title')} placeholder="Ví dụ: Cảnh báo ngập lụt phường Ngọc Hiệp" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Loại thiên tai" required>
                      <Select value={form.disaster_type_id} onChange={onTypeChange}>
                        <option value="">Chọn loại thiên tai</option>
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Khu vực">
                      <Select value={form.region_id} onChange={set('region_id')}>
                        <option value="">Toàn quốc</option>
                        {regions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <FieldGroup label="Mức độ nguy hiểm" hint="Mức 4-5 gửi thêm email cho người dân trong vùng.">
                    <SeverityPicker value={form.severity} onChange={(v) => setForm((f) => ({ ...f, severity: v }))} disabled={readOnly} />
                  </FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Thuộc sự kiện" className="sm:col-span-1">
                      <Select value={form.disaster_event_id} onChange={set('disaster_event_id')}>
                        <option value="">Không gắn sự kiện</option>
                        {events.data?.data.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Hiệu lực từ">
                      <Input type="datetime-local" value={form.effective_from} onChange={set('effective_from')} />
                    </Field>
                    <Field label="Hiệu lực đến">
                      <Input type="datetime-local" value={form.effective_to} onChange={set('effective_to')} />
                    </Field>
                  </div>
                  <Field label="Mô tả tình hình">
                    <Textarea rows={4} value={form.description} onChange={set('description')} placeholder="Diễn biến, mực nước, khu vực trọng điểm..." />
                  </Field>
                </div>
              </Card>
            )}

            {step === 'area' && (
              <Card title="Vùng ảnh hưởng" description="Chỉ người có vị trí quan tâm nằm trong vùng này mới nhận thông báo.">
                <AreaDrawer value={area} onChange={readOnly ? () => {} : setArea} color={color} readOnly={readOnly} fitToken={fitToken} />
              </Card>
            )}

            {step === 'guide' && (
              <div className="grid gap-4 xl:grid-cols-2">
                <Card
                  title="Hướng dẫn hành động"
                  description="Người dân sẽ đọc nội dung này trên điện thoại. Viết từng bước, ngắn gọn."
                  actions={
                    type?.default_instructions && !readOnly ? (
                      <Button size="sm" variant="soft" icon={Sparkles} onClick={() => setForm((f) => ({ ...f, instructions: type.default_instructions ?? '' }))}>
                        Dùng mẫu {type.name.toLowerCase()}
                      </Button>
                    ) : undefined
                  }
                >
                  <Textarea rows={10} value={form.instructions} onChange={set('instructions')} placeholder="1. Di chuyển đồ đạc lên cao...&#10;2. Ngắt cầu dao điện..." />
                </Card>
                <Card title="Người dân sẽ thấy" description="Thông báo hiện trên điện thoại khi cảnh báo được phát hành">
                  <div className="overflow-hidden rounded-2xl text-white shadow-raised" style={{ backgroundColor: form.severity >= 4 ? '#dc2626' : '#f97316' }}>
                    <div className="flex gap-3 p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                        <TriangleAlert className="h-6 w-6" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-white/85">Cảnh báo trong khu vực của bạn · Mức {form.severity}</p>
                        <p className="mt-0.5 font-bold leading-snug">{form.title || 'Tiêu đề cảnh báo'}</p>
                        <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-white/90">{form.instructions || 'Hướng dẫn hành động sẽ hiện ở đây.'}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {step === 'review' && (
              <div className="space-y-4">
                <Card title="Kiểm tra trước khi lưu">
                  <DescriptionList
                    columns={3}
                    items={[
                      { label: 'Tiêu đề', value: form.title || <span className="text-red-600">Chưa nhập</span> },
                      { label: 'Loại thiên tai', value: type?.name ?? <span className="text-red-600">Chưa chọn</span> },
                      { label: 'Mức độ', value: <SeverityBadge level={form.severity} /> },
                      { label: 'Khu vực', value: regions.find((r) => String(r.id) === form.region_id)?.name ?? 'Toàn quốc' },
                      {
                        label: 'Vùng ảnh hưởng',
                        value: !isAreaComplete(area) ? (
                          <span className="text-red-600">Chưa vẽ</span>
                        ) : area.type === 'circle' ? (
                          `Bán kính ${fmtDistance(area.radius_m)}`
                        ) : (
                          `Đa giác ${area.coordinates.length} đỉnh`
                        ),
                      },
                      { label: 'Hiệu lực', value: form.effective_from || form.effective_to ? `${form.effective_from ? fmtDateTime(form.effective_from) : '...'} → ${form.effective_to ? fmtDateTime(form.effective_to) : '...'}` : 'Từ khi phát hành' },
                    ]}
                  />
                  {form.instructions ? (
                    <p className="mt-4 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{form.instructions}</p>
                  ) : (
                    <Callout tone="warning" className="mt-4">
                      Chưa có hướng dẫn hành động. Người dân cần biết phải làm gì.
                    </Callout>
                  )}
                </Card>
                <Card flush>
                  <AreaDrawer value={area} onChange={() => {}} color={color} readOnly className="h-64" />
                </Card>
                {!isNew && !readOnly && (
                  <Card>
                    <Field label="Ghi chú phiên bản" hint="Lưu kèm phiên bản mới, ví dụ: mở rộng vùng ngập sang phường Hoà Cường.">
                      <Input maxLength={255} value={form.note} onChange={set('note')} />
                    </Field>
                  </Card>
                )}
              </div>
            )}
          </fieldset>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card">
              <Button variant="ghost" icon={ArrowLeft} disabled={stepIndex === 0} onClick={() => setStep(STEPS[stepIndex - 1]!.key)}>
                Quay lại
              </Button>
              <div className="ml-auto flex flex-wrap gap-2">
                {step !== 'review' ? (
                  <>
                    {!isNew && (
                      <Button variant="secondary" icon={Save} loading={busy === 'save'} onClick={() => save()}>
                        Lưu thay đổi
                      </Button>
                    )}
                    <Button iconRight={ArrowRight} disabled={!valid[step]} onClick={() => setStep(STEPS[stepIndex + 1]!.key)}>
                      Tiếp tục
                    </Button>
                  </>
                ) : isNew ? (
                  <>
                    <Button variant="secondary" icon={Save} loading={busy === 'save'} disabled={!!busy} onClick={() => save()}>
                      Lưu nháp
                    </Button>
                    <Button variant="secondary" icon={Send} loading={busy === 'submit'} disabled={!!busy} onClick={() => save('submit')}>
                      Lưu và gửi duyệt
                    </Button>
                    <Button variant="danger" icon={Megaphone} disabled={!!busy} onClick={() => setConfirmPublish(true)}>
                      Phát hành ngay
                    </Button>
                  </>
                ) : (
                  <Button icon={Save} loading={busy === 'save'} onClick={() => save()}>
                    Lưu thay đổi
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {isNew ? (
            <Card title="Quy trình phát hành" icon={Info}>
              <ol className="space-y-3 text-sm">
                {[
                  ['Nháp', 'Chỉ cán bộ thấy, sửa tự do.'],
                  ['Chờ duyệt', 'Cán bộ khác kiểm tra rồi phát hành.'],
                  ['Phát hành', 'Gửi thông báo realtime cho người dân trong vùng.'],
                  ['Cập nhật', 'Sửa khi đang hiệu lực sẽ gửi lại bản mới.'],
                  ['Kết thúc', 'Gỡ khỏi bản đồ, lưu vào lịch sử.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                    <span>
                      <span className="font-semibold text-slate-900">{t}</span>
                      <span className="block text-slate-500">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : (
            <Card title="Lịch sử phiên bản" icon={History}>
              {versions.loading && !versions.data ? (
                <ListSkeleton rows={3} />
              ) : (
                <ol className="space-y-0">
                  {versions.data?.map((v, i, arr) => (
                    <li key={v.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < arr.length - 1 && <span className="absolute left-[11px] top-6 h-full w-0.5 bg-slate-200" aria-hidden />}
                      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">v{v.version}</span>
                      <div className="min-w-0 text-sm">
                        <AlertStatusBadge status={v.status} />
                        <p className="mt-1 text-xs text-slate-500">
                          {fmtDateTime(v.created_at)}
                          {v.editor && ` · ${v.editor.name}`}
                        </p>
                        {v.note && <p className="mt-1 text-slate-700">{v.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </aside>
      </div>

      <ActionDialog
        open={confirmPublish}
        title="Phát hành cảnh báo ngay?"
        description="Cảnh báo được lưu và gửi thông báo realtime đến mọi người có vị trí quan tâm trong vùng ảnh hưởng."
        confirmLabel="Lưu và phát hành"
        variant="danger"
        onClose={() => setConfirmPublish(false)}
        onConfirm={() => save('publish')}
      />
    </>
  );
}
