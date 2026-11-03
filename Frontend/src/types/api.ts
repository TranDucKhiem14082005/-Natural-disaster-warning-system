export type Role = 'citizen' | 'rescuer' | 'officer' | 'admin';
export type AlertStatus = 'draft' | 'pending' | 'published' | 'updated' | 'ended';
export type SosStatus = 'new' | 'received' | 'rescuing' | 'safe';
export type ReportStatus = 'pending' | 'approved' | 'rejected';
export type SosCondition = 'injured' | 'children' | 'elderly' | 'trapped' | 'pregnant' | 'disabled';
export type Amenity = 'water' | 'medical' | 'power' | 'food' | 'toilet' | 'wifi';

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface Region {
  id: number;
  code: string;
  name: string;
  center_lat: number;
  center_lng: number;
}

export interface DisasterType {
  id: number;
  code: string;
  name: string;
  icon: string | null;
  default_instructions?: string | null;
}

export interface UserLocation {
  id: number;
  label: string;
  address: string | null;
  lat: number;
  lng: number;
}

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  region_id: number | null;
  is_active: boolean;
  region?: Region | null;
  locations?: UserLocation[];
  created_at?: string;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface Alert {
  id: number;
  title: string;
  description: string | null;
  instructions: string | null;
  disaster_type_id: number;
  disaster_event_id: number | null;
  region_id: number | null;
  severity: number;
  status: AlertStatus;
  source: string;
  version: number;
  area_type: 'polygon' | 'circle';
  area_geojson: GeoPolygon;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  effective_from: string | null;
  effective_to: string | null;
  published_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  type?: DisasterType;
  region?: Pick<Region, 'id' | 'name'> | null;
  creator?: { id: number; name: string } | null;
}

export interface AlertVersion {
  id: number;
  version: number;
  status: AlertStatus;
  note: string | null;
  created_at: string;
  editor?: { id: number; name: string } | null;
}

export type AlertArea =
  | { type: 'polygon'; coordinates: [number, number][] }
  | { type: 'circle'; center: { lat: number; lng: number }; radius_m: number };

export interface DisasterEvent {
  id: number;
  name: string;
  disaster_type_id: number;
  region_id: number | null;
  severity: number;
  status: 'ongoing' | 'ended';
  description: string | null;
  lat: number | null;
  lng: number | null;
  started_at: string;
  ended_at: string | null;
  source: string;
  alerts_count?: number;
  type?: DisasterType;
  region?: Pick<Region, 'id' | 'name'> | null;
  alerts?: Alert[];
}

export interface TimelineFrame {
  alert_id: number;
  version: number;
  status: AlertStatus;
  at: string;
  severity: number | null;
  area_geojson: GeoPolygon | null;
}

export interface Shelter {
  id: number;
  name: string;
  address: string | null;
  region_id: number | null;
  lat: number;
  lng: number;
  capacity: number;
  current_occupancy: number;
  available_slots: number;
  amenities: Amenity[] | null;
  contact_phone: string | null;
  is_active: boolean;
  distance_m?: number;
}

export interface Report {
  id: number;
  user_id: number;
  disaster_type_id: number;
  region_id: number | null;
  description: string;
  lat: number;
  lng: number;
  media: string[] | null;
  media_urls: string[];
  status: ReportStatus;
  confirm_count: number;
  review_note: string | null;
  created_at: string;
  type?: DisasterType;
  user?: { id: number; name: string; phone?: string | null } | null;
  region?: Pick<Region, 'id' | 'name'> | null;
}

export interface SosRequest {
  id: number;
  tracking_code: string;
  user_id: number | null;
  contact_name: string | null;
  contact_phone: string;
  region_id: number | null;
  lat: number;
  lng: number;
  people_count: number;
  conditions: SosCondition[] | null;
  note: string | null;
  priority: number;
  status: SosStatus;
  is_verified: boolean;
  assigned_to: number | null;
  created_at: string;
  received_at: string | null;
  rescuing_at: string | null;
  safe_at: string | null;
  assignee?: { id: number; name: string; phone: string | null } | null;
  region?: Pick<Region, 'id' | 'name'> | null;
  user?: { id: number; name: string } | null;
}

export interface SosTracking {
  tracking_code: string;
  status: SosStatus;
  people_count: number;
  created_at: string;
  received_at: string | null;
  rescuing_at: string | null;
  safe_at: string | null;
  rescuer: { name: string; phone: string | null } | null;
}

export interface RescuerSuggestion {
  id: number;
  name: string;
  phone: string | null;
  open_sos_count: number;
  distance_m: number | null;
}

export interface Overview {
  active_alerts: number;
  severe_alerts: number;
  ongoing_events: number;
  open_shelters: number;
  latest_alerts: Alert[];
}

export interface WeatherReading {
  id: number;
  region_id: number;
  forecast_date: string;
  precipitation_mm: number | null;
  wind_max_kmh: number | null;
  temperature_max: number | null;
  risk_level: number;
}

export interface RegionForecast {
  region: Region;
  max_risk_level: number | null;
  days: WeatherReading[];
}

export interface EvacuationPlan {
  shelter: Shelter;
  origin_in_danger_zone: boolean;
  danger_alert_ids: number[];
  route: {
    provider: 'straight_line' | 'openrouteservice';
    distance_m: number;
    duration_s?: number;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  };
}

export interface Guide {
  id: number;
  disaster_type_id: number | null;
  title: string;
  slug: string;
  content?: string;
  is_published?: boolean;
  updated_at: string;
  type?: Pick<DisasterType, 'id' | 'code' | 'name'> | null;
}

export interface EmergencyContact {
  id: number;
  name: string;
  phone: string;
  description: string | null;
  region_id: number | null;
  sort_order: number;
}

export interface AppNotification {
  id: string;
  type: string;
  data: { alert_id: number; title: string; severity: number; status: AlertStatus; version: number; instructions: string | null };
  read_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  method: string;
  path: string;
  route_name: string | null;
  payload: Record<string, unknown> | null;
  status_code: number;
  ip_address: string | null;
  created_at: string;
  user?: { id: number; name: string; role: Role } | null;
}

export interface CitizenDashboard {
  role: 'citizen';
  locations: { location: UserLocation; alerts: Alert[]; nearest_shelter: Shelter | null }[];
  unread_notifications: number;
  open_sos: SosRequest[];
}

export interface RescuerDashboard {
  role: 'rescuer';
  open_assigned: SosRequest[];
  completed_count: number;
}

export interface StaffDashboard {
  role: 'officer' | 'admin';
  region: Region | null;
  sos_unhandled: number;
  sos_in_progress: number;
  reports_pending: number;
  alerts_pending: number;
  alerts_active: number;
}

export type Dashboard = CitizenDashboard | RescuerDashboard | StaffDashboard;

export interface Stats {
  range: { from: string; to: string };
  alerts: {
    total: number;
    by_month: { month: string; total: number }[];
    by_type: { code: string; name: string; total: number }[];
    by_region: { region_id: number | null; name: string | null; total: number }[];
    by_severity: { severity: number; total: number }[];
  };
  sos: {
    total: number;
    by_status: Partial<Record<SosStatus, number>>;
    by_month: { month: string; total: number }[];
    avg_response_minutes: number;
    avg_resolution_minutes: number;
  };
}

export interface Feature<P> {
  type: 'Feature';
  geometry: GeoPolygon | { type: 'Point'; coordinates: [number, number] };
  properties: P;
}

export interface FeatureCollection<P> {
  type: 'FeatureCollection';
  features: Feature<P>[];
}

export interface MapLayers {
  alerts?: FeatureCollection<{
    id: number;
    title: string;
    severity: number;
    status: AlertStatus;
    disaster_type: string | null;
    area_type: string;
  }>;
  shelters?: FeatureCollection<{ id: number; name: string; capacity: number; available_slots: number; amenities: Amenity[] | null }>;
  reports?: FeatureCollection<{ id: number; disaster_type: string | null; description: string; confirm_count: number; created_at: string }>;
  sos?: FeatureCollection<{ id: number; status: SosStatus; priority: number; people_count: number; conditions: SosCondition[] | null; assigned_to: number | null }>;
}
