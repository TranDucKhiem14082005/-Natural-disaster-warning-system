import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, House, KeyRound, LifeBuoy, LogIn, Mail, MapPin, Phone, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../store/auth-context';
import { api, errorText } from '../../services/api';
import { Button, Callout, Field, Input, LinkButton, useToast } from '../../components/ui';
import { PORTAL_HOME } from '../../utils/roles';
import { AuthShell, PasswordInput } from './auth-shell';

interface DemoAccount {
  login: string;
  name: string;
  hint: string;
  icon: LucideIcon;
}

const DEMO_GROUPS: { title: string; accounts: DemoAccount[] }[] = [
  {
    title: 'Người dân',
    accounts: [
      { login: 'citizen@demo.vn', name: 'Dân trong vùng', hint: 'Ngọc Hiệp, nhận cảnh báo', icon: House },
      { login: 'outsider@demo.vn', name: 'Dân ngoài vùng', hint: 'Hà Nội, để so sánh', icon: MapPin },
    ],
  },
  {
    title: 'Lực lượng ứng phó',
    accounts: [
      { login: 'rescuer@demo.vn', name: 'Đội cứu hộ', hint: 'Xử lý SOS được giao', icon: LifeBuoy },
      { login: 'officer@demo.vn', name: 'Cán bộ Khánh Hoà', hint: 'Điều hành địa bàn', icon: ShieldCheck },
    ],
  },
  {
    title: 'Quản trị',
    accounts: [{ login: 'admin@demo.vn', name: 'Quản trị viên', hint: 'Toàn hệ thống', icon: Building2 }],
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const signIn = async (creds: { login: string; password: string }, key: string) => {
    setBusy(key);
    setError(null);
    try {
      const user = await login(creds.login, creds.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : PORTAL_HOME[user.role], { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void signIn(form, 'form');
  };

  return (
    <AuthShell
      title="Đăng nhập"
      description="Đăng nhập để nhận cảnh báo theo vị trí, gửi báo cáo và theo dõi yêu cầu cứu hộ."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            Đăng ký miễn phí
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email hoặc số điện thoại" required>
          <Input icon={UserRound} autoComplete="username" required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="ban@email.com hoặc 09xxxxxxxx" />
        </Field>
        <Field
          label={
            <span className="flex items-center justify-between">
              Mật khẩu
              <Link to="/forgot-password" className="text-xs font-semibold text-brand-700 hover:underline">
                Quên mật khẩu?
              </Link>
            </span>
          }
        >
          <PasswordInput autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" size="lg" block icon={LogIn} loading={busy === 'form'} disabled={!!busy && busy !== 'form'}>
          Đăng nhập
        </Button>
      </form>

      <div className="mt-8">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tài khoản demo · mật khẩu "password"</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="mt-4 space-y-4">
          {DEMO_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{g.title}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.accounts.map((a) => (
                  <button
                    key={a.login}
                    type="button"
                    disabled={!!busy}
                    onClick={() => signIn({ login: a.login, password: 'password' }, a.login)}
                    className="group flex min-h-[56px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/50 disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-700">
                      <a.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{a.name}</span>
                      <span className="block truncate text-xs text-slate-500">{busy === a.login ? 'Đang đăng nhập...' : a.hint}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand-600" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const mismatch = form.password_confirmation !== '' && form.password !== form.password_confirmation;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email && !form.phone) return setError('Nhập email hoặc số điện thoại (ít nhất một).');
    if (mismatch) return setError('Mật khẩu nhập lại không khớp.');
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await register(payload);
      toast.success('Tạo tài khoản thành công. Thêm vị trí quan tâm để nhận cảnh báo đúng khu vực.');
      navigate('/me/profile');
    } catch (err) {
      setErrors((err as { errors?: Record<string, string[]> }).errors ?? {});
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const fe = (k: string) => errors[k]?.[0];

  return (
    <AuthShell
      title="Tạo tài khoản"
      description="Miễn phí. Chỉ cần email hoặc số điện thoại."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Họ và tên" required error={fe('name')}>
          <Input icon={UserRound} required autoComplete="name" value={form.name} onChange={set('name')} placeholder="Nguyễn Văn A" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" error={fe('email')}>
            <Input icon={Mail} type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="ban@email.com" />
          </Field>
          <Field label="Số điện thoại" error={fe('phone')}>
            <Input icon={Phone} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="09xxxxxxxx" />
          </Field>
        </div>
        <Field label="Mật khẩu" required hint="Tối thiểu 8 ký tự." error={fe('password')}>
          <PasswordInput autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Nhập lại mật khẩu" required error={mismatch ? 'Mật khẩu nhập lại không khớp.' : undefined}>
          <PasswordInput autoComplete="new-password" required value={form.password_confirmation} onChange={set('password_confirmation')} />
        </Field>
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" size="lg" block loading={busy}>
          Tạo tài khoản
        </Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>('/auth/forgot-password', { email });
      setSent(res.message);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Quên mật khẩu"
      description="Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Quay lại đăng nhập
        </Link>
      }
    >
      {sent ? (
        <Callout tone="success" title="Đã gửi yêu cầu">
          {sent} Kiểm tra hộp thư (kể cả mục Spam) của <strong>{email}</strong>.
        </Callout>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email đã đăng ký" required>
            <Input icon={Mail} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" />
          </Field>
          {error && <Callout tone="danger">{error}</Callout>}
          <Button type="submit" size="lg" block icon={Mail} loading={busy}>
            Gửi liên kết đặt lại
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ password: '', password_confirmation: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const email = params.get('email');
  const token = params.get('token');
  const mismatch = form.password_confirmation !== '' && form.password !== form.password_confirmation;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setError(null);
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { ...form, token, email });
      toast.success('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.');
      navigate('/login');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (!email || !token) {
    return (
      <AuthShell title="Đặt lại mật khẩu">
        <Callout tone="warning" title="Liên kết không hợp lệ" actions={<LinkButton to="/forgot-password" variant="secondary" size="sm">Gửi lại liên kết</LinkButton>}>
          Liên kết thiếu thông tin hoặc đã hết hạn.
        </Callout>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Đặt lại mật khẩu" description={<>Tài khoản: <strong className="text-slate-900">{email}</strong></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Mật khẩu mới" required hint="Tối thiểu 8 ký tự.">
          <PasswordInput required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Nhập lại mật khẩu" required error={mismatch ? 'Mật khẩu nhập lại không khớp.' : undefined}>
          <PasswordInput required autoComplete="new-password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} />
        </Field>
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" size="lg" block icon={KeyRound} loading={busy}>
          Đặt lại mật khẩu
        </Button>
      </form>
    </AuthShell>
  );
}
