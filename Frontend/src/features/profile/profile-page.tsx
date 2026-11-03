import { useState, type FormEvent } from 'react';
import { api, errorText } from '../../services/api';
import { useAuth } from '../../store/auth-context';
import { useFetch } from '../../hooks/use-fetch';
import type { LatLng } from '../../hooks/use-geolocation';
import type { UserLocation } from '../../types/api';
import { LocationPicker } from '../../components/map/location-picker';
import { Button, Card, Empty, ErrorBox, Field, PageTitle, SuccessBox, inputClass } from '../../components/ui';
import { ROLE_LABELS } from '../../utils/format';

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent, body: Record<string, string>, reset?: () => void) => {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      await api.patch('/me', body);
      await refresh();
      reset?.();
      setMsg('Đã lưu thay đổi.');
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (!user) return null;

  return (
    <>
      <PageTitle>Hồ sơ cá nhân</PageTitle>
      <div className="mb-4 space-y-2">
        <SuccessBox message={msg} />
        <ErrorBox message={error} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Thông tin">
          <form onSubmit={(e) => save(e, { name: profile.name, ...(profile.phone ? { phone: profile.phone } : {}) })} className="space-y-3">
            <p className="text-sm text-slate-600">
              {user.email ?? '-'} · <strong>{ROLE_LABELS[user.role]}</strong>
              {user.region && ` · ${user.region.name}`}
            </p>
            <Field label="Họ tên">
              <input className={inputClass} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </Field>
            <Field label="Số điện thoại">
              <input className={inputClass} type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </Field>
            <Button type="submit">Lưu</Button>
          </form>
        </Card>
        <Card title="Đổi mật khẩu">
          <form onSubmit={(e) => save(e, pw, () => setPw({ current_password: '', password: '', password_confirmation: '' }))} className="space-y-3">
            <Field label="Mật khẩu hiện tại">
              <input className={inputClass} type="password" required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            </Field>
            <Field label="Mật khẩu mới">
              <input className={inputClass} type="password" required minLength={8} autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
            </Field>
            <Field label="Nhập lại">
              <input className={inputClass} type="password" required autoComplete="new-password" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} />
            </Field>
            <Button type="submit">Đổi mật khẩu</Button>
          </form>
        </Card>
        <LocationsCard />
      </div>
    </>
  );
}

function LocationsCard() {
  const { data, error, reload } = useFetch(() => api.get<UserLocation[]>('/me/locations'), []);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!point) return setFormError('Chọn vị trí trên bản đồ.');
    setFormError(null);
    try {
      await api.post('/me/locations', { label, address: address || undefined, ...point });
      setLabel('');
      setAddress('');
      setPoint(null);
      reload();
    } catch (err) {
      setFormError(errorText(err));
    }
  };

  const remove = async (id: number) => {
    await api.delete(`/me/locations/${id}`);
    reload();
  };

  return (
    <Card title="Vị trí quan tâm" className="lg:col-span-1">
      <p className="mb-2 text-xs text-slate-500">Bạn sẽ nhận cảnh báo khi một vị trí nằm trong vùng ảnh hưởng (tối đa 10).</p>
      <ErrorBox message={error} />
      {data?.length ? (
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {data.map((l) => (
            <li key={l.id} className="flex items-center gap-2 py-2">
              <div className="flex-1">
                <p className="font-medium">{l.label}</p>
                <p className="text-xs text-slate-500">{l.address ?? `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`}</p>
              </div>
              <Button variant="ghost" onClick={() => remove(l.id)} aria-label={`Xoá ${l.label}`}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Chưa có vị trí nào.</Empty>
      )}
      <form onSubmit={add} className="space-y-2">
        <input className={inputClass} placeholder="Nhãn (Nhà, Cơ quan...)" required maxLength={50} value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className={inputClass} placeholder="Địa chỉ (tuỳ chọn)" value={address} onChange={(e) => setAddress(e.target.value)} />
        <LocationPicker value={point} onChange={setPoint} className="h-56" />
        <ErrorBox message={formError} />
        <Button type="submit" className="w-full">
          + Thêm vị trí
        </Button>
      </form>
    </Card>
  );
}
