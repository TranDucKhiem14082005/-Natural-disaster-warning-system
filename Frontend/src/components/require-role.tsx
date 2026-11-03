import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth-context';
import type { Role } from '../types/api';
import { Spinner } from './ui';

/** Client-side guard for UX only; the API enforces permissions server-side. */
export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return <p className="rounded-lg bg-amber-50 p-4 text-amber-800">Bạn không có quyền truy cập trang này.</p>;
  }
  return <>{children}</>;
}
