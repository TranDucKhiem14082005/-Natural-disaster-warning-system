import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useAuth } from '../store/auth-context';
import type { Role } from '../types/api';
import { PORTAL_HOME } from '../utils/roles';
import { EmptyState, LinkButton, Spinner } from './ui';

/** Client-side guard for UX only; the API enforces permissions server-side. */
export function RequireRole({ roles, children, redirectOthers }: { roles?: Role[]; children: ReactNode; redirectOthers?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) {
    // Portal roots: send people to the portal that matches their role instead of a dead end.
    if (redirectOthers) return <Navigate to={PORTAL_HOME[user.role]} replace />;
    return (
      <EmptyState
        icon={ShieldX}
        title="Bạn không có quyền truy cập trang này"
        description="Trang này dành cho vai trò khác. Quay về trang của bạn để tiếp tục."
        action={<LinkButton to={PORTAL_HOME[user.role]}>Về trang của tôi</LinkButton>}
      />
    );
  }
  return <>{children}</>;
}
