import type { Role } from '../types/api';

/** Landing page of each portal; used after login and by the legacy /dashboard redirect. */
export const PORTAL_HOME: Record<Role, string> = {
  citizen: '/me',
  rescuer: '/rescuer',
  officer: '/officer',
  admin: '/admin',
};

export const PORTAL_LABEL: Record<Role, string> = {
  citizen: 'Trang của tôi',
  rescuer: 'Trang cứu hộ',
  officer: 'Trang điều hành',
  admin: 'Trang quản trị',
};

export const PROFILE_PATH: Record<Role, string> = {
  citizen: '/me/profile',
  rescuer: '/rescuer/profile',
  officer: '/officer/profile',
  admin: '/admin/profile',
};

export const STAFF_ROLES: Role[] = ['officer', 'admin'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.[0] ?? '';
  const prev = parts.length > 1 ? (parts[parts.length - 2]?.[0] ?? '') : '';
  return (prev + last).toUpperCase();
}

export const NOTIFICATIONS_PATH: Record<Role, string> = {
  citizen: '/me/notifications',
  rescuer: '/rescuer/notifications',
  officer: '/officer/notifications',
  admin: '/admin/notifications',
};
