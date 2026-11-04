import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, LockOpen, Pencil, Save, Search, UserPlus, Users } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useAuth } from '../../store/auth-context';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import { useDebounced } from '../../hooks/use-debounced';
import type { Paginated, Role, User } from '../../types/api';
import {
  Button,
  Callout,
  Card,
  DescriptionList,
  Drawer,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  ListSkeleton,
  Modal,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  Table,
  Td,
  Th,
  useToast,
} from '../../components/ui';
import { Avatar } from '../../components/shell/shell-parts';
import { ROLE_LABELS, fmtDate, fmtDateTime } from '../../utils/format';
import { ActiveBadge, ROLES, RoleBadge } from './admin-shared';

type RoleFilter = Role | 'all';

/** Totals per role for the filter pills; one cheap per_page=1 call each. */
function useRoleCounts(tick: number) {
  const [counts, setCounts] = useState<Partial<Record<RoleFilter, number>>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(
      (['all', ...ROLES] as RoleFilter[]).map((r) =>
        api.get<Paginated<User>>('/admin/users', { role: r === 'all' ? undefined : r, per_page: 1 }).then((p) => [r, p.total] as const),
      ),
    )
      .then((pairs) => alive && setCounts(Object.fromEntries(pairs)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);
  return counts;
}

export function UsersPage() {
  const { user: me } = useAuth();
  const { regions } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [regionId, setRegionId] = useState('');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState<User | null>(null);
  const creating = params.get('new') === '1';
  const dq = useDebounced(q);
  const counts = useRoleCounts(tick);

  const { data, error, loading, reload } = useFetch(
    () => api.get<Paginated<User>>('/admin/users', { q: dq, role: role === 'all' ? undefined : role, region_id: regionId || undefined, page }),
    [dq, role, regionId, page, tick],
  );

  const changed = (u?: User) => {
    setTick((t) => t + 1);
    if (u) setEditing((cur) => (cur && cur.id === u.id ? u : cur));
  };
  const setCreating = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set('new', '1');
    else next.delete('new');
    setParams(next, { replace: true });
  };

  const users = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Người dùng"
        description="Tạo tài khoản cho cán bộ và đội cứu hộ, phân vai trò, gán địa bàn và khoá tài khoản khi cần."
        actions={
          <Button icon={UserPlus} onClick={() => setCreating(true)}>
            Thêm tài khoản
          </Button>
        }
      />

      <Card flush>
        <div className="space-y-3 border-b border-slate-100 p-4 sm:px-5">
          <SegmentedControl<RoleFilter>
            label="Lọc theo vai trò"
            value={role}
            onChange={(v) => {
              setRole(v);
              setPage(1);
            }}
            options={[{ value: 'all', label: 'Tất cả', count: counts.all }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r], count: counts[r] }))]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              icon={Search}
              className="sm:max-w-sm sm:flex-1"
              placeholder="Tìm theo tên, email hoặc số điện thoại"
              aria-label="Tìm người dùng"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <Select
              className="sm:w-56"
              aria-label="Lọc theo địa bàn"
              value={regionId}
              onChange={(e) => {
                setRegionId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Mọi địa bàn</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error && (
          <div className="p-4">
            <ErrorBox message={error} />
          </div>
        )}
        {loading && !data ? (
          <div className="p-4">
            <ListSkeleton rows={6} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Không tìm thấy người dùng"
            description={dq || role !== 'all' || regionId ? 'Thử bỏ bớt bộ lọc hoặc đổi từ khoá tìm kiếm.' : 'Chưa có tài khoản nào.'}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Người dùng</Th>
                    <Th>Vai trò</Th>
                    <Th>Địa bàn</Th>
                    <Th>Trạng thái</Th>
                    <Th>Ngày tạo</Th>
                    <Th className="text-right">
                      <span className="sr-only">Thao tác</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setEditing(u)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {u.name}
                              {u.id === me?.id && <span className="ml-1.5 text-xs font-medium text-brand-700">(bạn)</span>}
                            </p>
                            <p className="truncate text-xs text-slate-500">{[u.email, u.phone].filter(Boolean).join(' · ')}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <RoleBadge role={u.role} />
                      </Td>
                      <Td className="text-slate-600">{u.region?.name ?? 'Toàn quốc'}</Td>
                      <Td>
                        <ActiveBadge active={u.is_active} />
                      </Td>
                      <Td className="whitespace-nowrap text-slate-500">{fmtDate(u.created_at)}</Td>
                      <Td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(u);
                          }}
                        >
                          Sửa
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {users.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => setEditing(u)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <Avatar name={u.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{u.name}</p>
                      <p className="truncate text-xs text-slate-500">{u.email ?? u.phone}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <RoleBadge role={u.role} />
                        <ActiveBadge active={u.is_active} />
                        <span className="text-xs text-slate-500">{u.region?.name ?? 'Toàn quốc'}</span>
                      </div>
                    </div>
                    <Pencil className="mt-1 h-4 w-4 text-slate-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="px-4 pb-4 sm:px-5">
          <Pagination page={data} onChange={setPage} />
        </div>
      </Card>

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          changed();
          reload();
        }}
      />
      <EditUserDrawer user={editing} isSelf={editing?.id === me?.id} onClose={() => setEditing(null)} onChanged={changed} />
    </>
  );
}

const EMPTY_FORM = { name: '', email: '', phone: '', password: '', role: 'rescuer' as Role, region_id: '' };

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { regions } = useCatalog();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError(null);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email && !form.phone) {
      setError('Cần nhập email hoặc số điện thoại để đăng nhập.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.post('/admin/users', {
        ...form,
        email: form.email || null,
        phone: form.phone || null,
        region_id: form.region_id ? Number(form.region_id) : null,
      });
      toast.success(`Đã tạo tài khoản ${form.name}.`);
      onCreated();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const needsRegion = form.role === 'officer' || form.role === 'rescuer';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm tài khoản"
      description="Tài khoản đăng nhập bằng email hoặc số điện thoại."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="create-user" icon={UserPlus} loading={saving}>
            Tạo tài khoản
          </Button>
        </>
      }
    >
      <form id="create-user" onSubmit={submit} className="space-y-4">
        <Field label="Họ và tên" required>
          <Input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Số điện thoại">
            <Input type="tel" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Mật khẩu" required hint="Tối thiểu 8 ký tự. Gửi cho người dùng qua kênh an toàn.">
          <Input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vai trò" required>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Địa bàn" hint={needsRegion ? 'Cán bộ và đội cứu hộ chỉ xử lý việc trong địa bàn này.' : undefined}>
            <Select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
              <option value="">Toàn quốc</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <ErrorBox message={error} />
      </form>
    </Modal>
  );
}

function EditUserDrawer({ user, isSelf, onClose, onChanged }: { user: User | null; isSelf: boolean; onClose: () => void; onChanged: (u: User) => void }) {
  const { regions } = useCatalog();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', role: 'citizen' as Role, region_id: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name, role: user.role, region_id: user.region_id ? String(user.region_id) : '', password: '' });
      setError(null);
    }
  }, [user]);

  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const body: Record<string, unknown> = { name: form.name, region_id: form.region_id ? Number(form.region_id) : null };
    if (!isSelf && form.role !== user.role) body.role = form.role;
    if (form.password) body.password = form.password;
    try {
      const updated = await api.patch<User>(`/admin/users/${user.id}`, body);
      toast.success('Đã lưu thay đổi.');
      onChanged(updated);
      setForm((f) => ({ ...f, password: '' }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleLock = async () => {
    setLocking(true);
    try {
      const updated = await api.patch<User>(`/admin/users/${user.id}`, { is_active: !user.is_active });
      toast.success(updated.is_active ? `Đã mở khoá ${user.name}.` : `Đã khoá ${user.name} và đăng xuất khỏi mọi thiết bị.`);
      setConfirmLock(false);
      onChanged(updated);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setLocking(false);
    }
  };

  return (
    <>
      <Drawer
        open={!!user}
        onClose={onClose}
        title={user.name}
        description={[user.email, user.phone].filter(Boolean).join(' · ')}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            <Button type="submit" form="edit-user" icon={Save} loading={saving}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <DescriptionList
            items={[
              { label: 'Vai trò', value: <RoleBadge role={user.role} /> },
              { label: 'Trạng thái', value: <ActiveBadge active={user.is_active} /> },
              { label: 'Địa bàn', value: user.region?.name ?? 'Toàn quốc' },
              { label: 'Ngày tạo', value: fmtDateTime(user.created_at) },
            ]}
          />

          <form id="edit-user" onSubmit={save} className="space-y-4 border-t border-slate-100 pt-5">
            <Field label="Họ và tên" required>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vai trò" hint={isSelf ? 'Không thể tự đổi vai trò của chính mình.' : undefined}>
                <Select value={form.role} disabled={isSelf} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Địa bàn">
                <Select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
                  <option value="">Toàn quốc</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Đặt lại mật khẩu" hint="Để trống nếu không đổi. Tối thiểu 8 ký tự.">
              <Input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <ErrorBox message={error} />
          </form>

          <div className="rounded-xl border border-red-200 p-4">
            <p className="font-semibold text-slate-900">{user.is_active ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}</p>
            <p className="mt-1 text-sm text-slate-600">
              {user.is_active
                ? 'Người dùng sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập cho tới khi được mở khoá.'
                : 'Cho phép người dùng đăng nhập lại.'}
            </p>
            <Button
              className="mt-3"
              variant={user.is_active ? 'danger' : 'success'}
              size="sm"
              icon={user.is_active ? Lock : LockOpen}
              disabled={isSelf}
              onClick={() => (user.is_active ? setConfirmLock(true) : toggleLock())}
              loading={locking && !confirmLock}
            >
              {user.is_active ? 'Khoá tài khoản' : 'Mở khoá'}
            </Button>
            {isSelf && <p className="mt-2 text-xs text-slate-500">Không thể tự khoá tài khoản của chính mình.</p>}
          </div>
        </div>
      </Drawer>

      <Modal
        open={confirmLock}
        onClose={() => setConfirmLock(false)}
        size="sm"
        title={`Khoá tài khoản ${user.name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmLock(false)}>
              Huỷ
            </Button>
            <Button variant="danger" icon={Lock} loading={locking} onClick={toggleLock}>
              Khoá tài khoản
            </Button>
          </>
        }
      >
        <Callout tone="warning" title="Thu hồi mọi phiên đăng nhập">
          Tất cả token của người dùng bị xoá ngay. Ứng dụng trên mọi thiết bị của họ sẽ bị đăng xuất, và họ không đăng nhập lại được cho tới khi được mở khoá.
        </Callout>
      </Modal>
    </>
  );
}
