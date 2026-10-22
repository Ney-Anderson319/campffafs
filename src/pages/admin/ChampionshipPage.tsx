import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SchoolPicker, useSelectedSchool } from '../../layouts/AdminLayout';
import { useChampionshipData } from '../../hooks/useChampionshipData';
import { changeFormat, createChampionship, getChampionshipData, setChampionshipStatus } from '../../services/championships/championshipService';
import type { ChampionshipFormat, ChampionshipStatus } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ui/StateBlock';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { useAction } from '../../hooks/useAction';
import { friendlyError } from '../../utils/errors';
import { FORMAT_LABEL, STATUS_LABEL, formatDateTime } from '../../utils/format';
import { RoundsManager } from '../../components/admin/RoundsManager';
import { BracketManager } from '../../components/admin/BracketManager';

export function ChampionshipPage() {
  const { schoolId, school, schools } = useSelectedSchool();
  const data = useChampionshipData(schoolId, 'admin');
  const confirm = useConfirm();
  const toast = useToast();
  const { run, busy } = useAction();
  const [newFormat, setNewFormat] = useState<ChampionshipFormat>('points');

  if (schools.length === 0) return <EmptyBlock title="Cadastre uma escola primeiro" />;
  const c = data.championship;

  const create = () =>
    run(async () => {
      if (!schoolId) return;
      try {
        await createChampionship(schoolId, newFormat);
        toast.success('Campeonato criado.');
      } catch (e) {
        toast.error(friendlyError(e));
      }
    });

  const setStatus = (status: ChampionshipStatus) =>
    run(async () => {
      if (!schoolId || !c) return;
      if (status === 'finished') {
        const ok = await confirm({ title: 'Finalizar campeonato?', confirmLabel: 'Finalizar', tone: 'primary', message: 'O campeão passa a ser exibido na área pública conforme a regra configurada. Você pode reabrir depois.' });
        if (!ok) return;
      }
      try {
        await setChampionshipStatus(schoolId, status);
        toast.success('Status atualizado.');
      } catch (e) {
        toast.error(friendlyError(e));
      }
    });

  const switchFormat = () =>
    run(async () => {
      if (!schoolId || !c) return;
      const target: ChampionshipFormat = c.format === 'points' ? 'knockout' : 'points';
      try {
        const existing = await getChampionshipData(schoolId);
        const hasData = existing.rounds + existing.stages + existing.matches > 0;
        const ok = await confirm({
          title: `Trocar para ${FORMAT_LABEL[target]}?`,
          tone: hasData ? 'danger' : 'primary',
          confirmLabel: hasData ? 'Apagar resultados e trocar' : 'Trocar formato',
          message: hasData ? (
            <>
              <p>Este campeonato já tem dados que não servem ao novo formato e serão <strong>apagados</strong>:</p>
              <ul><li>{existing.rounds} queda(s) e {existing.results} resultado(s)</li><li>{existing.stages} fase(s) e {existing.matches} confronto(s)</li></ul>
              <p>O status volta para “Não iniciado”. Esta ação não pode ser desfeita.</p>
            </>
          ) : 'Nenhum resultado foi cadastrado ainda, então nada será perdido.',
        });
        if (!ok) return;
        await changeFormat(schoolId, target, hasData);
        toast.success('Formato alterado.');
      } catch (e) {
        toast.error(friendlyError(e));
      }
    });

  return (
    <>
      <div className="page-head"><h1>Campeonatos e resultados</h1><SchoolPicker /></div>
      {data.loading && <LoadingBlock />}
      {!data.loading && data.error != null && <ErrorBlock message={friendlyError(data.error)} />}
      {!data.loading && !data.error && school && !c && (
        <section className="panel">
          <h2>Criar campeonato de {school.name}</h2>
          <fieldset className="radio-cards">
            <legend className="muted">Escolha o formato (pode ser trocado depois, com confirmação)</legend>
            {(['points', 'knockout'] as const).map((f) => (
              <label key={f} className={`radio-card ${newFormat === f ? 'on' : ''}`}>
                <input type="radio" name="format" checked={newFormat === f} onChange={() => setNewFormat(f)} />
                <strong>{FORMAT_LABEL[f]}</strong>
                <span className="muted small">{f === 'points' ? 'Várias quedas; a classificação soma pontos por colocação e abates.' : 'Confrontos diretos por fase, até a final.'}</span>
              </label>
            ))}
          </fieldset>
          <Button busy={busy} onClick={() => void create()}>Criar campeonato</Button>
        </section>
      )}
      {!data.loading && !data.error && school && c && schoolId && (
        <>
          <section className="panel">
            <div className="panel-head">
              <div className="chips">
                <Badge tone="accent">{FORMAT_LABEL[c.format]}</Badge>
                <Badge tone={c.status === 'finished' ? 'success' : c.status === 'in_progress' ? 'warn' : 'neutral'}>{STATUS_LABEL[c.status]}</Badge>
                <span className="muted small">Criado em {formatDateTime(c.createdAt)} · atualizado em {formatDateTime(c.updatedAt)}</span>
              </div>
              <div className="row-actions">
                <label className="field inline">
                  <span>Status</span>
                  <select value={c.status} disabled={busy} onChange={(e) => void setStatus(e.target.value as ChampionshipStatus)}>
                    {(Object.keys(STATUS_LABEL) as ChampionshipStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </label>
                <Button size="sm" variant="subtle" icon={<RefreshCw size={16} />} disabled={busy} onClick={() => void switchFormat()}>Alterar formato</Button>
              </div>
            </div>
          </section>
          {data.teams.length === 0 && <p className="notice">Esta escola ainda não tem equipes. Cadastre-as em “Equipes”.</p>}
          {c.format === 'points' ? (
            <RoundsManager schoolId={schoolId} championship={c} data={data} />
          ) : (
            <BracketManager schoolId={schoolId} data={data} />
          )}
        </>
      )}
    </>
  );
}
