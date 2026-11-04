import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { BellRing, Eye, EyeOff, Lock, MapPinned, ShieldAlert, Siren } from 'lucide-react';
import { inputClass } from '../../components/ui';

const POINTS = [
  { icon: BellRing, text: 'Nhận cảnh báo ngay khi nơi bạn quan tâm nằm trong vùng ảnh hưởng.' },
  { icon: MapPinned, text: 'Xem bản đồ vùng nguy hiểm, điểm trú ẩn và tuyến sơ tán gần nhất.' },
  { icon: Siren, text: 'Gửi SOS một chạm và theo dõi đội cứu hộ theo thời gian thực.' },
];

/** Two-column auth frame: brand panel on wide screens, focused form card everywhere. */
export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-raised lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-10 text-white lg:flex">
        <div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <ShieldAlert className="h-7 w-7" aria-hidden />
          </span>
          <p className="mt-6 text-2xl font-bold leading-snug">Chủ động trước thiên tai, an toàn cho cả gia đình.</p>
          <ul className="mt-8 space-y-5">
            {POINTS.map((p) => (
              <li key={p.text} className="flex gap-3 text-sm text-white/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <p.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="pt-1.5">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-10 text-xs text-white/60">Khẩn cấp gọi 112 · 113 · 114 · 115</p>
      </aside>
      <section className="p-6 sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">{footer}</div>}
      </section>
    </div>
  );
}

/** Password field with a show/hide toggle (easier to type on phones). */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input {...props} type={show ? 'text' : 'password'} className={`${inputClass} pl-9 pr-11`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      >
        {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </span>
  );
}
