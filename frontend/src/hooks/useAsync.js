import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs an async fetcher on mount and whenever deps change, tracking
 * loading/error/data. Exposes refetch() for re-running after a mutation
 * elsewhere invalidates the data (e.g. after adding an expense).
 *
 * Uses a request-id ref rather than a plain "cancelled" boolean so that if
 * refetch() fires while a previous call is still in flight, only the
 * latest response is allowed to land -- otherwise a slow first response
 * could overwrite a faster second one.
 */
export function useAsync(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const requestId = useRef(0);

  const run = useCallback(() => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (id === requestId.current) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (id === requestId.current) setState({ data: null, error, loading: false });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, refetch: run };
}
