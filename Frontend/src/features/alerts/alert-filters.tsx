import { useCatalog } from '../../hooks/use-catalog';
import { inputClass } from '../../components/ui';

export interface AlertFilterValues {
  q: string;
  disaster_type_id: string;
  region_id: string;
  min_severity: string;
  status: string;
  from: string;
  to: string;
}

export const EMPTY_FILTERS: AlertFilterValues = { q: '', disaster_type_id: '', region_id: '', min_severity: '', status: '', from: '', to: '' };

/** Shared filter bar for alerts and events; `statuses` differs per resource. */
export function AlertFilters({
  value,
  onChange,
  statuses,
}: {
  value: AlertFilterValues;
  onChange: (v: AlertFilterValues) => void;
  statuses: [string, string][];
}) {
  const { regions, types } = useCatalog();
  const set = (k: keyof AlertFilterValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
      <input className={`${inputClass} lg:col-span-2`} placeholder="Tìm theo tên, địa điểm..." aria-label="Từ khoá" value={value.q} onChange={set('q')} />
      <select className={inputClass} aria-label="Loại thiên tai" value={value.disaster_type_id} onChange={set('disaster_type_id')}>
        <option value="">Mọi loại</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select className={inputClass} aria-label="Khu vực" value={value.region_id} onChange={set('region_id')}>
        <option value="">Mọi khu vực</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select className={inputClass} aria-label="Mức độ tối thiểu" value={value.min_severity} onChange={set('min_severity')}>
        <option value="">Mọi mức độ</option>
        {[1, 2, 3, 4, 5].map((s) => (
          <option key={s} value={s}>
            Từ mức {s}
          </option>
        ))}
      </select>
      <select className={inputClass} aria-label="Trạng thái" value={value.status} onChange={set('status')}>
        <option value="">Mọi trạng thái</option>
        {statuses.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <div className="flex gap-1">
        <input className={inputClass} type="date" aria-label="Từ ngày" value={value.from} onChange={set('from')} />
        <input className={inputClass} type="date" aria-label="Đến ngày" value={value.to} onChange={set('to')} />
      </div>
    </div>
  );
}
