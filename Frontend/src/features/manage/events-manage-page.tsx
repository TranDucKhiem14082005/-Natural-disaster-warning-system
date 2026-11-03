import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../../services/api';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { LatLng } from '../../hooks/use-geolocation';
import type { DisasterEvent, Paginated } from '../../types/api';
import { LocationPicker } from '../../components/map/location-picker';
import { Badge, Button, Card, ErrorBox, Field, Pagination, SeverityBadge, inputClass } from '../../components/ui';
import { fmtDateTime } from '../../utils/format';

export function EventsManagePage() {
  const { regions, types } = useCatalog();
  const [page, setPage] = useState(1);
  const list = useFetch(() => api.get<Paginated<DisasterEvent>>('/events', { page }), [page]);
  const [form, setForm] = useState({ name: '', disaster_type_id: '', region_id: '', severity: 3, description: '', started_at: '' });
  const [point, setPoint] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/manage/events', {
        ...form,
        disaster_type_id: Number(form.disaster_type_id),
        region_id: form.region_id ? Number(form.region_id) : null,
        lat: point?.lat,
        lng: point?.lng,
      });
      setForm({ name: '', disaster_type_id: '', region_id: '', severity: 3, description: '', started_at: '' });
      setPoint(null);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const end = async (ev: DisasterEvent) => {
    if (!window.confirm(`Kết thúc sự kiện "${ev.name}"?`)) return;
    try {
      await api.patch(`/manage/events/${ev.id}`, { status: 'ended' });
      list.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Sự kiện">
        <ErrorBox message={list.error} />
        <ul className="divide-y divide-slate-100">
          {list.data?.data.map((ev) => (
            <li key={ev.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <Link to={`/events/${ev.id}`} className="font-medium hover:underline">
                  {ev.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {ev.type?.name} · {fmtDateTime(ev.started_at)} · {ev.alerts_count} cảnh báo
                </p>
              </div>
              <SeverityBadge level={ev.severity} />
              {ev.status === 'ongoing' ? (
                <Button variant="secondary" onClick={() => end(ev)}>
                  Kết thúc
                </Button>
              ) : (
                <Badge>Đã kết thúc</Badge>
              )}
            </li>
          ))}
        </ul>
        <Pagination page={list.data} onChange={setPage} />
      </Card>
      <Card title="Tạo sự kiện mới">
        <form onSubmit={create} className="space-y-3">
          <Field label="Tên sự kiện">
            <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <select className={inputClass} required aria-label="Loại" value={form.disaster_type_id} onChange={(e) => setForm({ ...form, disaster_type_id: e.target.value })}>
              <option value="">Loại...</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className={inputClass} aria-label="Khu vực" value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
              <option value="">Toàn quốc</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className={inputClass} aria-label="Mức độ" value={form.severity} onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>Mức {s}</option>)}
            </select>
          </div>
          <Field label="Bắt đầu">
            <input type="datetime-local" className={inputClass} required value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })} />
          </Field>
          <Field label="Mô tả">
            <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <LocationPicker value={point} onChange={setPoint} className="h-56" />
          <ErrorBox message={error} />
          <Button type="submit" className="w-full">
            Tạo sự kiện
          </Button>
        </form>
      </Card>
    </div>
  );
}
