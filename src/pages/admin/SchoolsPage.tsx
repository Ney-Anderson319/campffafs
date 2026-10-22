import { useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSelectedSchool } from '../../layouts/AdminLayout';
import type { School } from '../../types';
import { deleteSchoolCascade, getSchoolImpact, newSchoolId, saveSchool, setSchoolPublished } from '../../services/schools/schoolService';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Logo } from '../../components/ui/Logo';
import { EmptyBlock } from '../../components/ui/StateBlock';
import { LogoInput } from '../../components/admin/LogoInput';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { useAction } from '../../hooks/useAction';
import { friendlyError } from '../../utils/errors';
import { formatDateTime } from '../../utils/format';

export function SchoolsPage() {
  const { schools } = useSelectedSchool();
  const [editing, setEditing] = useState<School | 'new' | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const { run, busy } = useAction();

  const togglePublish = (s: School) =>
    run(async () => {
      try {
        await setSchoolPublished(s.id, !s.published);
        toast.success(s.published ? 'Escola ocultada do público.' : 'Escola publicada.');
      } catch (e) {
        toast.error(friendlyError(e));
      }
    });

  const remove = (s: School) =>
    run(async () => {
      try {
        const impact = await getSchoolImpact(s.id);
        const ok = await confirm({
          title: `Excluir "${s.name}"?`,
          tone: 'danger',
          confirmLabel: 'Excluir definitivamente',
          message: (
            <>
              <p>Esta ação não pode ser desfeita e também apagará:</p>
              <ul>
                <li>{impact.teams} equipe(s) e seus logos</li>
                <li>{impact.hasChampionship ? 'O campeonato configurado' : 'Nenhum campeonato configurado'}</li>
                <li>{impact.rounds} queda(s) com todos os resultados</li>
                <li>{impact.stages} fase(s) e {impact.matches} confronto(s)</li>
              </ul>
              <p>Se preferir manter os dados, apenas oculte a escola do público.</p>
            </>
          ),
        });
        if (!ok) return;
        await deleteSchoolCascade(s.id);
        toast.success('Escola excluída.');
      } catch (e) {
        toast.error(friendlyError(e));
      }
    });

  return (
    <>
      <div className="page-head">
        <h1>Escolas</h1>
        <Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>Nova escola</Button>
      </div>
      {schools.length === 0 ? (
        <EmptyBlock title="Nenhuma escola cadastrada" message="Cadastre a primeira escola para começar." />
      ) : (
        <ul className="row-list">
          {schools.map((s) => (
            <li key={s.id} className="row-item">
              <Logo url={s.logoUrl} name={s.name} size={44} />
              <div className="row-main">
                <strong>{s.name}</strong>
                <span className="muted small">Atualizada em {formatDateTime(s.updatedAt)}</span>
              </div>
              <Badge tone={s.published ? 'success' : 'neutral'}>{s.published ? 'Publicada' : 'Oculta'}</Badge>
              <div className="row-actions">
                <Button size="sm" variant="subtle" disabled={busy} icon={s.published ? <EyeOff size={16} /> : <Eye size={16} />} onClick={() => void togglePublish(s)}>
                  {s.published ? 'Ocultar' : 'Publicar'}
                </Button>
                <Button size="sm" variant="subtle" icon={<Pencil size={16} />} onClick={() => setEditing(s)} aria-label={`Editar ${s.name}`}>Editar</Button>
                <Button size="sm" variant="danger" disabled={busy} icon={<Trash2 size={16} />} onClick={() => void remove(s)} aria-label={`Excluir ${s.name}`}>Excluir</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <SchoolForm school={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SchoolForm({ school, onClose }: { school: School | null; onClose: () => void }) {
  const id = useRef(school?.id ?? newSchoolId()).current; // ID fixo: reenvio acidental não duplica
  const [name, setName] = useState(school?.name ?? '');
  const [description, setDescription] = useState(school?.description ?? '');
  const [published, setPublished] = useState(school?.published ?? false);
  const [image, setImage] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const { run, busy } = useAction();
  const nameError = useMemo(() => (name.trim() ? null : 'Informe o nome da escola.'), [name]);

  const submit = () =>
    run(async () => {
      if (nameError) return setError(nameError);
      try {
        await saveSchool({ id, isNew: !school, name, description, published, logoDataUrl: image ?? undefined, removeLogo: remove, existing: school });
        toast.success(school ? 'Escola atualizada.' : 'Escola criada.');
        onClose();
      } catch (e) {
        setError(friendlyError(e));
      }
    });

  return (
    <Modal
      title={school ? 'Editar escola' : 'Nova escola'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={busy || processing} onClick={onClose}>Cancelar</Button>
          <Button busy={busy} disabled={processing} onClick={() => void submit()}>Salvar escola</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="field">
          <span>Nome da escola</span>
          <input value={name} maxLength={100} onChange={(e) => { setName(e.target.value); setError(null); }} aria-invalid={!!error && !!nameError} />
        </label>
        <label className="field">
          <span>Descrição (opcional)</span>
          <textarea rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <LogoInput name={name} currentUrl={school?.logoUrl ?? null} image={image} remove={remove} onChange={(value, r) => { setImage(value); setRemove(r); }} onError={setError} onProcessingChange={setProcessing} />
        <label className="check">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publicar na área pública
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
