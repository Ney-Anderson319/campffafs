import { useMemo, useRef, useState } from 'react';
import type { BracketStage, GameScore, Match, Team } from '../../types';
import { finishMatch, newMatchId, reopenMatch, saveMatch } from '../../services/matches/matchService';
import { computeOutcome, validateMatchDraft } from '../../features/matches/bracket';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useConfirm, useToast } from '../ui/Feedback';
import { useAction } from '../../hooks/useAction';
import { friendlyError } from '../../utils/errors';

interface Props {
  schoolId: string;
  stage: BracketStage;
  stages: BracketStage[];
  match: Match | null;
  matches: Match[];
  teams: Team[];
  onClose: () => void;
}

type SlotSource = 'team' | 'match';

export function MatchModal({ schoolId, stage, stages, match, matches, teams, onClose }: Props) {
  const id = useRef(match?.id ?? newMatchId(schoolId)).current;
  const finished = match?.status === 'finished';
  const [label, setLabel] = useState(match?.label ?? `${stage.name} ${matches.filter((m) => m.stageId === stage.id).length + 1}`);
  const [bestOf, setBestOf] = useState(match?.bestOf ?? 1);
  const [isBye, setIsBye] = useState(match?.isBye ?? false);
  const [srcKindA, setSrcKindA] = useState<SlotSource>(match?.sourceA ? 'match' : 'team');
  const [srcKindB, setSrcKindB] = useState<SlotSource>(match?.sourceB ? 'match' : 'team');
  const [teamA, setTeamA] = useState(match?.teamAId ?? '');
  const [teamB, setTeamB] = useState(match?.teamBId ?? '');
  const [sourceA, setSourceA] = useState(match?.sourceA ?? '');
  const [sourceB, setSourceB] = useState(match?.sourceB ?? '');
  const [games, setGames] = useState<Array<{ a: string; b: string }>>(
    (match?.games ?? []).map((g) => ({ a: String(g.a), b: String(g.b) })),
  );
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const { run, busy } = useAction();

  const structureLocked = !!match && match.status !== 'waiting'; // equipes não mudam depois de iniciado
  const stageOrder = stage.order;
  const earlier = matches.filter((m) => {
    const s = stages.find((x) => x.id === m.stageId);
    return m.id !== id && !!s && s.order < stageOrder;
  });
  const parsedGames: GameScore[] = games.map((g) => ({ a: Number(g.a), b: Number(g.b) }));
  const gamesFilled = games.filter((g) => g.a.trim() !== '' || g.b.trim() !== '');
  const complete = gamesFilled.every((g) => g.a.trim() !== '' && g.b.trim() !== '');
  const effectiveGames = complete ? parsedGames.slice(0, gamesFilled.length).filter((_, i) => games[i].a.trim() !== '') : [];

  // Equipes efetivas para pré-visualizar o resultado
  const effA = srcKindA === 'match' && match?.sourceA ? match.teamAId : srcKindA === 'team' ? teamA || null : match?.teamAId ?? null;
  const effB = isBye ? null : srcKindB === 'match' ? match?.teamBId ?? null : teamB || null;
  const preview = useMemo(
    () => computeOutcome({ teamAId: effA, teamBId: effB, isBye, bestOf, games: effectiveGames }),
    [effA, effB, isBye, bestOf, effectiveGames],
  );

  const nameOf = (tid: string | null) => teams.find((t) => t.id === tid)?.name ?? '—';
  const slots = Math.min(bestOf, 7);

  const setGame = (i: number, side: 'a' | 'b', v: string) => {
    setError(null);
    setGames((prev) => {
      const next = [...prev];
      while (next.length < slots) next.push({ a: '', b: '' });
      next[i] = { ...next[i], [side]: v };
      return next;
    });
  };

  const input = () => ({
    id,
    isNew: !match,
    stageId: stage.id,
    label,
    teamAId: srcKindA === 'team' ? teamA || null : null,
    teamBId: isBye || srcKindB === 'match' ? null : teamB || null,
    sourceA: srcKindA === 'match' ? sourceA || null : null,
    sourceB: isBye || srcKindB === 'team' ? null : sourceB || null,
    bestOf,
    isBye,
    games: complete ? effectiveGames : [],
    status: 'waiting' as const,
  });

  const save = () =>
    run(async () => {
      if (!complete) return setError('Preencha os dois lados de cada partida ou deixe a linha vazia.');
      try {
        await saveMatch(schoolId, input(), teams.map((t) => t.id));
        toast.success('Confronto salvo.');
        onClose();
      } catch (e) {
        setError(friendlyError(e));
      }
    });

  const finish = () =>
    run(async () => {
      if (!complete) return setError('Preencha os dois lados de cada partida ou deixe a linha vazia.');
      try {
        if (!finished) {
          // garante que a estrutura (times/origens) esteja salva antes de finalizar
          await saveMatch(schoolId, { ...input(), games: [] }, teams.map((t) => t.id));
        }
        let plan = await finishMatch(schoolId, id, effectiveGames);
        if (!plan.ok && plan.needsConfirmation) {
          const ok = await confirm({
            title: 'Alterar o vencedor reiniciará fases seguintes',
            tone: 'danger',
            confirmLabel: 'Confirmar e reiniciar',
            message: (
              <>
                <p>Os confrontos abaixo já tinham resultado e serão reiniciados:</p>
                <ul>{plan.affected.map((m) => <li key={m.id}>{m.label}</li>)}</ul>
              </>
            ),
          });
          if (!ok) return;
          plan = await finishMatch(schoolId, id, effectiveGames, true);
        }
        if (!plan.ok) return setError(plan.error);
        toast.success(finished ? 'Resultado corrigido.' : 'Confronto finalizado e vencedor avançou.');
        onClose();
      } catch (e) {
        setError(friendlyError(e));
      }
    });

  const reopen = () =>
    run(async () => {
      try {
        let plan = await reopenMatch(schoolId, id);
        if (!plan.ok && plan.needsConfirmation) {
          const ok = await confirm({ title: 'Reabrir reiniciará fases seguintes', tone: 'danger', confirmLabel: 'Reabrir e reiniciar', message: <ul>{plan.affected.map((m) => <li key={m.id}>{m.label}</li>)}</ul> });
          if (!ok) return;
          plan = await reopenMatch(schoolId, id, true);
        }
        if (!plan.ok) return setError(plan.error);
        toast.success('Confronto reaberto.');
        onClose();
      } catch (e) {
        setError(friendlyError(e));
      }
    });

  const draftErrors = validateMatchDraft(
    { id, stageId: stage.id, teamAId: srcKindA === 'team' ? teamA || null : null, teamBId: isBye || srcKindB === 'match' ? null : teamB || null, sourceA: srcKindA === 'match' ? sourceA || null : null, sourceB: isBye || srcKindB === 'team' ? null : sourceB || null, isBye, bestOf },
    matches,
    stages,
  );

  const slotEditor = (side: 'A' | 'B') => {
    const kind = side === 'A' ? srcKindA : srcKindB;
    const setKind = side === 'A' ? setSrcKindA : setSrcKindB;
    const team = side === 'A' ? teamA : teamB;
    const setTeam = side === 'A' ? setTeamA : setTeamB;
    const src = side === 'A' ? sourceA : sourceB;
    const setSrc = side === 'A' ? setSourceA : setSourceB;
    return (
      <fieldset className="slot-editor" disabled={structureLocked}>
        <legend>Time {side}</legend>
        <div className="seg">
          <button type="button" className={kind === 'team' ? 'on' : ''} onClick={() => setKind('team')}>Equipe</button>
          <button type="button" className={kind === 'match' ? 'on' : ''} onClick={() => setKind('match')}>Vencedor de confronto</button>
        </div>
        {kind === 'team' ? (
          <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label={`Equipe do slot ${side}`}>
            <option value="">A definir</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : (
          <select value={src} onChange={(e) => setSrc(e.target.value)} aria-label={`Confronto de origem do slot ${side}`}>
            <option value="">Selecione…</option>
            {earlier.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        )}
      </fieldset>
    );
  };

  return (
    <Modal
      title={match ? `Confronto — ${match.label}` : `Novo confronto — ${stage.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {finished ? (
            <>
              <Button variant="subtle" busy={busy} onClick={() => void reopen()}>Reabrir confronto</Button>
              <Button busy={busy} onClick={() => void finish()}>Salvar correção</Button>
            </>
          ) : (
            <>
              <Button variant="subtle" busy={busy} onClick={() => void save()}>Salvar</Button>
              <Button busy={busy} disabled={!match && false} onClick={() => void finish()}>Finalizar e avançar vencedor</Button>
            </>
          )}
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>Identificação</span>
          <input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} disabled={finished} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Formato da série</span>
            <select value={bestOf} disabled={structureLocked} onChange={(e) => setBestOf(Number(e.target.value))}>
              {[1, 3, 5, 7].map((n) => <option key={n} value={n}>{n === 1 ? 'Partida única' : `Melhor de ${n}`}</option>)}
            </select>
          </label>
          <label className="check bye">
            <input type="checkbox" checked={isBye} disabled={structureLocked} onChange={(e) => setIsBye(e.target.checked)} />
            Avanço direto (BYE): sem adversário
          </label>
        </div>
        <div className="grid-2">
          {slotEditor('A')}
          {isBye ? <div className="slot-editor muted">Sem adversário (BYE).</div> : slotEditor('B')}
        </div>

        {!isBye && (
          <div className="field">
            <span>Placar {bestOf > 1 ? 'por partida' : 'da partida'} ({nameOf(effA)} × {nameOf(effB)})</span>
            <div className="games">
              {Array.from({ length: slots }).map((_, i) => (
                <div key={i} className="game-row">
                  {bestOf > 1 && <span className="muted small">Partida {i + 1}</span>}
                  <input className="num-input" inputMode="numeric" aria-label={`Partida ${i + 1}, time A`} value={games[i]?.a ?? ''} onChange={(e) => setGame(i, 'a', e.target.value)} />
                  <span>×</span>
                  <input className="num-input" inputMode="numeric" aria-label={`Partida ${i + 1}, time B`} value={games[i]?.b ?? ''} onChange={(e) => setGame(i, 'b', e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="preview">
          {preview.decided
            ? <Badge tone="success">Vencedor: {nameOf(preview.winnerId)}</Badge>
            : <span className="muted small">{preview.error}</span>}
          {bestOf > 1 && preview.scoreA != null && <span className="small">Série: {preview.scoreA}–{preview.scoreB}</span>}
        </div>
        {draftErrors.length > 0 && <p className="field-error small">{draftErrors[0]}</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
