import { useCallback, useRef, useState } from 'react';

/** Executa uma ação assíncrona impedindo execuções simultâneas (clique duplo). */
export function useAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return { run, busy };
}
