import type { AlertStatus, Amenity, ReportStatus, Role, SosCondition, SosStatus } from '../types/api';

export const SEVERITY_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#eab308',
  3: '#f97316',
  4: '#ef4444',
  5: '#7f1d1d',
};

export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Thấp',
  2: 'Trung bình',
  3: 'Cao',
  4: 'Rất cao',
  5: 'Thảm hoạ',
};

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  published: 'Đã phát hành',
  updated: 'Đã cập nhật',
  ended: 'Đã kết thúc',
};

export const SOS_STATUS_LABELS: Record<SosStatus, string> = {
  new: 'Mới',
  received: 'Đã tiếp nhận',
  rescuing: 'Đang cứu hộ',
  safe: 'Đã an toàn',
};

export const SOS_NEXT: Partial<Record<SosStatus, SosStatus>> = {
  new: 'received',
  received: 'rescuing',
  rescuing: 'safe',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

export const CONDITION_LABELS: Record<SosCondition, string> = {
  injured: 'Bị thương',
  trapped: 'Mắc kẹt',
  children: 'Có trẻ em',
  elderly: 'Có người già',
  pregnant: 'Phụ nữ mang thai',
  disabled: 'Người khuyết tật',
};

export const AMENITY_LABELS: Record<Amenity, string> = {
  water: 'Nước sạch',
  medical: 'Y tế',
  power: 'Điện',
  food: 'Thức ăn',
  toilet: 'Nhà vệ sinh',
  wifi: 'Wifi',
};

export const ROLE_LABELS: Record<Role, string> = {
  citizen: 'Người dân',
  rescuer: 'Đội cứu hộ',
  officer: 'Cán bộ',
  admin: 'Quản trị viên',
};

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' });

export function fmtDateTime(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : '-';
}

export function fmtDate(value: string | null | undefined): string {
  return value ? dateOnly.format(new Date(value)) : '-';
}

export function fmtDistance(m: number | null | undefined): string {
  if (m === null || m === undefined) return '-';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** ISO string -> value for <input type="datetime-local">. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
