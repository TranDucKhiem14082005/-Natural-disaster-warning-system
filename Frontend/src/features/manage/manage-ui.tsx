import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Marker } from 'react-leaflet';
import { Baby, Accessibility, HeartPulse, Lock, PersonStanding, Users, LocateFixed, type LucideIcon } from 'lucide-react';
import { BaseMap, FlyTo, MapClick, pinIcon, DEFAULT_CENTER } from '../../components/map/base-map';
import { Button, Field, Modal, Textarea, type ButtonVariant } from '../../components/ui';
import { useGeolocation, type LatLng } from '../../hooks/use-geolocation';
import type { SosCondition } from '../../types/api';
import { CONDITION_LABELS, SEVERITY_COLORS, SEVERITY_LABELS } from '../../utils/format';

export const CONDITION_ICONS: Record<SosCondition, LucideIcon> = {
  injured: HeartPulse,
  trapped: Lock,
  children: Baby,
  elderly: PersonStanding,
  pregnant: Users,
  disabled: Accessibility,
};

export function ConditionChips({ conditions }: { conditions: SosCondition[] | null }) {
  if (!conditions?.length) return <span className="text-xs text-slate-400">Chưa rõ tình trạng</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {conditions.map((c) => {
        const Icon = CONDITION_ICONS[c];
        return (
          <span key={c} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
            <Icon className="h-3 w-3" aria-hidden />
            {CONDITION_LABELS[c]}
          </span>
        );
      })}
    </span>
  );
}

const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

/** "5 phút trước" style label; refreshes on re-render. */
export function timeAgo(value: string | null | undefined): string {
  if (!value) return '-';
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'vừa xong';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function osmLink(lat: number, lng: number, zoom = 17): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

/** Five coloured buttons instead of a slider: severity is a deliberate choice. */
export function SeverityPicker({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Mức độ nguy hiểm" className="grid grid-cols-5 gap-1.5">
      {[1, 2, 3, 4, 5].map((lv) => {
        const active = lv === value;
        return (
          <button
            key={lv}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(lv)}
            className={`flex flex-col items-center rounded-xl border-2 px-1 py-2 text-xs font-semibold transition disabled:opacity-60 ${active ? 'text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            style={active ? { backgroundColor: SEVERITY_COLORS[lv], borderColor: SEVERITY_COLORS[lv] } : undefined}
          >
            <span className="text-base font-bold">{lv}</span>
            <span className="truncate">{SEVERITY_LABELS[lv]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Confirm step for lifecycle actions, with an optional note sent along. */
export function ActionDialog({
  open,
  title,
  description,
  confirmLabel,
  variant = 'primary',
  withNote,
  notePlaceholder,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  variant?: ButtonVariant;
  withNote?: boolean;
  notePlaceholder?: string;
  onConfirm: (note: string | null) => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button
            variant={variant}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(note.trim() || null);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {withNote && (
        <Field label="Ghi chú (tuỳ chọn)" className={children ? 'mt-3' : ''}>
          <Textarea rows={3} maxLength={255} value={note} placeholder={notePlaceholder} onChange={(e) => setNote(e.target.value)} />
        </Field>
      )}
    </Modal>
  );
}

/** Click the map (or use GPS) to choose one point. */
export function MapPointPicker({ value, onChange, className = 'h-64' }: { value: LatLng | null; onChange: (p: LatLng) => void; className?: string }) {
  const geo = useGeolocation();
  // Follow the chosen point (also when a saved one arrives after the map mounted).
  const target = useMemo<[number, number] | null>(() => (value ? [value.lat, value.lng] : null), [value?.lat, value?.lng]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="secondary" size="sm" icon={LocateFixed} loading={geo.locating} onClick={() => geo.locate().then(onChange).catch(() => {})}>
          Vị trí hiện tại
        </Button>
        <span className={value ? 'font-medium tabular-nums text-slate-700' : 'text-slate-500'}>
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Bấm vào bản đồ để chọn vị trí'}
        </span>
        {geo.error && <span className="text-xs text-red-600">{geo.error}</span>}
      </div>
      <BaseMap center={value ? [value.lat, value.lng] : DEFAULT_CENTER} className={className}>
        <MapClick onClick={(e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng })} />
        {value && <Marker position={[value.lat, value.lng]} icon={pinIcon('#1d4ed8')} />}
        <FlyTo position={target} zoom={14} />
      </BaseMap>
    </div>
  );
}

export function OccupancyBar({ current, capacity }: { current: number; capacity: number }) {
  const pct = capacity ? Math.min(100, Math.round((current / capacity) * 100)) : 0;
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="min-w-[8rem]">
      <div className="flex justify-between text-xs">
        <span className="font-semibold tabular-nums text-slate-800">
          {current}/{capacity}
        </span>
        <span className="tabular-nums text-slate-500">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const SOS_PIN_COLORS: Record<string, string> = { new: '#dc2626', received: '#f59e0b', rescuing: '#2563eb', safe: '#16a34a' };

/** Like Field but a <div>: a <label> around buttons/maps would forward clicks to the first button. */
export function FieldGroup({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="text-sm">
      <p className="mb-1.5 font-medium text-slate-700">{label}</p>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** <input type="datetime-local"> value (browser local time) -> ISO with offset; the API would read a bare value as UTC. */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
