import { Link } from 'react-router-dom';
import { ArrowRight, CloudSun, Phone, ShieldCheck, Siren, Tent, TriangleAlert, Waves } from 'lucide-react';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import type { Overview, RegionForecast } from '../../types/api';
import { Callout, Card, EmptyState, LinkButton, ListSkeleton, Skeleton, StatCard } from '../../components/ui';
import { QUICK_LINKS } from '../../layouts/public-layout';
import { AlertCard } from '../alerts/alert-card';
import { AreaCheck } from './area-check';
import { ForecastList } from './forecast-list';

const HOTLINES = [
  { n: '112', label: 'Cứu nạn' },
  { n: '113', label: 'Công an' },
  { n: '114', label: 'Cứu hoả' },
  { n: '115', label: 'Cấp cứu' },
];

export function HomePage() {
  const overview = useFetch(() => api.get<Overview>('/overview'), []);
  const forecasts = useFetch(() => api.get<RegionForecast[]>('/forecasts'), []);
  const o = overview.data;

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 px-5 py-6 text-white shadow-raised sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Thông tin chính thức từ cán bộ địa phương
            </p>
            <h1 className="mt-3 text-[1.65rem] font-extrabold leading-tight tracking-tight sm:text-4xl">Cảnh báo thiên tai kịp thời, sơ tán an toàn</h1>
            <p className="mt-2 max-w-xl text-sm text-brand-100 sm:text-base">
              Theo dõi cảnh báo theo vị trí, tìm điểm trú ẩn còn chỗ và gửi yêu cầu cứu hộ chỉ với một chạm.
            </p>
            <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
              <LinkButton to="/map" variant="secondary" size="lg" className="!border-white/0">
                Mở bản đồ
              </LinkButton>
              <LinkButton to="/sos" variant="danger" size="lg" icon={Siren} className="shadow-sos">
                Gửi SOS
              </LinkButton>
            </div>
          </div>
          <AreaCheck />
        </div>
      </section>

      <section aria-label="Đường dây nóng" className="grid grid-cols-4 gap-2 lg:hidden">
        {HOTLINES.map((h) => (
          <a key={h.n} href={`tel:${h.n}`} className="flex flex-col items-center rounded-2xl border border-red-100 bg-white py-2.5 shadow-card active:bg-red-50">
            <span className="flex items-center gap-1 text-lg font-extrabold text-red-600">
              <Phone className="h-4 w-4" aria-hidden />
              {h.n}
            </span>
            <span className="text-[11px] font-medium text-slate-500">{h.label}</span>
          </a>
        ))}
      </section>

      <section aria-label="Truy cập nhanh">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-2 py-4 text-center shadow-card transition hover:border-brand-200 hover:shadow-raised"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <q.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-xs font-semibold text-slate-700 sm:text-sm">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {overview.error && <Callout tone="danger" title="Không tải được tình hình chung">{overview.error}</Callout>}
      <section aria-label="Tình hình chung" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {o ? (
          <>
            <StatCard label="Cảnh báo hiệu lực" value={o.active_alerts} icon={TriangleAlert} tone={o.active_alerts ? 'red' : 'green'} to="/alerts" />
            <StatCard label="Mức nghiêm trọng" value={o.severe_alerts} icon={Siren} tone={o.severe_alerts ? 'orange' : 'slate'} hint="Mức 4 trở lên" to="/alerts" />
            <StatCard label="Sự kiện đang diễn ra" value={o.ongoing_events} icon={Waves} tone="amber" to="/events" />
            <StatCard label="Trú ẩn còn chỗ" value={o.open_shelters} icon={Tent} tone="green" to="/shelters" />
          </>
        ) : (
          overview.loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Cảnh báo đang hiệu lực"
          description="Mới nhất trước"
          icon={TriangleAlert}
          className="lg:col-span-2"
          actions={
            <LinkButton to="/alerts" variant="ghost" size="sm" iconRight={ArrowRight}>
              Xem tất cả
            </LinkButton>
          }
        >
          {overview.loading && !o && <ListSkeleton rows={3} />}
          {o &&
            (o.latest_alerts.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {o.latest_alerts.map((a) => (
                  <AlertCard key={a.id} alert={a} />
                ))}
              </div>
            ) : (
              <EmptyState icon={ShieldCheck} title="Hiện không có cảnh báo nào" description="Bạn sẽ nhận thông báo ngay khi cán bộ phát hành cảnh báo mới trong khu vực." compact />
            ))}
        </Card>

        <Card title="Dự báo rủi ro 3 ngày" description="Mưa và gió theo Open-Meteo" icon={CloudSun}>
          {forecasts.error && <Callout tone="danger">{forecasts.error}</Callout>}
          {forecasts.loading && <ListSkeleton rows={3} />}
          {forecasts.data &&
            (forecasts.data.length ? (
              <ForecastList forecasts={forecasts.data} />
            ) : (
              <EmptyState icon={CloudSun} title="Chưa có dữ liệu dự báo" description="Dữ liệu được cập nhật mỗi giờ." compact />
            ))}
        </Card>
      </div>
    </div>
  );
}
