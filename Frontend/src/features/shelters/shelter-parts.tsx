import { Bath, Droplets, HeartPulse, Utensils, Wifi, Zap, type LucideIcon } from 'lucide-react';
import type { Amenity, Shelter } from '../../types/api';
import { Badge } from '../../components/ui';
import { AMENITY_LABELS } from '../../utils/format';

const AMENITY_ICONS: Record<Amenity, LucideIcon> = {
  water: Droplets,
  medical: HeartPulse,
  power: Zap,
  food: Utensils,
  toilet: Bath,
  wifi: Wifi,
};

export function AmenityList({ amenities }: { amenities: Amenity[] | null }) {
  if (!amenities?.length) return <p className="text-xs text-slate-400">Chưa cập nhật tiện ích</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tiện ích">
      {amenities.map((a) => {
        const Icon = AMENITY_ICONS[a];
        return (
          <li key={a} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {Icon && <Icon className="h-3.5 w-3.5 text-slate-500" aria-hidden />}
            {AMENITY_LABELS[a]}
          </li>
        );
      })}
    </ul>
  );
}

export function occupancyPct(s: Pick<Shelter, 'current_occupancy' | 'capacity'>) {
  return s.capacity ? Math.min(100, Math.round((s.current_occupancy / s.capacity) * 100)) : 100;
}

export function AvailabilityBadge({ shelter }: { shelter: Shelter }) {
  if (!shelter.is_active) return <Badge tone="slate">Tạm đóng</Badge>;
  if (shelter.available_slots <= 0) return <Badge tone="slate" dot>Đã đầy</Badge>;
  return occupancyPct(shelter) >= 85 ? <Badge tone="amber" dot>Gần đầy</Badge> : <Badge tone="green" dot>Còn chỗ</Badge>;
}

export function CapacityBar({ shelter }: { shelter: Shelter }) {
  const pct = occupancyPct(shelter);
  const color = pct >= 100 ? 'bg-slate-400' : pct >= 85 ? 'bg-amber-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-800">
          Còn <span className="text-base tabular-nums">{Math.max(0, shelter.available_slots)}</span> chỗ
        </span>
        <span className="tabular-nums text-slate-500">
          {shelter.current_occupancy}/{shelter.capacity} người
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Mức lấp đầy">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
