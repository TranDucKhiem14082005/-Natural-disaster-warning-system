import { useState, type FormEvent } from 'react';
import { api, errorText } from '../../services/api';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { LatLng } from '../../hooks/use-geolocation';
import type { Amenity, Paginated, Shelter } from '../../types/api';
import { LocationPicker } from '../../components/map/location-picker';
import { Button, Card, ErrorBox, Field, inputBase, inputClass } from '../../components/ui';
import { AMENITY_LABELS } from '../../utils/format';

export function SheltersManagePage() {
  const list = useFetch(() => api.get<Paginated<Shelter>>('/shelters', { per_page: 100 }), []);
  const [error, setError] = useState<string | null>(null);

  const updateOccupancy = async (s: Shelter, value: number) => {
    setError(null);
    try {
      await api.patch(`/manage/shelters/${s.id}`, { current_occupancy: value });
      list.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const remove = async (s: Shelter) => {
    if (!window.confirm(`Xoá điểm trú ẩn "${s.name}"?`)) return;
    try {
      await api.delete(`/manage/shelters/${s.id}`);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Điểm trú ẩn · cập nhật số người">
        <ErrorBox message={error ?? list.error} />
        <ul className="divide-y divide-slate-100">
          {list.data?.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-slate-500">Sức chứa {s.capacity} · còn {s.available_slots}</p>
              </div>
              <label className="flex items-center gap-1 text-xs">
                Hiện có
                <input
                  type="number"
                  min={0}
                  max={s.capacity}
                  defaultValue={s.current_occupancy}
                  className={`${inputBase} w-24`}
                  onBlur={(e) => Number(e.target.value) !== s.current_occupancy && updateOccupancy(s, Number(e.target.value))}
                />
              </label>
              <Button variant="ghost" onClick={() => remove(s)} aria-label={`Xoá ${s.name}`}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <NewShelterForm onCreated={list.reload} />
    </div>
  );
}

function NewShelterForm({ onCreated }: { onCreated: () => void }) {
  const { regions } = useCatalog();
  const [form, setForm] = useState({ name: '', address: '', region_id: '', capacity: 100, contact_phone: '' });
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!point) return setError('Chọn vị trí trên bản đồ.');
    setError(null);
    try {
      await api.post('/manage/shelters', {
        ...form,
        region_id: form.region_id ? Number(form.region_id) : null,
        contact_phone: form.contact_phone || null,
        amenities,
        ...point,
      });
      setForm({ name: '', address: '', region_id: '', capacity: 100, contact_phone: '' });
      setAmenities([]);
      setPoint(null);
      onCreated();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Card title="Thêm điểm trú ẩn">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Tên">
          <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Địa chỉ">
          <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <select className={inputClass} aria-label="Khu vực" value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
            <option value="">Khu vực...</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className={inputClass} type="number" min={1} aria-label="Sức chứa" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          <input className={inputClass} type="tel" placeholder="SĐT" aria-label="Số điện thoại" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
        </div>
        <fieldset className="flex flex-wrap gap-3 text-sm">
          <legend className="mb-1 font-medium text-slate-700">Tiện ích</legend>
          {(Object.keys(AMENITY_LABELS) as Amenity[]).map((a) => (
            <label key={a} className="flex items-center gap-1">
              <input type="checkbox" checked={amenities.includes(a)} onChange={() => setAmenities((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]))} />
              {AMENITY_LABELS[a]}
            </label>
          ))}
        </fieldset>
        <LocationPicker value={point} onChange={setPoint} className="h-56" />
        <ErrorBox message={error} />
        <Button type="submit" className="w-full">
          Thêm
        </Button>
      </form>
    </Card>
  );
}
