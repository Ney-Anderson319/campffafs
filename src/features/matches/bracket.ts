/**
 * Lógica pura do mata-mata: placar, vencedor, validação e avanço de fase.
 * Nenhuma função aqui acessa Firebase; os serviços aplicam os "patches" retornados.
 */
import type { GameScore, Match } from '../../types';

export type MatchPatch = Partial<
  Pick<Match, 'teamAId' | 'teamBId' | 'scoreA' | 'scoreB' | 'games' | 'status' | 'winnerId'>
>;

export interface MatchOutcome {
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  decided: boolean;
  error?: string;
}

const isNonNegInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

const undecided = (error: string, scoreA: number | null = null, scoreB: number | null = null): MatchOutcome => ({
  scoreA,
  scoreB,
  winnerId: null,
  decided: false,
  error,
});

export function computeOutcome(
  m: Pick<Match, 'teamAId' | 'teamBId' | 'isBye' | 'bestOf' | 'games'>,
): MatchOutcome {
  if (m.isBye) {
    if (m.teamAId && !m.teamBId) return { scoreA: null, scoreB: null, winnerId: m.teamAId, decided: true };
    return undecided('BYE exige exatamente uma equipe definida no slot A.');
  }
  if (!m.teamAId || !m.teamBId) return undecided('Defina as duas equipes do confronto.');
  const games = m.games ?? [];
  for (const g of games) {
    if (!isNonNegInt(g.a) || !isNonNegInt(g.b)) return undecided('Pontuações devem ser inteiros não negativos.');
  }
  if (games.length === 0) return undecided('Nenhuma partida registrada.');

  if (m.bestOf === 1) {
    if (games.length > 1) return undecided('Confronto de uma partida só aceita um placar.');
    const [g] = games;
    if (g.a === g.b) return undecided('Empate: não há regra de desempate configurada. Corrija o placar.', g.a, g.b);
    return { scoreA: g.a, scoreB: g.b, winnerId: g.a > g.b ? m.teamAId : m.teamBId, decided: true };
  }

  if (games.length > m.bestOf) return undecided(`Série melhor de ${m.bestOf} aceita no máximo ${m.bestOf} partidas.`);
  const needed = Math.ceil(m.bestOf / 2);
  let winsA = 0;
  let winsB = 0;
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    if (winsA >= needed || winsB >= needed) {
      return undecided('Há partidas registradas após a série já ter vencedor.', winsA, winsB);
    }
    if (g.a === g.b) return undecided(`Partida ${i + 1} empatada: informe um vencedor.`, winsA, winsB);
    if (g.a > g.b) winsA++;
    else winsB++;
  }
  if (winsA >= needed) return { scoreA: winsA, scoreB: winsB, winnerId: m.teamAId, decided: true };
  if (winsB >= needed) return { scoreA: winsA, scoreB: winsB, winnerId: m.teamBId, decided: true };
  return undecided('Série ainda sem vencedor.', winsA, winsB);
}

export function sanitizeGames(games: GameScore[]): GameScore[] {
  return games.map((g) => ({ a: g.a, b: g.b }));
}

/* ------------------------------------------------------------------ */
/* Validação da estrutura                                              */
/* ------------------------------------------------------------------ */

export interface StageRef {
  id: string;
  order: number;
}

type MatchDraft = Pick<
  Match,
  'id' | 'stageId' | 'teamAId' | 'teamBId' | 'sourceA' | 'sourceB' | 'isBye' | 'bestOf'
>;

/** Valida um confronto (novo ou editado) contra os demais. Retorna lista de erros em português. */
export function validateMatchDraft(draft: MatchDraft, others: Match[], stages: StageRef[]): string[] {
  const errors: string[] = [];
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const stage = stageById.get(draft.stageId);
  if (!stage) errors.push('Fase inexistente.');
  if (![1, 3, 5, 7].includes(draft.bestOf)) errors.push('Formato da série deve ser melhor de 1, 3, 5 ou 7.');

  const rest = others.filter((o) => o.id !== draft.id);

  if (draft.isBye) {
    if (!draft.teamAId && !draft.sourceA) errors.push('BYE precisa de uma equipe (ou de um confronto de origem) no slot A.');
    if (draft.teamBId || draft.sourceB) errors.push('BYE não pode ter adversário.');
  } else if (draft.teamAId && draft.teamAId === draft.teamBId) {
    errors.push('Uma equipe não pode enfrentar a si mesma.');
  }

  if (draft.sourceA && draft.sourceA === draft.sourceB) {
    errors.push('Os dois slots não podem vir do mesmo confronto.');
  }

  for (const [slot, src] of [['A', draft.sourceA], ['B', draft.sourceB]] as const) {
    if (!src) continue;
    const srcMatch = rest.find((o) => o.id === src);
    if (!srcMatch) {
      errors.push(`Confronto de origem do slot ${slot} não existe.`);
      continue;
    }
    const srcStage = stageById.get(srcMatch.stageId);
    if (stage && srcStage && srcStage.order >= stage.order) {
      errors.push(`O confronto de origem do slot ${slot} deve estar em uma fase anterior.`);
    }
    const usedElsewhere = rest.find((o) => o.sourceA === src || o.sourceB === src);
    if (usedElsewhere) {
      errors.push(`O vencedor de "${srcMatch.label}" já avança para "${usedElsewhere.label}".`);
    }
  }

  // Uma equipe só pode aparecer uma vez por fase.
  for (const id of [draft.teamAId, draft.teamBId]) {
    if (!id) continue;
    const dup = rest.find((o) => o.stageId === draft.stageId && (o.teamAId === id || o.teamBId === id));
    if (dup) errors.push(`A equipe selecionada já está no confronto "${dup.label}" desta fase.`);
  }
  return errors;
}

/* ------------------------------------------------------------------ */
/* Avanço de fase                                                      */
/* ------------------------------------------------------------------ */

export type PlanResult =
  | { ok: false; error: string; needsConfirmation?: false }
  | { ok: false; needsConfirmation: true; affected: Match[]; error: string }
  | { ok: true; updates: Record<string, MatchPatch>; affected: Match[] };

const hasProgress = (m: Match) => m.status !== 'waiting' || m.games.length > 0 || m.winnerId != null;

const RESET: MatchPatch = { scoreA: null, scoreB: null, games: [], status: 'waiting', winnerId: null };

interface Ctx {
  work: Map<string, Match>;
  patches: Record<string, MatchPatch>;
  affected: Map<string, Match>;
}

function applyPatch(ctx: Ctx, id: string, patch: MatchPatch) {
  const current = ctx.work.get(id)!;
  ctx.work.set(id, { ...current, ...patch } as Match);
  ctx.patches[id] = { ...(ctx.patches[id] ?? {}), ...patch };
}

/**
 * Remove de `child` o time que vinha de `parentId`. Se o confronto tinha progresso,
 * ele é reiniciado e a limpeza se propaga aos confrontos dependentes.
 */
function clearDependent(ctx: Ctx, parentId: string, childId: string) {
  const child = ctx.work.get(childId)!;
  const patch: MatchPatch = {};
  if (child.sourceA === parentId) patch.teamAId = null;
  if (child.sourceB === parentId) patch.teamBId = null;
  const progressed = hasProgress(child);
  if (progressed) {
    Object.assign(patch, RESET);
    ctx.affected.set(child.id, child);
  }
  applyPatch(ctx, childId, patch);
  if (progressed) {
    for (const g of [...ctx.work.values()].filter((m) => m.sourceA === childId || m.sourceB === childId)) {
      clearDependent(ctx, childId, g.id);
    }
  }
}

function newCtx(matches: Match[]): Ctx {
  return { work: new Map(matches.map((x) => [x.id, x])), patches: {}, affected: new Map() };
}

function confirmOrOk(ctx: Ctx, confirmReset: boolean | undefined, message: string): PlanResult {
  const affected = [...ctx.affected.values()];
  if (affected.length > 0 && !confirmReset) {
    return { ok: false, needsConfirmation: true, affected, error: message };
  }
  return { ok: true, updates: ctx.patches, affected };
}

/**
 * Planeja a finalização (ou correção) de um confronto: registra o vencedor e preenche o próximo
 * confronto. Se o vencedor mudou e confrontos seguintes já tinham progresso, exige `confirmReset`.
 */
export function planFinish(matches: Match[], matchId: string, opts: { confirmReset?: boolean } = {}): PlanResult {
  const m = matches.find((x) => x.id === matchId);
  if (!m) return { ok: false, error: 'Confronto não encontrado.' };
  const outcome = computeOutcome(m);
  if (!outcome.decided || !outcome.winnerId) {
    return { ok: false, error: outcome.error ?? 'Resultado inválido ou incompleto.' };
  }
  const winnerId = outcome.winnerId;
  const ctx = newCtx(matches);
  applyPatch(ctx, m.id, { scoreA: outcome.scoreA, scoreB: outcome.scoreB, status: 'finished', winnerId });

  for (const child of matches.filter((x) => x.sourceA === m.id || x.sourceB === m.id)) {
    const slotKey = child.sourceA === m.id ? 'teamAId' : 'teamBId';
    if (child[slotKey] === winnerId) continue; // vencedor não mudou: preserva o progresso seguinte

    const clash = matches.find(
      (o) => o.id !== child.id && o.stageId === child.stageId && (o.teamAId === winnerId || o.teamBId === winnerId),
    );
    if (clash) {
      return { ok: false, error: `A equipe vencedora já está em "${clash.label}" na mesma fase do próximo confronto.` };
    }
    const progressed = hasProgress(child);
    const patch: MatchPatch = { [slotKey]: winnerId };
    if (progressed) {
      Object.assign(patch, RESET);
      if (child[slotKey]) ctx.affected.set(child.id, child);
      else ctx.affected.delete(child.id);
    }
    applyPatch(ctx, child.id, patch);
    if (progressed) {
      for (const g of matches.filter((x) => x.sourceA === child.id || x.sourceB === child.id)) {
        clearDependent(ctx, child.id, g.id);
      }
    }
  }
  return confirmOrOk(ctx, opts.confirmReset, 'Alterar o vencedor reiniciará confrontos que já tinham resultado.');
}

/** Reabre um confronto finalizado: remove o vencedor e limpa o slot do próximo confronto. */
export function planReopen(matches: Match[], matchId: string, opts: { confirmReset?: boolean } = {}): PlanResult {
  const m = matches.find((x) => x.id === matchId);
  if (!m) return { ok: false, error: 'Confronto não encontrado.' };
  if (m.status !== 'finished') return { ok: false, error: 'O confronto não está finalizado.' };
  const ctx = newCtx(matches);
  applyPatch(ctx, m.id, { status: 'in_progress', winnerId: null });
  for (const child of matches.filter((x) => x.sourceA === m.id || x.sourceB === m.id)) {
    clearDependent(ctx, m.id, child.id);
  }
  return confirmOrOk(ctx, opts.confirmReset, 'Reabrir reiniciará confrontos seguintes que já tinham resultado.');
}
