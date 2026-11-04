import { useState, type ReactNode } from 'react';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useCatalog } from '../../hooks/use-catalog';
import { Button, Field, Input, Select } from '../../components/ui';

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

/** Filters other than the keyword and status, which have their own controls. */
function advancedCount(v: AlertFilterValues) {
  return [v.disaster_type_id, v.region_id, v.min_severity, v.from, v.to].filter(Boolean).length;
}

/**
 * Shared filter bar for alerts and events: search box always visible, the rest folds away on phones.
 * `extra` renders next to the toggle (e.g. "Gần tôi").
 */
export function AlertFilters({
  value,
  onChange,
  placeholder = 'Tìm theo tên, địa điểm...',
  extra,
}: {
  value: AlertFilterValues;
  onChange: (v: AlertFilterValues) => void;
  placeholder?: string;
  extra?: ReactNode;
}) {
  const { regions, types } = useCatalog();
  const [open, setOpen] = useState(false);
  const set = (k: keyof AlertFilterValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  const count = advancedCount(value);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input icon={Search} className="min-w-0 flex-1 basis-60" placeholder={placeholder} aria-label="Từ khoá" value={value.q} onChange={set('q')} type="search" />
        <Button variant={count ? 'soft' : 'secondary'} icon={SlidersHorizontal} onClick={() => setOpen((o) => !o)} aria-expanded={open} className="lg:hidden">
          Bộ lọc{count ? ` (${count})` : ''}
        </Button>
        {extra}
      </div>
      <div className={`${open ? 'grid' : 'hidden'} gap-3 [&>*]:min-w-0 sm:grid-cols-2 lg:grid lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)_auto] lg:items-end`}>
        <Field label="Loại thiên tai">
          <Select value={value.disaster_type_id} onChange={set('disaster_type_id')}>
            <option value="">Tất cả</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Khu vực">
          <Select value={value.region_id} onChange={set('region_id')}>
            <option value="">Tất cả</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mức nguy hiểm">
          <Select value={value.min_severity} onChange={set('min_severity')}>
            <option value="">Mọi mức</option>
            {[2, 3, 4, 5].map((s) => (
              <option key={s} value={s}>
                Từ mức {s} trở lên
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Khoảng thời gian">
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="Từ ngày" className="min-w-0 flex-1" value={value.from} onChange={set('from')} max={value.to || undefined} />
            <span className="text-slate-400">-</span>
            <Input type="date" aria-label="Đến ngày" className="min-w-0 flex-1" value={value.to} onChange={set('to')} min={value.from || undefined} />
          </div>
        </Field>
        <Button variant="ghost" icon={RotateCcw} disabled={!count && !value.q} onClick={() => onChange({ ...EMPTY_FILTERS, status: value.status })}>
          Xoá lọc
        </Button>
      </div>
    </div>
  );
}
