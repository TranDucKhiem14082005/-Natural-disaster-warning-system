import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getToken } from './api';

const key = import.meta.env.VITE_REVERB_APP_KEY as string | undefined;

let instance: Echo<'reverb'> | null = null;

/** Null when Reverb is not configured; callers then simply skip realtime. */
export function getEcho(): Echo<'reverb'> | null {
  if (!key) return null;
  if (instance) return instance;

  (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;
  // Default: same origin as the page, `/app` is proxied to Reverb (Vite dev server / Infra nginx).
  const secure = window.location.protocol === 'https:';
  const pagePort = Number(window.location.port || (secure ? 443 : 80));
  const port = Number(import.meta.env.VITE_REVERB_PORT || pagePort);

  instance = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: (import.meta.env.VITE_REVERB_HOST as string) || window.location.hostname,
    wsPort: port,
    wssPort: port,
    forceTLS: secure,
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: (error: Error | null, data: unknown) => void) => {
        fetch('/api/broadcasting/auth', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken() ?? ''}`,
          },
          body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
        })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`auth ${r.status}`))))
          .then((data) => callback(null, data))
          .catch((e: Error) => callback(e, null));
      },
    }),
  });
  return instance;
}

/** Drop the socket on logout so private channels are re-authorised with the next token. */
export function resetEcho() {
  instance?.disconnect();
  instance = null;
}
