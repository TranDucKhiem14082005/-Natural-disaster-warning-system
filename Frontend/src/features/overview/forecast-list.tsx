import { useState } from 'react';
import { ChevronDown, CloudRain, Wind } from 'lucide-react';
import type { RegionForecast } from '../../types/api';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '../../utils/format';

const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' });

function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  return weekday.format(d);
}

function RiskPill({ level }: { level: number | null }) {
  if (!level) return <span className="text-xs text-slate-400">Chưa có dữ liệu</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: SEVERITY_COLORS[level] }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[level] }} aria-hidden />
      Rủi ro {SEVERITY_LABELS[level]?.toLowerCase()}
    </span>
  );
}

/** Regions sorted by risk; each row shows rain and wind for the next 3 days. */
export function ForecastList({ forecasts, initial = 4 }: { forecasts: RegionForecast[]; initial?: number }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...forecasts].sort((a, b) => (b.max_risk_level ?? 0) - (a.max_risk_level ?? 0) || a.region.name.localeCompare(b.region.name, 'vi'));
  const shown = expanded ? sorted : sorted.slice(0, initial);

  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {shown.map((f) => (
          <li key={f.region.id} className="py-3 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">{f.region.name}</span>
              <RiskPill level={f.max_risk_level} />
            </div>
            {f.days.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {f.days.slice(0, 3).map((d) => (
                  <div key={d.id} className="rounded-lg bg-slate-50 px-2 py-1.5" title={`Mức rủi ro ${d.risk_level}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">{dayLabel(d.forecast_date)}</span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[d.risk_level] }} aria-hidden />
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums text-slate-800">
                      <CloudRain className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                      {Math.round(d.precipitation_mm ?? 0)}
                      <span className="text-[11px] font-normal text-slate-500">mm</span>
                    </p>
                    <p className="flex items-center gap-1 text-[11px] tabular-nums text-slate-500">
                      <Wind className="h-3 w-3" aria-hidden />
                      {Math.round(d.wind_max_kmh ?? 0)} km/h
                    </p>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {sorted.length > initial && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          aria-expanded={expanded}
        >
          {expanded ? 'Thu gọn' : `Xem thêm ${sorted.length - initial} khu vực`}
          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}
    </div>
  );
}
