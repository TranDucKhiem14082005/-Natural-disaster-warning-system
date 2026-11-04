import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Bath, Droplets, Hospital, Minus, Pencil, Plus, Tent, Trash2, Users, Utensils, Wifi, Zap, type LucideIcon } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { LatLng } from '../../hooks/use-geolocation';
import type { Amenity, Paginated, Shelter } from '../../types/api';
import { BaseMap, FitBounds, pinIcon } from '../../components/map/base-map';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  ListSkeleton,
  PageHeader,
  Select,
  StatCard,
  Table,
  Td,
  Th,
  ToggleChip,
  useToast,
} from '../../components/ui';
import { AMENITY_LABELS } from '../../utils/format';
import { ActionDialog, FieldGroup, MapPointPicker, OccupancyBar } from './manage-ui';

const AMENITY_ICONS: Record<Amenity, LucideIcon> = { water: Droplets, medical: Hospital, power: Zap, food: Utensils, toilet: Bath, wifi: Wifi };

function shelterColor(s: Shelter) {
  if (!s.is_active) return '#94a3b8';
  return s.available_slots <= 0 ? '#dc2626' : s.available_slots / s.capacity < 0.2 ? '#f59e0b' : '#16a34a';
}

export function SheltersManagePage() {
  const toast = useToast();
  const list = useFetch(() => api.get<Paginated<Shelter>>('/shelters', { per_page: 200 }), []);
  const [editing, setEditing] = useState<Shelter | 'new' | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const rows = list.data?.data ?? [];
  const bounds = useMemo(() => (list.data?.data.length ? list.data.data.map((s) => [s.lat, s.lng] as [number, number]) : null), [list.data?.data.length]);
  const totals = rows.reduce((t, s) => ({ capacity: t.capacity + s.capacity, occupied: t.occupied + s.current_occupancy, full: t.full + (s.available_slots <= 0 ? 1 : 0) }), { capacity: 0, occupied: 0, full: 0 });

  // Quick +/- 10 from the table: the common update during an evacuation.
  const bump = async (s: Shelter, delta: number) => {
    const value = Math.max(0, Math.min(s.capacity, s.current_occupancy + delta));
    if (value === s.current_occupancy) return;
    setBusyId(s.id);
    try {
      await api.patch(`/manage/shelters/${s.id}`, { current_occupancy: value });
      list.setData((prev) => prev && { ...prev, data: prev.data.map((x) => (x.id === s.id ? { ...x, current_occupancy: value, available_slots: x.capacity - value } : x)) });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Điểm trú ẩn"
        description="Cập nhật số người đang ở để hệ thống chỉ dẫn người dân tới nơi còn chỗ."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Thêm điểm trú ẩn
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Điểm trú ẩn" value={rows.length} icon={Tent} tone="blue" />
        <StatCard label="Tổng sức chứa" value={totals.capacity.toLocaleString('vi-VN')} icon={Users} />
        <StatCard label="Đang ở" value={totals.occupied.toLocaleString('vi-VN')} icon={Users} tone="amber" hint={totals.capacity ? `${Math.round((totals.occupied / totals.capacity) * 100)}% sức chứa` : undefined} />
        <StatCard label="Đã đầy" value={totals.full} icon={Tent} tone="red" />
      </div>

      {list.error && <Callout tone="danger" className="mb-4">{list.error}</Callout>}

      <div className="grid gap-5 xl:grid-cols-5">
        <Card flush className="xl:col-span-3">
          {list.loading && !list.data ? (
            <div className="p-4">
              <ListSkeleton rows={4} />
            </div>
          ) : !rows.length ? (
            <EmptyState icon={Tent} title="Chưa có điểm trú ẩn" description="Thêm trường học, nhà văn hoá... làm nơi sơ tán cho người dân." action={<Button variant="soft" icon={Plus} onClick={() => setEditing('new')}>Thêm điểm trú ẩn</Button>} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Điểm trú ẩn</Th>
                  <Th>Đang ở</Th>
                  <Th>±10 người</Th>
                  <Th className="text-right">
                    <span className="sr-only">Sửa</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <Td className="max-w-xs">
                      <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: shelterColor(s) }} aria-hidden />
                        <span className="truncate">{s.name}</span>
                      </p>
                      {s.address && <p className="mt-0.5 truncate text-xs text-slate-500">{s.address}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {!s.is_active && <Badge tone="slate">Tạm đóng</Badge>}
                        {(s.amenities ?? []).map((a) => {
                          const Icon = AMENITY_ICONS[a];
                          return (
                            <span key={a} title={AMENITY_LABELS[a]} className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                              <Icon className="h-3.5 w-3.5" aria-label={AMENITY_LABELS[a]} />
                            </span>
                          );
                        })}
                      </div>
                    </Td>
                    <Td>
                      <OccupancyBar current={s.current_occupancy} capacity={s.capacity} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <IconButton icon={Minus} label={`Bớt 10 người tại ${s.name}`} variant="secondary" size="sm" disabled={busyId === s.id || s.current_occupancy <= 0} onClick={() => bump(s, -10)} />
                        <IconButton icon={Plus} label={`Thêm 10 người tại ${s.name}`} variant="secondary" size="sm" disabled={busyId === s.id || s.available_slots <= 0} onClick={() => bump(s, 10)} />
                      </div>
                    </Td>
                    <Td className="text-right">
                      <IconButton icon={Pencil} label={`Sửa ${s.name}`} size="sm" onClick={() => setEditing(s)} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card flush className="xl:col-span-2">
          <BaseMap className="h-80 rounded-none border-0 xl:h-full xl:min-h-[420px]">
            <FitBounds bounds={bounds} />
            {rows.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(shelterColor(s), 'T')} eventHandlers={{ dblclick: () => setEditing(s) }}>
                <Popup>
                  <strong>{s.name}</strong>
                  <br />
                  Còn {s.available_slots}/{s.capacity} chỗ
                </Popup>
              </Marker>
            ))}
          </BaseMap>
        </Card>
      </div>

      <ShelterDrawer
        shelter={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          list.reload();
        }}
      />
    </>
  );
}

const BLANK = { name: '', address: '', region_id: '', capacity: 100, current_occupancy: 0, contact_phone: '', is_active: true };

function ShelterDrawer({ shelter, onClose, onSaved }: { shelter: Shelter | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { regions } = useCatalog();
  const [form, setForm] = useState(BLANK);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = shelter === 'new';

  useEffect(() => {
    setError(null);
    if (!shelter) return;
    if (shelter === 'new') {
      setForm(BLANK);
      setAmenities([]);
      setPoint(null);
    } else {
      setForm({
        name: shelter.name,
        address: shelter.address ?? '',
        region_id: shelter.region_id ? String(shelter.region_id) : '',
        capacity: shelter.capacity,
        current_occupancy: shelter.current_occupancy,
        contact_phone: shelter.contact_phone ?? '',
        is_active: shelter.is_active,
      });
      setAmenities(shelter.amenities ?? []);
      setPoint({ lat: shelter.lat, lng: shelter.lng });
    }
  }, [shelter]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!point) return setError('Chọn vị trí điểm trú ẩn trên bản đồ.');
    if (form.current_occupancy > form.capacity) return setError('Số người hiện có không được vượt sức chứa.');
    setBusy(true);
    setError(null);
    const body = {
      ...form,
      address: form.address || null,
      region_id: form.region_id ? Number(form.region_id) : null,
      contact_phone: form.contact_phone || null,
      amenities,
      ...point,
    };
    try {
      if (isNew) await api.post('/manage/shelters', body);
      else if (shelter) await api.patch(`/manage/shelters/${shelter.id}`, body);
      toast.success(isNew ? 'Đã thêm điểm trú ẩn.' : 'Đã lưu điểm trú ẩn.');
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Drawer
        open={!!shelter}
        onClose={onClose}
        title={isNew ? 'Thêm điểm trú ẩn' : 'Sửa điểm trú ẩn'}
        footer={
          <>
            {!isNew && (
              <Button variant="ghost" icon={Trash2} className="mr-auto !text-red-600" onClick={() => setConfirmDelete(true)}>
                Xoá
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" form="shelter-form" loading={busy}>
              {isNew ? 'Thêm điểm trú ẩn' : 'Lưu thay đổi'}
            </Button>
          </>
        }
      >
        <form id="shelter-form" onSubmit={submit} className="space-y-4">
          {error && <Callout tone="danger">{error}</Callout>}
          <Field label="Tên điểm trú ẩn" required>
            <Input required maxLength={255} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Trường THCS Nguyễn Huệ" />
          </Field>
          <Field label="Địa chỉ">
            <Input maxLength={255} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Khu vực">
              <Select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
                <option value="">Chưa chọn</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Số điện thoại liên hệ">
              <Input type="tel" maxLength={20} value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </Field>
            <Field label="Sức chứa (người)" required>
              <Input type="number" required min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </Field>
            <Field label="Đang ở (người)">
              <Input type="number" min={0} max={form.capacity} value={form.current_occupancy} onChange={(e) => setForm({ ...form, current_occupancy: Number(e.target.value) })} />
            </Field>
          </div>
          <FieldGroup label="Tiện ích">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(AMENITY_LABELS) as Amenity[]).map((a) => (
                <ToggleChip key={a} icon={AMENITY_ICONS[a]} checked={amenities.includes(a)} onChange={(on) => setAmenities((xs) => (on ? [...xs, a] : xs.filter((x) => x !== a)))}>
                  {AMENITY_LABELS[a]}
                </ToggleChip>
              ))}
            </div>
          </FieldGroup>
          <Checkbox label="Đang mở cửa đón người dân" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          <FieldGroup label="Vị trí" hint="Bấm vào bản đồ để đặt ghim.">
            <MapPointPicker value={point} onChange={setPoint} className="h-56" />
          </FieldGroup>
        </form>
      </Drawer>
      <ActionDialog
        open={confirmDelete}
        title="Xoá điểm trú ẩn?"
        description={shelter && shelter !== 'new' ? `"${shelter.name}" sẽ bị xoá khỏi bản đồ và gợi ý sơ tán.` : ''}
        confirmLabel="Xoá điểm trú ẩn"
        variant="danger"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!shelter || shelter === 'new') return;
          try {
            await api.delete(`/manage/shelters/${shelter.id}`);
            toast.success('Đã xoá điểm trú ẩn.');
            setConfirmDelete(false);
            onSaved();
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      />
    </>
  );
}
