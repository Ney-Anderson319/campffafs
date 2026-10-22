import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../ui/Feedback';
import { friendlyError } from '../../utils/errors';

interface Props {
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}

/** Pequeno diálogo com um campo de texto (criar/renomear). Só fecha após confirmação da gravação. */
export function PromptModal({ title, label, initial = '', confirmLabel = 'Salvar', onSubmit, onClose }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const { run, busy } = useAction();
  const toast = useToast();

  const submit = () =>
    run(async () => {
      if (!value.trim()) return setError('Preencha o campo.');
      try {
        await onSubmit(value);
        toast.success('Salvo.');
        onClose();
      } catch (e) {
        setError(friendlyError(e));
      }
    });

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button busy={busy} onClick={() => void submit()}>{confirmLabel}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="field">
          <span>{label}</span>
          <input value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} maxLength={100} aria-invalid={!!error} />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
