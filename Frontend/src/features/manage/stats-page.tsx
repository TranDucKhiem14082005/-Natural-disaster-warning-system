import { useState, type ReactElement } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartColumn, Clock, Megaphone, RotateCcw, Siren, Timer } from 'lucide-react';
import { api } from '../../services/api';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { SosStatus, Stats } from '../../types/api';
import { Button, Callout, Card, EmptyState, Field, Input, PageHeader, Select, Skeleton, StatCard } from '../../components/ui';
import { SEVERITY_COLORS, SEVERITY_LABELS, SOS_STATUS_LABELS } from '../../utils/format';

// One hue per measure: alerts are brand blue, SOS is red; status/severity reuse their semantic scales.
const ALERT_COLOR = '#2563eb';
const SOS_COLOR = '#dc2626';
const SOS_STATUS_COLORS: Record<SosStatus, string> = { new: '#dc2626', received: '#f59e0b', rescuing: '#2563eb', safe: '#16a34a' };
const AXIS = { fontSize: 12, fill: '#64748b' };
const GRID = '#e2e8f0';

const EMPTY_FILTERS = { from: '', to: '', region_id: '', disaster_type_id: '' };

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return mo && y ? `T${Number(mo)}/${y.slice(2)}` : m;
}

function minutes(v: number) {
  if (!v) return '-';
  return v >= 60 ? `${(v / 60).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ` : `${Math.round(v)} phút`;
}

export function StatsPage() {
  const { regions, types } = useCatalog();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const { data, error, loading } = useFetch(() => api.get<Stats>('/manage/stats', filters), [filters]);
  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters({ ...filters, [k]: e.target.value });
  const dirty = Object.values(filters).some(Boolean);

  const sosByStatus = data ? (Object.keys(SOS_STATUS_LABELS) as SosStatus[]).map((s) => ({ status: s, name: SOS_STATUS_LABELS[s], total: Number(data.sos.by_status[s] ?? 0) })) : [];

  return (
    <>
      <PageHeader title="Thống kê" description="Số cảnh báo, yêu cầu SOS và thời gian phản hồi theo thời gian, khu vực và loại thiên tai." />

      <Card className="mb-5">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <Field label="Từ ngày">
            <Input type="date" value={filters.from} onChange={set('from')} />
          </Field>
          <Field label="Đến ngày">
            <Input type="date" value={filters.to} onChange={set('to')} />
          </Field>
          <Field label="Khu vực">
            <Select value={filters.region_id} onChange={set('region_id')}>
              <option value="">Mọi khu vực</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Loại thiên tai">
            <Select value={filters.disaster_type_id} onChange={set('disaster_type_id')}>
              <option value="">Mọi loại</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="ghost" icon={RotateCcw} disabled={!dirty} onClick={() => setFilters(EMPTY_FILTERS)}>
            Đặt lại
          </Button>
        </div>
        {data && <p className="mt-3 text-xs text-slate-500">Khoảng thời gian: {new Date(data.range.from).toLocaleDateString('vi-VN')} - {new Date(data.range.to).toLocaleDateString('vi-VN')}</p>}
      </Card>

      {error && <Callout tone="danger" className="mb-4">{error}</Callout>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data ? (
          <>
            <StatCard label="Tổng cảnh báo" value={data.alerts.total} icon={Megaphone} tone="blue" />
            <StatCard label="Tổng yêu cầu SOS" value={data.sos.total} icon={Siren} tone="red" />
            <StatCard label="Phản hồi SOS trung bình" value={minutes(data.sos.avg_response_minutes)} icon={Clock} tone="amber" hint="Từ lúc gửi đến khi tiếp nhận" />
            <StatCard label="Hoàn tất cứu hộ trung bình" value={minutes(data.sos.avg_resolution_minutes)} icon={Timer} tone="green" hint="Từ lúc gửi đến khi an toàn" />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[100px] rounded-2xl" />)
        )}
      </div>

      {loading && !data && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      )}

      {data && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ChartCard title="Cảnh báo theo tháng" empty={!data.alerts.by_month.length}>
            <BarChart data={data.alerts.by_month.map((m) => ({ name: monthLabel(m.month), total: Number(m.total) }))} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v) => [v, 'Cảnh báo']} />
              <Bar dataKey="total" fill={ALERT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ChartCard>

          <ChartCard title="SOS theo tháng" empty={!data.sos.by_month.length}>
            <LineChart data={data.sos.by_month.map((m) => ({ name: monthLabel(m.month), total: Number(m.total) }))} margin={{ top: 16, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [v, 'Yêu cầu SOS']} />
              <Line type="monotone" dataKey="total" stroke={SOS_COLOR} strokeWidth={2} dot={{ r: 4, fill: SOS_COLOR, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ChartCard>

          <ChartCard title="Cảnh báo theo loại thiên tai" empty={!data.alerts.by_type.length}>
            <BarChart data={data.alerts.by_type.map((m) => ({ name: m.name, total: Number(m.total) }))} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v) => [v, 'Cảnh báo']} />
              <Bar dataKey="total" fill={ALERT_COLOR} radius={[0, 4, 4, 0]} maxBarSize={28}>
                <LabelList dataKey="total" position="right" style={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard>

          <ChartCard title="Cảnh báo theo tỉnh, thành" empty={!data.alerts.by_region.length}>
            <BarChart data={data.alerts.by_region.map((m) => ({ name: m.name ?? 'Toàn quốc', total: Number(m.total) }))} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v) => [v, 'Cảnh báo']} />
              <Bar dataKey="total" fill={ALERT_COLOR} radius={[0, 4, 4, 0]} maxBarSize={28}>
                <LabelList dataKey="total" position="right" style={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard>

          <ChartCard title="Cảnh báo theo mức độ" empty={!data.alerts.by_severity.length}>
            <BarChart data={data.alerts.by_severity.map((m) => ({ name: `Mức ${m.severity}`, label: SEVERITY_LABELS[m.severity], severity: m.severity, total: Number(m.total) }))} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v, _n, p) => [v, `Cảnh báo (${(p.payload as { label: string }).label})`]} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {data.alerts.by_severity.map((m) => (
                  <Cell key={m.severity} fill={SEVERITY_COLORS[m.severity]} />
                ))}
                <LabelList dataKey="total" position="top" style={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard>

          <ChartCard title="SOS theo trạng thái" empty={!data.sos.total}>
            <BarChart data={sosByStatus} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={100} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v) => [v, 'Yêu cầu']} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {sosByStatus.map((s) => (
                  <Cell key={s.status} fill={SOS_STATUS_COLORS[s.status]} />
                ))}
                <LabelList dataKey="total" position="right" style={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard>
        </div>
      )}
    </>
  );
}

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: ReactElement }) {
  return (
    <Card title={title}>
      {empty ? (
        <EmptyState compact icon={ChartColumn} title="Chưa có dữ liệu" description="Thử mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc." />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
