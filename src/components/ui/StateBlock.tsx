import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <Loader2 className="spin" size={28} aria-hidden />
      <p>{label}</p>
    </div>
  );
}

export function ErrorBlock({ title = 'Não foi possível carregar', message, action }: { title?: string; message: string; action?: ReactNode }) {
  return (
    <div className="state-block state-error" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function EmptyBlock({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="state-block state-empty">
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
