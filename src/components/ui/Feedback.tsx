import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

/* ---- Toasts ---- */
interface Toast { id: number; kind: 'success' | 'error'; text: string }
interface ToastApi { success: (t: string) => void; error: (t: string) => void }

/* ---- Confirmação ---- */
export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

const ToastCtx = createContext<ToastApi | null>(null);
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : 4000);
  }, []);
  const api = useMemo<ToastApi>(() => ({ success: (t) => push('success', t), error: (t) => push('error', t) }), [push]);

  const [dialog, setDialog] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback<ConfirmFn>((opts) => new Promise((resolve) => setDialog({ opts, resolve })), []);
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <ToastCtx.Provider value={api}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
              {t.kind === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
        {dialog && (
          <Modal
            title={dialog.opts.title}
            onClose={() => close(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
                <Button variant={dialog.opts.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
                  {dialog.opts.confirmLabel ?? 'Confirmar'}
                </Button>
              </>
            }
          >
            <div className="confirm-body">{dialog.opts.message}</div>
          </Modal>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(ToastCtx);
  if (!c) throw new Error('useToast requer FeedbackProvider');
  return c;
}
export function useConfirm(): ConfirmFn {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('useConfirm requer FeedbackProvider');
  return c;
}
