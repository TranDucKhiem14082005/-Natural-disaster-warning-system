import { useState, type FormEvent } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api, errorText } from '../../services/api';
import { useAuth } from '../../store/auth-context';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import { useDebounced } from '../../hooks/use-debounced';
import type { ActivityLog, Paginated, Role, User } from '../../types/api';
import { Badge, Button, Card, ErrorBox, Field, Pagination, Spinner, inputBase, inputClass } from '../../components/ui';
import { ROLE_LABELS, fmtDateTime } from '../../utils/format';

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export function AdminLayout() {
  const tabs = [
    { to: '/admin/users', label: 'Người dùng' },
    { to: '/admin/catalog', label: 'Danh mục' },
    { to: '/admin/logs', label: 'Nhật ký hoạt động' },
  ];
  return (
    <div>
      <nav aria-label="Quản trị" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600'}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const { regions } = useCatalog();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useFetch(() => api.get<Paginated<User>>('/admin/users', { q: dq, role, page }), [dq, role, page]);
  const [actionError, setActionError] = useState<string | null>(null);

  const update = async (u: User, body: Record<string, unknown>) => {
    setActionError(null);
    try {
      await api.patch(`/admin/users/${u.id}`, body);
      reload();
    } catch (err) {
      setActionError(errorText(err));
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Người dùng" className="xl:col-span-2">
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={`${inputClass} max-w-xs`} placeholder="Tên, email, SĐT..." aria-label="Tìm" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className={`${inputBase} w-40`} aria-label="Vai trò" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">Mọi vai trò</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <ErrorBox message={error ?? actionError} />
        {loading && !data && <Spinner />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Người dùng</th>
                <th className="py-2">Vai trò</th>
                <th className="py-2">Địa bàn</th>
                <th className="py-2 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.data.map((u) => (
                <tr key={u.id}>
                  <td className="py-2">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email ?? u.phone}</p>
                  </td>
                  <td className="py-2">
                    <select className={`${inputBase} w-36`} aria-label={`Vai trò của ${u.name}`} value={u.role} disabled={u.id === me?.id} onChange={(e) => update(u, { role: e.target.value })}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="py-2">
                    <select className={`${inputBase} w-36`} aria-label={`Địa bàn của ${u.name}`} value={u.region_id ?? ''} onChange={(e) => update(u, { region_id: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Toàn quốc</option>
                      {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <Button variant={u.is_active ? 'secondary' : 'primary'} disabled={u.id === me?.id} onClick={() => update(u, { is_active: !u.is_active })}>
                      {u.is_active ? 'Khoá' : 'Mở khoá'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={data} onChange={setPage} />
      </Card>
      <NewUserForm onCreated={reload} />
    </div>
  );
}

function NewUserForm({ onCreated }: { onCreated: () => void }) {
  const { regions } = useCatalog();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'rescuer', region_id: '' });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/admin/users', {
        ...form,
        email: form.email || null,
        phone: form.phone || null,
        region_id: form.region_id ? Number(form.region_id) : null,
      });
      setForm({ name: '', email: '', phone: '', password: '', role: 'rescuer', region_id: '' });
      onCreated();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Card title="Tạo tài khoản">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Họ tên"><input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email"><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Số điện thoại"><input className={inputClass} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Mật khẩu"><input className={inputClass} type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <select className={inputClass} aria-label="Vai trò" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <select className={inputClass} aria-label="Địa bàn" value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
            <option value="">Toàn quốc</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <ErrorBox message={error} />
        <Button type="submit" className="w-full">Tạo</Button>
      </form>
    </Card>
  );
}

type Resource = 'regions' | 'disaster-types' | 'guides' | 'emergency-contacts';

const RESOURCES: Record<Resource, { label: string; fields: { key: string; label: string; type?: 'number' | 'textarea' | 'checkbox' }[] }> = {
  regions: {
    label: 'Khu vực',
    fields: [
      { key: 'code', label: 'Mã' },
      { key: 'name', label: 'Tên' },
      { key: 'center_lat', label: 'Vĩ độ tâm', type: 'number' },
      { key: 'center_lng', label: 'Kinh độ tâm', type: 'number' },
    ],
  },
  'disaster-types': {
    label: 'Loại thiên tai',
    fields: [
      { key: 'code', label: 'Mã' },
      { key: 'name', label: 'Tên' },
      { key: 'default_instructions', label: 'Hướng dẫn mẫu', type: 'textarea' },
    ],
  },
  guides: {
    label: 'Cẩm nang',
    fields: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'disaster_type_id', label: 'ID loại thiên tai', type: 'number' },
      { key: 'content', label: 'Nội dung (## tiêu đề, - gạch đầu dòng)', type: 'textarea' },
      { key: 'is_published', label: 'Công khai', type: 'checkbox' },
    ],
  },
  'emergency-contacts': {
    label: 'Danh bạ khẩn cấp',
    fields: [
      { key: 'name', label: 'Tên' },
      { key: 'phone', label: 'Số điện thoại' },
      { key: 'description', label: 'Mô tả' },
      { key: 'region_id', label: 'ID khu vực (trống = toàn quốc)', type: 'number' },
      { key: 'sort_order', label: 'Thứ tự', type: 'number' },
    ],
  },
};

type Row = Record<string, unknown> & { id: number };

export function CatalogPage() {
  const [resource, setResource] = useState<Resource>('regions');
  const { data, error, reload } = useFetch(() => api.get<Paginated<Row>>(`/admin/catalog/${resource}`), [resource]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const spec = RESOURCES[resource];

  const startEdit = (row: Row | null) => {
    setEditing(row);
    setValues(row ? Object.fromEntries(spec.fields.map((f) => [f.key, row[f.key] ?? ''])) : { is_published: true });
    setFormError(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const body = Object.fromEntries(
      spec.fields.map((f) => {
        const v = values[f.key];
        if (f.type === 'checkbox') return [f.key, !!v];
        if (v === '' || v === undefined) return [f.key, null];
        return [f.key, f.type === 'number' ? Number(v) : v];
      }),
    );
    try {
      if (editing) await api.patch(`/admin/catalog/${resource}/${editing.id}`, body);
      else await api.post(`/admin/catalog/${resource}`, body);
      startEdit(null);
      reload();
    } catch (err) {
      setFormError(errorText(err));
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm('Xoá mục này?')) return;
    try {
      await api.delete(`/admin/catalog/${resource}/${row.id}`);
      reload();
    } catch (err) {
      setFormError(errorText(err));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        title={spec.label}
        className="lg:col-span-2"
        actions={
          <select className={`${inputBase} w-48`} aria-label="Danh mục" value={resource} onChange={(e) => { setResource(e.target.value as Resource); startEdit(null); }}>
            {(Object.keys(RESOURCES) as Resource[]).map((r) => <option key={r} value={r}>{RESOURCES[r].label}</option>)}
          </select>
        }
      >
        <ErrorBox message={error} />
        <ul className="divide-y divide-slate-100 text-sm">
          {data?.data.map((row) => (
            <li key={row.id} className="flex items-center gap-2 py-2">
              <span className="text-xs text-slate-400">#{row.id}</span>
              <span className="flex-1 truncate">
                {String(row.name ?? row.title ?? '')} {row.code ? <Badge>{String(row.code)}</Badge> : null} {row.phone ? <Badge tone="red">{String(row.phone)}</Badge> : null}
              </span>
              <Button variant="ghost" onClick={() => startEdit(row)}>Sửa</Button>
              <Button variant="ghost" onClick={() => remove(row)}>Xoá</Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={editing ? `Sửa #${editing.id}` : `Thêm ${spec.label.toLowerCase()}`}>
        <form onSubmit={save} className="space-y-3">
          {spec.fields.map((f) =>
            f.type === 'checkbox' ? (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })} />
                {f.label}
              </label>
            ) : (
              <Field key={f.key} label={f.label}>
                {f.type === 'textarea' ? (
                  <textarea className={inputClass} rows={5} value={String(values[f.key] ?? '')} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                ) : (
                  <input className={inputClass} type={f.type === 'number' ? 'number' : 'text'} step="any" value={String(values[f.key] ?? '')} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                )}
              </Field>
            ),
          )}
          <ErrorBox message={formError} />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">Lưu</Button>
            {editing && <Button variant="secondary" onClick={() => startEdit(null)}>Huỷ</Button>}
          </div>
        </form>
      </Card>
    </div>
  );
}

export function ActivityLogsPage() {
  const [page, setPage] = useState(1);
  const [range, setRange] = useState({ from: '', to: '' });
  const { data, error, loading } = useFetch(() => api.get<Paginated<ActivityLog>>('/admin/activity-logs', { ...range, page }), [range, page]);

  return (
    <Card
      title="Nhật ký hoạt động"
      actions={
        <div className="flex gap-2">
          <input type="date" className={inputClass} aria-label="Từ ngày" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <input type="date" className={inputClass} aria-label="Đến ngày" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
      }
    >
      <ErrorBox message={error} />
      {loading && !data && <Spinner />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Thời gian</th>
              <th className="py-2">Người dùng</th>
              <th className="py-2">Thao tác</th>
              <th className="py-2">Kết quả</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.data.map((l) => (
              <tr key={l.id}>
                <td className="py-2 text-xs text-slate-500">{fmtDateTime(l.created_at)}</td>
                <td className="py-2">{l.user ? `${l.user.name} (${ROLE_LABELS[l.user.role]})` : '-'}</td>
                <td className="py-2 font-mono text-xs">
                  <Badge tone="blue">{l.method}</Badge> {l.path}
                </td>
                <td className="py-2">
                  <Badge tone={l.status_code < 300 ? 'green' : l.status_code < 500 ? 'amber' : 'red'}>{l.status_code}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={data} onChange={setPage} />
    </Card>
  );
}
