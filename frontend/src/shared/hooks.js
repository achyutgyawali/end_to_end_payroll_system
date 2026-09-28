import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// GET path (skipped when null), keeps old data while reloading
export function useApi(path) {
  const [state, setState] = useState({ path: null, data: null, error: null, loading: path != null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path == null) return undefined;
    let cancelled = false;
    setState((prev) => ({ path, data: prev.path === path ? prev.data : null, error: null, loading: true }));
    api(path).then(
      (data) => !cancelled && setState({ path, data, error: null, loading: false }),
      (error) => !cancelled && setState({ path, data: null, error, loading: false }),
    );
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: state.data, error: state.error, loading: state.loading, reload };
}

/** Wraps a mutation: tracks pending/error and calls onSuccess with the result. */
export function useAction(fn, { onSuccess } = {}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const run = async (...args) => {
    setPending(true);
    setError(null);
    try {
      const result = await fn(...args);
      await onSuccess?.(result);
      return result;
    } catch (err) {
      setError(err);
      return undefined;
    } finally {
      setPending(false);
    }
  };

  return { run, pending, error, clearError: () => setError(null) };
}
