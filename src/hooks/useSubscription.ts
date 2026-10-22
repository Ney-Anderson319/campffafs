import { useEffect, useState, type DependencyList } from 'react';

type Unsub = () => void;
export type Factory<T> = (emit: (v: T) => void, fail: (e: unknown) => void) => Unsub;

export interface SubState<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
}

/**
 * Assina um listener do Firestore e o cancela automaticamente ao desmontar ou quando `deps` mudam.
 * Passe `null` como factory para não assinar.
 */
export function useSubscription<T>(factory: Factory<T> | null, deps: DependencyList): SubState<T> {
  const [state, setState] = useState<SubState<T>>({ data: undefined, loading: factory !== null, error: null });
  useEffect(() => {
    if (!factory) {
      setState({ data: undefined, loading: false, error: null });
      return;
    }
    setState((s) => ({ data: s.data, loading: true, error: null }));
    return factory(
      (data) => setState({ data, loading: false, error: null }),
      (error) => setState({ data: undefined, loading: false, error }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
