import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../store/auth-context';
import { api, errorText } from '../../services/api';
import { Button, ErrorBox, Field, SuccessBox, inputClass } from '../../components/ui';

const DEMO = ['citizen@demo.vn', 'officer@demo.vn', 'rescuer@demo.vn', 'admin@demo.vn', 'outsider@demo.vn'];

function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-bold text-slate-900">{title}</h1>
      {children}
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent, creds = form) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(creds.login, creds.password);
      navigate((location.state as { from?: string } | null)?.from ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Đăng nhập">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email hoặc số điện thoại">
          <input className={inputClass} autoComplete="username" required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        </Field>
        <Field label="Mật khẩu">
          <input className={inputClass} type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <ErrorBox message={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/register" className="text-brand-600 hover:underline">
          Tạo tài khoản
        </Link>
        <Link to="/forgot-password" className="text-brand-600 hover:underline">
          Quên mật khẩu?
        </Link>
      </div>
      <div className="mt-6 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Tài khoản demo (mật khẩu: password)</p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map((email) => (
            <button
              key={email}
              type="button"
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200"
              onClick={(e) => submit(e, { login: email, password: 'password' })}
            >
              {email.split('@')[0]}
            </button>
          ))}
        </div>
      </div>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', password_confirmation: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await register(payload);
      navigate('/profile');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Đăng ký tài khoản">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Họ tên">
          <input className={inputClass} required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email" hint="Nhập email hoặc số điện thoại (ít nhất một).">
          <input className={inputClass} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Số điện thoại">
          <input className={inputClass} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Mật khẩu (tối thiểu 8 ký tự)">
          <input className={inputClass} type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Nhập lại mật khẩu">
          <input className={inputClass} type="password" autoComplete="new-password" required value={form.password_confirmation} onChange={set('password_confirmation')} />
        </Field>
        <ErrorBox message={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          Đăng ký
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Đã có tài khoản?{' '}
        <Link to="/login" className="text-brand-600 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ message: string }>('/auth/forgot-password', { email });
      setMsg(res.message);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <AuthCard title="Quên mật khẩu">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email đã đăng ký">
          <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <ErrorBox message={error} />
        <SuccessBox message={msg} />
        <Button type="submit" className="w-full">
          Gửi liên kết đặt lại
        </Button>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', password_confirmation: '' });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/auth/reset-password', { ...form, token: params.get('token'), email: params.get('email') });
      navigate('/login');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <AuthCard title="Đặt lại mật khẩu">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">Tài khoản: {params.get('email')}</p>
        <Field label="Mật khẩu mới">
          <input className={inputClass} type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Nhập lại mật khẩu">
          <input className={inputClass} type="password" required value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} />
        </Field>
        <ErrorBox message={error} />
        <Button type="submit" className="w-full">
          Đặt lại mật khẩu
        </Button>
      </form>
    </AuthCard>
  );
}
