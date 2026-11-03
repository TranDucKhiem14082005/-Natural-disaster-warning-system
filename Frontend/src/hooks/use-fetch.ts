import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '../services/api';

interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (fn: (prev: T | null) => T | null) => void;
}

/** Runs `fetcher` whenever `deps` change; ignores responses from superseded calls. */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[], enabled = true): FetchState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);
  const callId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const id = ++callId.current;
    setLoading(true);
    fetcher()
      .then((res) => {
        if (id !== callId.current) return;
        setDataState(res);
        setError(null);
      })
      .catch((err) => id === callId.current && setError(errorText(err)))
      .finally(() => id === callId.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((fn: (prev: T | null) => T | null) => setDataState(fn), []);

  return { data, error, loading, reload, setData };
}
