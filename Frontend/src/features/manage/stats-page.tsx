import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { SosStatus, Stats } from '../../types/api';
import { Card, ErrorBox, Spinner, Stat, inputClass } from '../../components/ui';
import { SEVERITY_COLORS, SOS_STATUS_LABELS } from '../../utils/format';

const SOS_COLORS: Record<SosStatus, string> = { new: '#dc2626', received: '#f97316', rescuing: '#2563eb', safe: '#16a34a' };

export function StatsPage() {
  const { regions, types } = useCatalog();
  const [filters, setFilters] = useState({ from: '', to: '', region_id: '', disaster_type_id: '' });
  const { data, error, loading } = useFetch(() => api.get<Stats>('/manage/stats', filters), [filters]);
  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters({ ...filters, [k]: e.target.value });

  const sosByStatus = data
    ? (Object.keys(SOS_STATUS_LABELS) as SosStatus[]).map((s) => ({ status: s, name: SOS_STATUS_LABELS[s], total: Number(data.sos.by_status[s] ?? 0) })).filter((x) => x.total > 0)
    : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <input type="date" className={inputClass} aria-label="Từ ngày" value={filters.from} onChange={set('from')} />
        <input type="date" className={inputClass} aria-label="Đến ngày" value={filters.to} onChange={set('to')} />
        <select className={inputClass} aria-label="Khu vực" value={filters.region_id} onChange={set('region_id')}>
          <option value="">Mọi khu vực</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className={inputClass} aria-label="Loại" value={filters.disaster_type_id} onChange={set('disaster_type_id')}>
          <option value="">Mọi loại</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <ErrorBox message={error} />
      {loading && !data && <Spinner />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Tổng cảnh báo" value={data.alerts.total} />
            <Stat label="Tổng SOS" value={data.sos.total} tone="text-red-600" />
            <Stat label="Phản hồi SOS TB" value={`${data.sos.avg_response_minutes} ph`} tone="text-amber-600" />
            <Stat label="Hoàn tất cứu hộ TB" value={`${data.sos.avg_resolution_minutes} ph`} tone="text-green-600" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Cảnh báo theo tháng">
              <ChartBox>
                <BarChart data={data.alerts.by_month.map((m) => ({ ...m, total: Number(m.total) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="total" name="Cảnh báo" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartBox>
            </Card>
            <Card title="Cảnh báo theo loại">
              <ChartBox>
                <BarChart data={data.alerts.by_type.map((m) => ({ ...m, total: Number(m.total) }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="total" name="Cảnh báo" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartBox>
            </Card>
            <Card title="Cảnh báo theo tỉnh">
              <ChartBox>
                <BarChart data={data.alerts.by_region.map((m) => ({ name: m.name ?? 'Toàn quốc', total: Number(m.total) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="total" name="Cảnh báo" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartBox>
            </Card>
            <Card title="Cảnh báo theo mức độ">
              <ChartBox>
                <BarChart data={data.alerts.by_severity.map((m) => ({ name: `Mức ${m.severity}`, severity: m.severity, total: Number(m.total) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="total" name="Cảnh báo">
                    {data.alerts.by_severity.map((m) => <Cell key={m.severity} fill={SEVERITY_COLORS[m.severity]} />)}
                  </Bar>
                </BarChart>
              </ChartBox>
            </Card>
            <Card title="SOS theo tháng">
              <ChartBox>
                <LineChart data={data.sos.by_month.map((m) => ({ ...m, total: Number(m.total) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" name="SOS" stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ChartBox>
            </Card>
            <Card title="SOS theo trạng thái">
              <ChartBox>
                <PieChart>
                  <Pie data={sosByStatus} dataKey="total" nameKey="name" outerRadius={90} label>
                    {sosByStatus.map((s) => <Cell key={s.status} fill={SOS_COLORS[s.status]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartBox>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function ChartBox({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
