import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Championship, Round } from '../../types';
import type { useChampionshipData } from '../../hooks/useChampionshipData';
import { createRound, deleteRound, finishRound, renameRound, reopenRound, setRoundPublished, swapRounds } from '../../services/rounds/roundService';
import { getClosingStatus, computeStandings } from '../../features/scoring/engine';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyBlock } from '../ui/StateBlock';
import { PromptModal } from './PromptModal';
import { RoundResultsEditor } from './RoundResultsEditor';
import { useConfirm, useToast } from '../ui/Feedback';
import { useAction } from '../../hooks/useAction';
import { friendlyError } from '../../utils/errors';

type Data = ReturnType<typeof useChampionshipData>;

export function RoundsManager({ schoolId, championship, data }: { schoolId: string; championship: Championship; data: Data }) {
  const { rounds, teams } = data;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ kind: 'new' } | { kind: 'rename'; round: Round } | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const { run, busy } = useAction();

  useEffect(() => {
    if (selectedId && !rounds.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [rounds, selectedId]);

  const selected = rounds.find((r) => r.id === selectedId) ?? null;
  const standings = useMemo(
    () => computeStandings({ rules: championship.rules, teams, resultsByRound: data.resultsByRound }),
    [championship.rules, teams, data.resultsByRound],
  );
  const closing = getClosingStatus(championship.rules, rounds.filter((r) => r.status === 'finished').length, standings);

  const act = (fn: () => Promise<void>, okMsg: string) =>
    run(async () => {
      try {
        await fn();
        toast.success(okMsg);
      } catch (e) {
        toast.error(friendlyError(e));
      }
    });

  const move = (i: number, dir: -1 | 1) => {
    const other = rounds[i + dir];
    if (other) void act(() => swapRounds(schoolId, rounds[i], other), 'Ordem atualizada.');
  };

  const togglePublish = async (r: Round) => {
    if (!r.published) {
      const results = data.resultsByRound[r.id] ?? [];
      const incomplete = results.filter((x) => x.status !== 'complete').length;
      if (incomplete > 0 || r.status !== 'finished') {
        const ok = await confirm({
          title: 'Publicar queda não finalizada?',
          confirmLabel: 'Publicar mesmo assim',
          tone: 'primary',
          message: 'A queda aparecerá para o público como “Em andamento”. Resultados incompletos não entram nos totais, e a classificação ficará marcada como parcial.',
        });
        if (!ok) return;
      }
    }
    void act(() => setRoundPublished(schoolId, r.id, !r.published), r.published ? 'Queda ocultada.' : 'Queda publicada.');
  };

  const remove = async (r: Round) => {
    const n = data.resultsByRound[r.id]?.length ?? 0;
    const ok = await confirm({
      title: `Excluir "${r.name}"?`,
      tone: 'danger',
      confirmLabel: 'Excluir queda',
      message: `${n} resultado(s) serão apagados e os totais da classificação serão recalculados. Esta ação não pode ser desfeita.`,
    });
    if (ok) void act(() => deleteRound(schoolId, r.id), 'Queda excluída.');
  };

  const reopen = async (r: Round) => {
    const ok = await confirm({ title: `Reabrir "${r.name}"?`, confirmLabel: 'Reabrir', tone: 'primary', message: 'A queda volta a ser editável. Se estiver publicada, o público verá as alterações em tempo real.' });
    if (ok) void act(() => reopenRound(schoolId, r.id), 'Queda reaberta.');
  };

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Quedas</h2>
            <p className="muted small">{championship.rules.plannedRounds} planejada(s) · {closing.message}{closing.met && ' Finalize o campeonato quando quiser.'}</p>
          </div>
          <Button icon={<Plus size={16} />} onClick={() => setPrompt({ kind: 'new' })}>Nova queda</Button>
        </div>
        {rounds.length === 0 ? (
          <EmptyBlock title="Nenhuma queda criada" message="Crie a primeira queda para lançar posições e abates." />
        ) : (
          <ul className="row-list">
            {rounds.map((r, i) => (
              <li key={r.id} className={`row-item ${r.id === selectedId ? 'selected' : ''}`}>
                <div className="row-main">
                  <strong>{r.name}</strong>
                  <span className="chips">
                    <Badge tone={r.status === 'finished' ? 'success' : 'warn'}>{r.status === 'finished' ? 'Finalizada' : 'Aberta'}</Badge>
                    <Badge tone={r.published ? 'accent' : 'neutral'}>{r.published ? 'Pública' : 'Oculta'}</Badge>
                  </span>
                </div>
                <div className="row-actions">
                  <Button size="sm" variant="subtle" onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}>{r.id === selectedId ? 'Fechar' : 'Resultados'}</Button>
                  <Button size="sm" variant="subtle" disabled={busy} icon={r.published ? <EyeOff size={16} /> : <Eye size={16} />} onClick={() => void togglePublish(r)}>{r.published ? 'Ocultar' : 'Publicar'}</Button>
                  {r.status === 'finished'
                    ? <Button size="sm" variant="subtle" disabled={busy} icon={<LockOpen size={16} />} onClick={() => void reopen(r)}>Reabrir</Button>
                    : <Button size="sm" variant="subtle" disabled={busy} icon={<Lock size={16} />} onClick={() => void act(() => finishRound(schoolId, r.id, championship.rules, teams), 'Queda finalizada.')}>Finalizar</Button>}
                  <Button size="sm" variant="ghost" icon={<Pencil size={16} />} aria-label={`Renomear ${r.name}`} onClick={() => setPrompt({ kind: 'rename', round: r })} />
                  <Button size="sm" variant="ghost" disabled={busy || i === 0} icon={<ArrowUp size={16} />} aria-label="Mover para cima" onClick={() => move(i, -1)} />
                  <Button size="sm" variant="ghost" disabled={busy || i === rounds.length - 1} icon={<ArrowDown size={16} />} aria-label="Mover para baixo" onClick={() => move(i, 1)} />
                  <Button size="sm" variant="danger" disabled={busy} icon={<Trash2 size={16} />} aria-label={`Excluir ${r.name}`} onClick={() => void remove(r)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <RoundResultsEditor key={selected.id} schoolId={schoolId} round={selected} championship={championship} teams={teams} results={data.resultsByRound[selected.id] ?? []} />
      )}

      {prompt?.kind === 'new' && (
        <PromptModal title="Nova queda" label="Nome da queda" initial={`Queda ${rounds.length + 1}`} confirmLabel="Criar queda" onSubmit={(v) => createRound(schoolId, v, rounds)} onClose={() => setPrompt(null)} />
      )}
      {prompt?.kind === 'rename' && (
        <PromptModal title="Renomear queda" label="Nome da queda" initial={prompt.round.name} onSubmit={(v) => renameRound(schoolId, prompt.round.id, v)} onClose={() => setPrompt(null)} />
      )}
    </>
  );
}
