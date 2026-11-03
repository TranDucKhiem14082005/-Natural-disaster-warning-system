import { useCallback, useState } from 'react';

export interface LatLng {
  lat: number;
  lng: number;
}

export function useGeolocation() {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const locate = useCallback((): Promise<LatLng> => {
    setLocating(true);
    setError(null);
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setLocating(false);
        setError('Trình duyệt không hỗ trợ định vị.');
        reject(new Error('unsupported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(p);
          setLocating(false);
          resolve(p);
        },
        (err) => {
          setLocating(false);
          setError(err.code === err.PERMISSION_DENIED ? 'Bạn chưa cho phép truy cập vị trí.' : 'Không lấy được vị trí.');
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }, []);

  return { position, setPosition, error, locating, locate };
}
