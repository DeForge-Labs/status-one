'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function usePolling(fetchFn, interval = 30000, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const fetchRef = useRef(fetchFn);
  const seqRef = useRef(0);

  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  const refresh = useCallback(async () => {
    // Only the most recently started request may update state (slow older responses are dropped).
    const seq = ++seqRef.current;
    const current = () => mountedRef.current && seq === seqRef.current;
    try {
      const result = await fetchRef.current();
      if (current()) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (current()) {
        setError(err);
      }
    } finally {
      if (current()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    refresh();

    // Pause while the tab is hidden; catch up as soon as it is visible again.
    const tick = () => { if (!document.hidden) refresh(); };
    const id = setInterval(tick, interval);
    document.addEventListener('visibilitychange', tick);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, refresh, ...deps]);

  return { data, loading, error, refresh };
}
