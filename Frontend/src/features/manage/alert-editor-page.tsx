import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorText } from '../../services/api';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { Alert, AlertArea, AlertVersion, DisasterEvent, Paginated } from '../../types/api';
import { Badge, Button, Card, ErrorBox, Field, Spinner, SuccessBox, inputClass } from '../../components/ui';
import { ALERT_STATUS_LABELS, SEVERITY_COLORS, SEVERITY_LABELS, fmtDateTime, toLocalInput } from '../../utils/format';
import { AreaDrawer, isAreaComplete } from './area-drawer';

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
  const { regions, types } = useCatalog();
  const events = useFetch(() => api.get<Paginated<DisasterEvent>>('/events', { status: 'ongoing', per_page: 100 }), []);
  const existing = useFetch(() => api.get<Alert>(`/alerts/${id}`), [id], !isNew);
  const versions = useFetch(() => api.get<AlertVersion[]>(`/manage/alerts/${id}/versions`), [id], !isNew);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [area, setArea] = useState<AlertArea>({ type: 'polygon', coordinates: [] });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  }, [existing.data]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'severity' ? Number(e.target.value) : e.target.value }));

  // Picking a disaster type pre-fills its template instructions when the field is still empty.
  const onTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = types.find((t) => String(t.id) === e.target.value);
    setForm((f) => ({ ...f, disaster_type_id: e.target.value, instructions: f.instructions || type?.default_instructions || '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAreaComplete(area)) return setError('Vẽ vùng ảnh hưởng trên bản đồ (ít nhất 3 điểm hoặc đặt tâm).');
    setBusy(true);
    setError(null);
    setMsg(null);
    const body = {
      ...form,
      disaster_type_id: Number(form.disaster_type_id),
      disaster_event_id: form.disaster_event_id ? Number(form.disaster_event_id) : null,
      region_id: form.region_id ? Number(form.region_id) : null,
      effective_from: form.effective_from || null,
      effective_to: form.effective_to || null,
      note: form.note || null,
      area,
    };
    try {
      if (isNew) {
        const created = await api.post<Alert>('/manage/alerts', body);
        navigate(`/manage/alerts/${created.id}`, { replace: true });
      } else {
        await api.patch(`/manage/alerts/${id}`, body);
        setMsg('Đã lưu. Nếu cảnh báo đang hiệu lực, người dân trong vùng sẽ nhận bản cập nhật.');
        existing.reload();
        versions.reload();
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const transition = async (action: 'submit' | 'publish' | 'end') => {
    setError(null);
    try {
      await api.post(`/manage/alerts/${id}/${action}`);
      existing.reload();
      versions.reload();
      setMsg(action === 'publish' ? 'Đã phát hành cảnh báo.' : 'Đã cập nhật trạng thái.');
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (!isNew && existing.loading && !existing.data) return <Spinner />;
  const status = existing.data?.status;
  const ended = status === 'ended';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/manage/alerts" className="text-sm text-brand-600 hover:underline">
          ← Danh sách
        </Link>
        <h2 className="text-xl font-bold text-slate-900">{isNew ? 'Tạo cảnh báo' : `Sửa cảnh báo #${id}`}</h2>
        {status && <Badge tone="blue">{ALERT_STATUS_LABELS[status]}</Badge>}
        {!isNew && (
          <div className="ml-auto flex gap-2">
            {status === 'draft' && <Button variant="secondary" onClick={() => transition('submit')}>Gửi duyệt</Button>}
            {(status === 'draft' || status === 'pending') && <Button onClick={() => transition('publish')}>Phát hành</Button>}
            {(status === 'published' || status === 'updated') && <Button variant="danger" onClick={() => transition('end')}>Kết thúc</Button>}
          </div>
        )}
      </div>
      <ErrorBox message={error ?? existing.error} />
      <SuccessBox message={msg} />

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <fieldset disabled={ended} className="space-y-3">
            <Field label="Tiêu đề">
              <input className={inputClass} required maxLength={255} value={form.title} onChange={set('title')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Loại thiên tai">
                <select className={inputClass} required value={form.disaster_type_id} onChange={onTypeChange}>
                  <option value="">-- Chọn --</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Khu vực">
                <select className={inputClass} value={form.region_id} onChange={set('region_id')}>
                  <option value="">Toàn quốc</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={`Mức độ: ${form.severity} - ${SEVERITY_LABELS[form.severity]}`}>
              <input type="range" min={1} max={5} className="w-full" style={{ accentColor: SEVERITY_COLORS[form.severity] }} value={form.severity} onChange={set('severity')} />
            </Field>
            <Field label="Thuộc sự kiện">
              <select className={inputClass} value={form.disaster_event_id} onChange={set('disaster_event_id')}>
                <option value="">Không</option>
                {events.data?.data.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mô tả">
              <textarea className={inputClass} rows={3} value={form.description} onChange={set('description')} />
            </Field>
            <Field label="Hướng dẫn hành động" hint="Tự điền theo mẫu của loại thiên tai.">
              <textarea className={inputClass} rows={3} value={form.instructions} onChange={set('instructions')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hiệu lực từ">
                <input type="datetime-local" className={inputClass} value={form.effective_from} onChange={set('effective_from')} />
              </Field>
              <Field label="Hiệu lực đến">
                <input type="datetime-local" className={inputClass} value={form.effective_to} onChange={set('effective_to')} />
              </Field>
            </div>
            {!isNew && (
              <Field label="Ghi chú phiên bản">
                <input className={inputClass} maxLength={255} value={form.note} onChange={set('note')} placeholder="Ví dụ: mở rộng vùng ngập" />
              </Field>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Đang lưu...' : isNew ? 'Lưu nháp' : 'Lưu thay đổi'}
            </Button>
          </fieldset>
        </Card>
        <div className="space-y-4 lg:col-span-3">
          <Card title="Vùng ảnh hưởng">
            <AreaDrawer value={area} onChange={ended ? () => {} : setArea} color={SEVERITY_COLORS[form.severity] ?? '#ef4444'} />
          </Card>
          {!isNew && (
            <Card title="Lịch sử phiên bản">
              <ol className="space-y-2 text-sm">
                {versions.data?.map((v) => (
                  <li key={v.id} className="flex flex-wrap gap-2 border-l-2 border-brand-500 pl-3">
                    <strong>v{v.version}</strong>
                    <Badge>{ALERT_STATUS_LABELS[v.status]}</Badge>
                    <span className="text-slate-500">{fmtDateTime(v.created_at)}</span>
                    <span className="text-slate-500">{v.editor?.name}</span>
                    {v.note && <span className="w-full text-slate-700">{v.note}</span>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </form>
    </div>
  );
}
