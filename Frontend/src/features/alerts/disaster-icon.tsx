import { Activity, CloudLightning, Droplets, Mountain, Sun, TriangleAlert, Waves, type LucideIcon } from 'lucide-react';
import { SEVERITY_COLORS } from '../../utils/format';

const ICONS: Record<string, LucideIcon> = {
  flood: Waves,
  flash_flood: Droplets,
  storm: CloudLightning,
  landslide: Mountain,
  earthquake: Activity,
  drought: Sun,
};

/** Neutral accent per type, for places without a severity (guides, filters). */
const TYPE_COLORS: Record<string, string> = {
  flood: '#2563eb',
  flash_flood: '#0891b2',
  storm: '#7c3aed',
  landslide: '#b45309',
  earthquake: '#dc2626',
  drought: '#ea580c',
};

export function disasterIcon(code: string | null | undefined): LucideIcon {
  return (code && ICONS[code]) || TriangleAlert;
}

/** Rounded tile with the disaster-type icon, tinted by severity. */
export function DisasterIcon({ code, severity, size = 'md', muted }: { code?: string | null; severity?: number; size?: 'sm' | 'md' | 'lg'; muted?: boolean }) {
  const Icon = disasterIcon(code);
  const color = muted ? '#94a3b8' : severity ? SEVERITY_COLORS[severity] ?? '#64748b' : (code && TYPE_COLORS[code]) || '#64748b';
  const box = { sm: 'h-8 w-8 rounded-lg', md: 'h-11 w-11 rounded-xl', lg: 'h-14 w-14 rounded-2xl' }[size];
  const icon = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' }[size];
  return (
    <span className={`flex shrink-0 items-center justify-center ${box}`} style={{ backgroundColor: `${color}1f`, color }} aria-hidden>
      <Icon className={icon} />
    </span>
  );
}
