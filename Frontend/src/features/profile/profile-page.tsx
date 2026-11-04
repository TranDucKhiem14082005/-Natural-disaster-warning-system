import { useState, type FormEvent } from 'react';
import { Briefcase, House, KeyRound, Mail, MapPin, MapPinned, Pencil, Phone, Plus, Save, Trash2, UserRound, Users, type LucideIcon } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useAuth } from '../../store/auth-context';
import { useFetch } from '../../hooks/use-fetch';
import type { LatLng } from '../../hooks/use-geolocation';
import type { UserLocation } from '../../types/api';
import { LocationPicker } from '../../components/map/location-picker';
import { Badge, Button, Callout, Card, EmptyState, Field, Input, ListSkeleton, Modal, PageHeader, useToast } from '../../components/ui';
import { ROLE_LABELS } from '../../utils/format';
import { initials } from '../../utils/roles';
import { PasswordInput } from '../auth/auth-shell';

const MAX_LOCATIONS = 10;

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader title="Hồ sơ cá nhân" description="Thông tin tài khoản, mật khẩu và các vị trí bạn muốn nhận cảnh báo." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-5">
          <AccountCard />
          <PasswordCard />
        </div>
        <LocationsCard />
      </div>
    </>
  );
}

function AccountCard() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const dirty = form.name !== user.name || form.phone !== (user.phone ?? '');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.patch('/me', { name: form.name, phone: form.phone || null });
      await refresh();
      toast.success('Đã lưu thông tin cá nhân.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="mb-5 flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-700" aria-hidden>
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-slate-900">{user.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="blue">{ROLE_LABELS[user.role]}</Badge>
            {user.region && <Badge>{user.region.name}</Badge>}
          </div>
        </div>
      </div>
      <form onSubmit={save} className="space-y-4">
        <Field label="Email" hint="Email dùng để đăng nhập và nhận liên kết đặt lại mật khẩu.">
          <Input icon={Mail} value={user.email ?? 'Chưa có email'} disabled />
        </Field>
        <Field label="Họ và tên" required>
          <Input icon={UserRound} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Số điện thoại" hint="Dùng để đăng nhập và để đội cứu hộ liên hệ khi bạn gửi SOS.">
          <Input icon={Phone} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxxx" />
        </Field>
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" icon={Save} loading={busy} disabled={!dirty}>
          Lưu thay đổi
        </Button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const empty = { current_password: '', password: '', password_confirmation: '' };
  const [pw, setPw] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = pw.password_confirmation !== '' && pw.password !== pw.password_confirmation;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setError(null);
    setBusy(true);
    try {
      await api.patch('/me', pw);
      setPw(empty);
      toast.success('Đã đổi mật khẩu.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Đổi mật khẩu" icon={KeyRound}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Mật khẩu hiện tại" required>
          <PasswordInput required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mật khẩu mới" required hint="Tối thiểu 8 ký tự.">
            <PasswordInput required minLength={8} autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
          </Field>
          <Field label="Nhập lại" required error={mismatch ? 'Không khớp.' : undefined}>
            <PasswordInput required autoComplete="new-password" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} />
          </Field>
        </div>
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" variant="secondary" icon={KeyRound} loading={busy}>
          Đổi mật khẩu
        </Button>
      </form>
    </Card>
  );
}

const LABEL_PRESETS: { label: string; icon: LucideIcon }[] = [
  { label: 'Nhà', icon: House },
  { label: 'Nơi làm việc', icon: Briefcase },
  { label: 'Nhà người thân', icon: Users },
];

function iconFor(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (/nhà người thân|bố mẹ|ông bà/.test(l)) return Users;
  if (/nhà|home/.test(l)) return House;
  if (/làm|cơ quan|công ty|văn phòng|trường/.test(l)) return Briefcase;
  return MapPin;
}

function LocationsCard() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch(() => api.get<UserLocation[]>('/me/locations'), []);
  const [editing, setEditing] = useState<UserLocation | 'new' | null>(null);
  const [deleting, setDeleting] = useState<UserLocation | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const count = data?.length ?? 0;

  const remove = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await api.delete(`/me/locations/${deleting.id}`);
      toast.success(`Đã xoá "${deleting.label}".`);
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <Card
      title="Vị trí quan tâm"
      icon={MapPinned}
      description={`Nhận cảnh báo khi một vị trí nằm trong vùng ảnh hưởng · ${count}/${MAX_LOCATIONS}`}
      actions={
        count > 0 && (
          <Button size="sm" icon={Plus} onClick={() => setEditing('new')} disabled={count >= MAX_LOCATIONS}>
            Thêm vị trí
          </Button>
        )
      }
      className="self-start"
    >
      {error && <Callout tone="danger">{error}</Callout>}
      {loading && !data && <ListSkeleton rows={3} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={MapPinned}
          title="Chưa có vị trí nào"
          description="Thêm nhà, nơi làm việc hoặc nhà người thân để nhận cảnh báo đúng khu vực."
          action={
            <Button icon={Plus} onClick={() => setEditing('new')}>
              Thêm vị trí đầu tiên
            </Button>
          }
        />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((l) => {
            const Icon = iconFor(l.label);
            return (
              <li key={l.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{l.label}</p>
                  <p className="truncate text-xs text-slate-500">{l.address ?? `${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}`}</p>
                </div>
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(l)} aria-label={`Sửa ${l.label}`}>
                  <span className="hidden sm:inline">Sửa</span>
                </Button>
                <Button size="sm" variant="ghost" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(l)} aria-label={`Xoá ${l.label}`}>
                  <span className="hidden sm:inline">Xoá</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <LocationForm
          location={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            toast.success(msg);
            setEditing(null);
            reload();
          }}
        />
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Xoá vị trí?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Huỷ
            </Button>
            <Button variant="danger" icon={Trash2} loading={busyDelete} onClick={remove}>
              Xoá vị trí
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Bạn sẽ không còn nhận cảnh báo cho <strong className="text-slate-900">{deleting?.label}</strong>.
        </p>
      </Modal>
    </Card>
  );
}

function LocationForm({ location, onClose, onSaved }: { location: UserLocation | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [label, setLabel] = useState(location?.label ?? '');
  const [address, setAddress] = useState(location?.address ?? '');
  const [point, setPoint] = useState<LatLng | null>(location ? { lat: location.lat, lng: location.lng } : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!label.trim()) return setError('Nhập tên cho vị trí.');
    if (!point) return setError('Chọn vị trí trên bản đồ hoặc dùng vị trí hiện tại.');
    setError(null);
    setBusy(true);
    try {
      const body = { label: label.trim(), address: address.trim() || null, lat: point.lat, lng: point.lng };
      if (location) await api.patch(`/me/locations/${location.id}`, body);
      else await api.post('/me/locations', body);
      onSaved(location ? 'Đã cập nhật vị trí.' : `Đã thêm "${body.label}". Bạn sẽ nhận cảnh báo cho vị trí này.`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={location ? 'Sửa vị trí' : 'Thêm vị trí quan tâm'}
      description="Bấm lên bản đồ để đặt ghim, hoặc dùng vị trí hiện tại."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button icon={Save} loading={busy} onClick={() => submit()}>
            {location ? 'Lưu vị trí' : 'Thêm vị trí'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tên vị trí" required>
          <Input required maxLength={50} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nhà, Nơi làm việc..." />
        </Field>
        <div className="-mt-2 flex flex-wrap gap-2">
          {LABEL_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setLabel(p.label)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${label === p.label ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <p.icon className="h-4 w-4" aria-hidden />
              {p.label}
            </button>
          ))}
        </div>
        <Field label="Địa chỉ" hint="Không bắt buộc, giúp bạn dễ nhận ra vị trí.">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường..." />
        </Field>
        <LocationPicker value={point} onChange={setPoint} className="h-64" />
        {error && <Callout tone="danger">{error}</Callout>}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
