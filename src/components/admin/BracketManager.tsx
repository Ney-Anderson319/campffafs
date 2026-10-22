import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import type { BracketStage, Match } from '../../types';
import type { useChampionshipData } from '../../hooks/useChampionshipData';
import { createStage, deleteMatch, deleteStage, renameStage, swapStages } from '../../services/matches/matchService';
import { computeOutcome } from '../../features/matches/bracket';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyBlock } from '../ui/StateBlock';
import { PromptModal } from './PromptModal';
import { MatchModal } from './MatchModal';
import { useConfirm, useToast } from '../ui/Feedback';
import { useAction } from '../../hooks/useAction';
import { friendlyError } from '../../utils/errors';
import { MATCH_STATUS_LABEL } from '../../utils/format';

type Data = ReturnType<typeof useChampionshipData>;

export function BracketManager({ schoolId, data }: { schoolId: string; data: Data }) {
  const { stages, matches, teams } = data;
  const [prompt, setPrompt] = useState<{ kind: 'new' } | { kind: 'rename'; stage: BracketStage } | null>(null);
  const [matchModal, setMatchModal] = useState<{ stage: BracketStage; match: Match | null } | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const { run, busy } = useAction();
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name;

  const act = (fn: () => Promise<void>, ok: string) =>
    run(async () => {
      try {
        await fn();
        toast.success(ok);
      } catch (e) {
        toast.error(friendlyError(e));
      }
    });

  const removeStage = async (s: BracketStage) => {
    const ok = await confirm({ title: `Excluir a fase "${s.name}"?`, tone: 'danger', confirmLabel: 'Excluir fase', message: 'Só é possível excluir fases sem confrontos.' });
    if (ok) void act(() => deleteStage(schoolId, s.id), 'Fase excluída.');
  };

  const removeMatch = async (m: Match) => {
    const ok = await confirm({ title: `Excluir "${m.label}"?`, tone: 'danger', confirmLabel: 'Excluir confronto', message: m.status === 'finished' ? 'O confronto está finalizado: o resultado será perdido.' : 'O confronto será removido.' });
    if (ok) void act(() => deleteMatch(schoolId, m.id), 'Confronto excluído.');
  };

  const sourceLabel = (id: string | null) => (id ? `Vencedor de ${matches.find((m) => m.id === id)?.label ?? '—'}` : 'A definir');

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Fases e confrontos</h2>
          <p className="muted small">Crie as fases na ordem (ex.: Quartas, Semifinais, Final) e depois os confrontos de cada uma.</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setPrompt({ kind: 'new' })}>Nova fase</Button>
      </div>
      {stages.length === 0 && <EmptyBlock title="Nenhuma fase criada" message="Crie apenas as fases que existem neste campeonato." />}
      {stages.map((stage, i) => (
        <div key={stage.id} className="stage-admin">
          <div className="stage-admin-head">
            <h3>{stage.name}</h3>
            <div className="row-actions">
              <Button size="sm" variant="subtle" icon={<Plus size={16} />} onClick={() => setMatchModal({ stage, match: null })} disabled={teams.length < 1}>Novo confronto</Button>
              <Button size="sm" variant="ghost" icon={<Pencil size={16} />} aria-label={`Renomear ${stage.name}`} onClick={() => setPrompt({ kind: 'rename', stage })} />
              <Button size="sm" variant="ghost" disabled={busy || i === 0} icon={<ArrowUp size={16} />} aria-label="Mover fase para cima" onClick={() => void act(() => swapStages(schoolId, stage, stages[i - 1]), 'Ordem atualizada.')} />
              <Button size="sm" variant="ghost" disabled={busy || i === stages.length - 1} icon={<ArrowDown size={16} />} aria-label="Mover fase para baixo" onClick={() => void act(() => swapStages(schoolId, stage, stages[i + 1]), 'Ordem atualizada.')} />
              <Button size="sm" variant="danger" disabled={busy} icon={<Trash2 size={16} />} aria-label={`Excluir ${stage.name}`} onClick={() => void removeStage(stage)} />
            </div>
          </div>
          <ul className="row-list">
            {matches.filter((m) => m.stageId === stage.id).map((m) => {
              const o = computeOutcome(m);
              return (
                <li key={m.id} className="row-item">
                  <div className="row-main">
                    <strong>{m.label}</strong>
                    <span className="small">
                      {teamName(m.teamAId) ?? sourceLabel(m.sourceA)} {m.isBye ? <em className="muted">(BYE)</em> : <>× {teamName(m.teamBId) ?? sourceLabel(m.sourceB)}</>}
                      {m.games.length > 0 && !m.isBye && <span className="muted"> · {o.scoreA ?? '—'}–{o.scoreB ?? '—'}</span>}
                    </span>
                  </div>
                  <Badge tone={m.status === 'finished' ? 'success' : m.status === 'in_progress' ? 'accent' : 'neutral'}>{MATCH_STATUS_LABEL[m.status]}</Badge>
                  <div className="row-actions">
                    <Button size="sm" variant="subtle" onClick={() => setMatchModal({ stage, match: m })}>Abrir</Button>
                    <Button size="sm" variant="danger" disabled={busy} icon={<Trash2 size={16} />} aria-label={`Excluir ${m.label}`} onClick={() => void removeMatch(m)} />
                  </div>
                </li>
              );
            })}
            {matches.every((m) => m.stageId !== stage.id) && <li className="muted small pad">Sem confrontos nesta fase.</li>}
          </ul>
        </div>
      ))}

      {prompt?.kind === 'new' && <PromptModal title="Nova fase" label="Nome da fase" confirmLabel="Criar fase" onSubmit={(v) => createStage(schoolId, v)} onClose={() => setPrompt(null)} />}
      {prompt?.kind === 'rename' && <PromptModal title="Renomear fase" label="Nome da fase" initial={prompt.stage.name} onSubmit={(v) => renameStage(schoolId, prompt.stage.id, v)} onClose={() => setPrompt(null)} />}
      {matchModal && (
        <MatchModal schoolId={schoolId} stage={matchModal.stage} stages={stages} match={matchModal.match} matches={matches} teams={teams} onClose={() => setMatchModal(null)} />
      )}
    </section>
  );
}
