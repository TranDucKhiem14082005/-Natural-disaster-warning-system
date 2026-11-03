import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { getEcho } from '../../services/echo';
import type { AppNotification, Paginated, User } from '../../types/api';

/** Unread counter + latest realtime alert notification for the signed-in user. */
export function useUnreadNotifications(user: User | null) {
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<AppNotification['data'] | null>(null);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    api
      .get<{ unread_count: number; items: Paginated<AppNotification> }>('/notifications', { unread: 1, per_page: 1 })
      .then((r) => setUnread(r.unread_count))
      .catch(() => {});

    const echo = getEcho();
    if (!echo) return;
    const channel = `App.Models.User.${user.id}`;
    echo.private(channel).notification((n: AppNotification['data']) => {
      setUnread((c) => c + 1);
      setToast(n);
    });
    return () => echo.leave(channel);
  }, [user]);

  return { unread, setUnread, toast, dismissToast: () => setToast(null) };
}
