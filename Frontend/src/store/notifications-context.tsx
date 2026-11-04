import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Route as RouteIcon, TriangleAlert, X } from 'lucide-react';
import { api } from '../services/api';
import { getEcho } from '../services/echo';
import type { AppNotification, Paginated } from '../types/api';
import { useAuth } from './auth-context';
import { SEVERITY_LABELS } from '../utils/format';

interface NotificationsState {
  unread: number;
  /** Re-read the counter after the notifications page marks items read. */
  refreshUnread: () => void;
}

const NotificationsContext = createContext<NotificationsState>({ unread: 0, refreshUnread: () => {} });

/** Unread counter for every portal's bell + the realtime "alert in your area" banner. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<AppNotification['data'] | null>(null);

  const refreshUnread = useCallback(() => {
    if (!user) return;
    api
      .get<{ unread_count: number; items: Paginated<AppNotification> }>('/notifications', { unread: 1, per_page: 1 })
      .then((r) => setUnread(r.unread_count))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    refreshUnread();
    const echo = getEcho();
    if (!echo) return;
    const channel = `App.Models.User.${user.id}`;
    echo.private(channel).notification((n: AppNotification['data']) => {
      setUnread((c) => c + 1);
      setToast(n);
    });
    return () => echo.leave(channel);
  }, [user, refreshUnread]);

  const value = useMemo(() => ({ unread, refreshUnread }), [unread, refreshUnread]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {toast && <AlertBanner data={toast} onClose={() => setToast(null)} />}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

function AlertBanner({ data, onClose }: { data: AppNotification['data']; onClose: () => void }) {
  const severe = data.severity >= 4;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[2400] flex justify-center p-3">
      <div className={`w-full max-w-xl animate-slide-up overflow-hidden rounded-2xl text-white shadow-2xl ${severe ? 'bg-red-600' : 'bg-orange-500'}`}>
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <TriangleAlert className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-white/85">
              Cảnh báo trong khu vực của bạn · Mức {data.severity} {SEVERITY_LABELS[data.severity] ?? ''}
            </p>
            <p className="mt-0.5 text-lg font-bold leading-snug">{data.title}</p>
            {data.instructions && <p className="mt-1 line-clamp-3 text-sm text-white/90">{data.instructions}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={`/alerts/${data.alert_id}`} onClick={onClose} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-white/90">
                Xem chi tiết
              </Link>
              <Link to="/evacuation" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">
                <RouteIcon className="h-4 w-4" aria-hidden />
                Tuyến sơ tán
              </Link>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Đóng cảnh báo">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
