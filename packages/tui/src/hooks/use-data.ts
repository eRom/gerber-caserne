import { useState, useEffect, useCallback, useRef } from 'react';

export interface DataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): DataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetcher()
      .then((d) => { if (mountedRef.current) setData(d); })
      .catch((e: unknown) => { if (mountedRef.current) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => { mountedRef.current = false; };
  }, [doFetch]);

  return { data, loading, error, refetch: doFetch };
}
