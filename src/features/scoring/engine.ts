/**
 * Motor de pontuação: funções PURAS, sem React e sem Firebase.
 *
 * Princípio: pontos nunca são armazenados. São sempre derivados de
 *   (regras do campeonato) + (posição, abates e extras de cada queda),
 * o que elimina totais desatualizados ou contados em duplicidade.
 */
import type {
  PlacementEntry,
  RoundResult,
  ScoringRules,
  Team,
  TiebreakerKey,
} from '../../types';

export interface ResultPoints {
  placement: number;
  kills: number;
  extras: Record<string, number>;
  extrasTotal: number;
  total: number;
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const isNonNegInt = (n: unknown): n is number => isInt(n) && n >= 0;

export function placementPointsFor(rules: ScoringRules, position: number | null): number {
  if (!rules.placement.enabled || position == null) return 0;
  const entry = rules.placement.table.find((e) => e.position === position);
  return entry ? entry.points : 0; // posição sem entrada na tabela vale 0
}

type ResultInput = Pick<RoundResult, 'position' | 'kills' | 'extras'>;

export function calcResultPoints(rules: ScoringRules, result: ResultInput): ResultPoints {
  const placement = placementPointsFor(rules, result.position);
  const kills =
    rules.kills.enabled && result.kills != null ? result.kills * rules.kills.pointsPerKill : 0;
  const extras: Record<string, number> = {};
  let extrasTotal = 0;
  for (const comp of rules.extras) {
    if (!comp.enabled) continue;
    const units = result.extras?.[comp.id] ?? 0;
    const pts = units * comp.pointsPerUnit;
    extras[comp.id] = pts;
    extrasTotal += pts;
  }
  return { placement, kills, extras, extrasTotal, total: placement + kills + extrasTotal };
}

/** Um resultado só conta no total quando está completo e válido. */
export function isResultComplete(rules: ScoringRules, result: ResultInput): boolean {
  if (!isInt(result.position) || result.position < 1) return false;
  if (!isNonNegInt(result.kills)) return false;
  for (const comp of rules.extras) {
    if (!comp.enabled) continue;
    if (!isNonNegInt(result.extras?.[comp.id])) return false;
  }
  return true;
}

export interface ValidationIssue {
  teamId?: string;
  field?: 'position' | 'kills' | `extra:${string}`;
  kind: 'invalid' | 'incomplete';
  message: string;
}

export interface RoundValidation {
  errors: ValidationIssue[]; // impedem salvar
  incomplete: ValidationIssue[]; // permitem salvar como rascunho, impedem finalizar
}

/**
 * Valida os resultados de uma queda. `results` contém SOMENTE as equipes participantes.
 */
export function validateRoundResults(
  rules: ScoringRules,
  results: Array<ResultInput & { teamId: string }>,
  validTeamIds: string[],
): RoundValidation {
  const errors: ValidationIssue[] = [];
  const incomplete: ValidationIssue[] = [];
  const valid = new Set(validTeamIds);
  const seenTeams = new Set<string>();
  const n = results.length;

  for (const r of results) {
    if (!valid.has(r.teamId)) {
      errors.push({ teamId: r.teamId, kind: 'invalid', message: 'Equipe não pertence a esta escola.' });
      continue;
    }
    if (seenTeams.has(r.teamId)) {
      errors.push({ teamId: r.teamId, kind: 'invalid', message: 'Equipe repetida na mesma queda.' });
      continue;
    }
    seenTeams.add(r.teamId);

    if (r.position == null) {
      incomplete.push({ teamId: r.teamId, field: 'position', kind: 'incomplete', message: 'Informe a posição final.' });
    } else if (!isInt(r.position) || r.position < 1 || r.position > n) {
      errors.push({
        teamId: r.teamId,
        field: 'position',
        kind: 'invalid',
        message: `Posição deve ser um número inteiro de 1 a ${n}.`,
      });
    }

    if (r.kills == null) {
      incomplete.push({ teamId: r.teamId, field: 'kills', kind: 'incomplete', message: 'Informe os abates.' });
    } else if (!isNonNegInt(r.kills)) {
      errors.push({ teamId: r.teamId, field: 'kills', kind: 'invalid', message: 'Abates deve ser inteiro e não negativo.' });
    } else if (rules.kills.maxPerRound != null && r.kills > rules.kills.maxPerRound) {
      errors.push({
        teamId: r.teamId,
        field: 'kills',
        kind: 'invalid',
        message: `Abates acima do limite configurado (${rules.kills.maxPerRound}).`,
      });
    }

    for (const comp of rules.extras) {
      if (!comp.enabled) continue;
      const v = r.extras?.[comp.id];
      const field = `extra:${comp.id}` as const;
      if (v == null) {
        incomplete.push({ teamId: r.teamId, field, kind: 'incomplete', message: `Informe "${comp.name}".` });
      } else if (!isNonNegInt(v)) {
        errors.push({ teamId: r.teamId, field, kind: 'invalid', message: `"${comp.name}" deve ser inteiro e não negativo.` });
      } else if (comp.maxPerRound != null && v > comp.maxPerRound) {
        errors.push({ teamId: r.teamId, field, kind: 'invalid', message: `"${comp.name}" acima do limite (${comp.maxPerRound}).` });
      }
    }
  }

  if (!rules.allowDuplicatePositions) {
    const byPos = new Map<number, string[]>();
    for (const r of results) {
      if (isInt(r.position) && valid.has(r.teamId)) {
        byPos.set(r.position, [...(byPos.get(r.position) ?? []), r.teamId]);
      }
    }
    for (const [pos, teams] of byPos) {
      if (teams.length > 1) {
        for (const teamId of teams) {
          errors.push({ teamId, field: 'position', kind: 'invalid', message: `Posição ${pos} está duplicada.` });
        }
      }
    }
  }
  return { errors, incomplete };
}

/* ------------------------------------------------------------------ */
/* Classificação                                                       */
/* ------------------------------------------------------------------ */

export interface StandingRow {
  teamId: string;
  teamName: string;
  rank: number;
  tied: boolean;
  placementPoints: number;
  killPoints: number;
  extraPoints: Record<string, number>;
  totalPoints: number;
  totalKills: number;
  firstPlaces: number;
  roundsPlayed: number;
  bestRoundPoints: number;
}

export interface StandingsInput {
  rules: ScoringRules;
  teams: Pick<Team, 'id' | 'name'>[];
  /** Apenas as quedas que devem contar (ex.: as publicadas). */
  resultsByRound: Record<string, RoundResult[]>;
}

function criterionValue(row: StandingRow, key: TiebreakerKey): number {
  switch (key) {
    case 'totalPoints':
      return row.totalPoints;
    case 'totalKills':
      return row.totalKills;
    case 'firstPlaces':
      return row.firstPlaces;
    case 'placementPoints':
      return row.placementPoints;
    case 'bestRoundPoints':
      return row.bestRoundPoints;
  }
}

export function computeStandings({ rules, teams, resultsByRound }: StandingsInput): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      rank: 0,
      tied: false,
      placementPoints: 0,
      killPoints: 0,
      extraPoints: Object.fromEntries(rules.extras.filter((e) => e.enabled).map((e) => [e.id, 0])),
      totalPoints: 0,
      totalKills: 0,
      firstPlaces: 0,
      roundsPlayed: 0,
      bestRoundPoints: 0,
    });
  }

  for (const results of Object.values(resultsByRound)) {
    const seen = new Set<string>(); // evita contar a mesma equipe duas vezes na mesma queda
    for (const r of results) {
      const row = rows.get(r.teamId);
      if (!row || seen.has(r.teamId)) continue;
      if (r.status !== 'complete' || !isResultComplete(rules, r)) continue;
      seen.add(r.teamId);
      const p = calcResultPoints(rules, r);
      row.placementPoints += p.placement;
      row.killPoints += p.kills;
      for (const [id, v] of Object.entries(p.extras)) row.extraPoints[id] = (row.extraPoints[id] ?? 0) + v;
      row.totalPoints += p.total;
      row.totalKills += r.kills ?? 0;
      if (r.position === 1) row.firstPlaces += 1;
      row.roundsPlayed += 1;
      row.bestRoundPoints = Math.max(row.bestRoundPoints, p.total);
    }
  }

  const criteria = rules.tiebreakers.filter((t) => t.enabled).map((t) => t.key);
  const cmp = (a: StandingRow, b: StandingRow): number => {
    for (const key of criteria) {
      const d = criterionValue(b, key) - criterionValue(a, key);
      if (d !== 0) return d;
    }
    return 0;
  };

  // A ordem alfabética só decide a exibição; NÃO desfaz empates.
  const sorted = [...rows.values()].sort((a, b) => cmp(a, b) || a.teamName.localeCompare(b.teamName, 'pt-BR'));
  sorted.forEach((row, i) => {
    row.rank = i > 0 && cmp(sorted[i - 1], row) === 0 ? sorted[i - 1].rank : i + 1;
  });
  for (const row of sorted) row.tied = sorted.filter((o) => o.rank === row.rank).length > 1;
  return sorted;
}

/* ------------------------------------------------------------------ */
/* Máximo teórico, encerramento e campeão                              */
/* ------------------------------------------------------------------ */

export type TheoreticalMax = { value: number; reason?: undefined } | { value: null; reason: string };

export function computeTheoreticalMax(rules: ScoringRules): TheoreticalMax {
  if (!(rules.plannedRounds > 0)) {
    return { value: null, reason: 'Defina a quantidade de quedas planejadas.' };
  }
  let perRound = 0;
  if (rules.placement.enabled) {
    perRound += rules.placement.table.reduce((m, e) => Math.max(m, e.points), 0);
  }
  if (rules.kills.enabled) {
    if (rules.kills.maxPerRound == null) {
      return { value: null, reason: 'O limite de abates por queda não foi definido.' };
    }
    perRound += rules.kills.maxPerRound * rules.kills.pointsPerKill;
  }
  for (const c of rules.extras) {
    if (!c.enabled) continue;
    if (c.maxPerRound == null) {
      return { value: null, reason: `O componente "${c.name}" não tem limite por queda.` };
    }
    perRound += c.maxPerRound * c.pointsPerUnit;
  }
  return { value: perRound * rules.plannedRounds };
}

export interface ClosingStatus {
  met: boolean;
  message: string;
}

/** Indica se a condição de encerramento foi atingida. NÃO define campeão nem encerra sozinho. */
export function getClosingStatus(
  rules: ScoringRules,
  finishedRounds: number,
  standings: StandingRow[],
): ClosingStatus {
  switch (rules.closing.condition) {
    case 'manual':
      return { met: false, message: 'Encerramento manual pelo administrador.' };
    case 'plannedRounds':
      return finishedRounds >= rules.plannedRounds
        ? { met: true, message: 'Todas as quedas planejadas foram finalizadas.' }
        : { met: false, message: `${finishedRounds} de ${rules.plannedRounds} quedas finalizadas.` };
    case 'targetScore': {
      const target = rules.closing.targetScore;
      if (target == null) return { met: false, message: 'Pontuação-alvo não definida.' };
      const reached = standings.some((s) => s.totalPoints >= target);
      return reached
        ? { met: true, message: `Pontuação-alvo (${target}) atingida.` }
        : { met: false, message: `Ninguém atingiu a pontuação-alvo (${target}).` };
    }
  }
}

export interface ChampionResult {
  teamIds: string[];
  tie: boolean;
}

/** Só há campeão com campeonato finalizado. Empate no 1º lugar é preservado (tie = true). */
export function getChampion(
  rules: ScoringRules,
  status: 'not_started' | 'in_progress' | 'finished',
  standings: StandingRow[],
  manualChampionId: string | null,
): ChampionResult | null {
  if (status !== 'finished') return null;
  if (rules.closing.championRule === 'manual') {
    return manualChampionId ? { teamIds: [manualChampionId], tie: false } : null;
  }
  const played = standings.filter((s) => s.roundsPlayed > 0);
  if (played.length === 0) return null;
  const top = played.filter((s) => s.rank === 1);
  return { teamIds: top.map((t) => t.teamId), tie: top.length > 1 };
}

/* ------------------------------------------------------------------ */
/* Validação das regras                                                */
/* ------------------------------------------------------------------ */

export function validateRules(rules: ScoringRules): string[] {
  const errs: string[] = [];
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);

  if (rules.placement.enabled) {
    if (rules.placement.table.length === 0) errs.push('A tabela de pontos por colocação está vazia.');
    const seen = new Set<number>();
    for (const e of rules.placement.table as PlacementEntry[]) {
      if (!isInt(e.position) || e.position < 1) errs.push('Toda posição deve ser um inteiro maior que zero.');
      else if (seen.has(e.position)) errs.push(`A posição ${e.position} aparece mais de uma vez.`);
      seen.add(e.position);
      if (!finite(e.points) || e.points < 0) errs.push(`Pontos da posição ${e.position} devem ser um número maior ou igual a zero.`);
    }
  }
  if (rules.kills.enabled) {
    if (!finite(rules.kills.pointsPerKill) || rules.kills.pointsPerKill < 0) errs.push('Pontos por abate deve ser maior ou igual a zero.');
    if (rules.kills.maxPerRound != null && !isNonNegInt(rules.kills.maxPerRound)) errs.push('Limite de abates por queda deve ser um inteiro não negativo.');
  }
  const ids = new Set<string>();
  for (const c of rules.extras) {
    if (!c.name.trim()) errs.push('Todo componente adicional precisa de um nome.');
    if (ids.has(c.id)) errs.push('Componentes adicionais com identificador repetido.');
    ids.add(c.id);
    if (!finite(c.pointsPerUnit)) errs.push(`Pontos por unidade de "${c.name}" é inválido.`);
    if (c.maxPerRound != null && !isNonNegInt(c.maxPerRound)) errs.push(`Limite de "${c.name}" deve ser inteiro não negativo.`);
  }
  if (!isInt(rules.plannedRounds) || rules.plannedRounds < 1) errs.push('Quantidade de quedas planejadas deve ser um inteiro maior que zero.');
  if (!rules.tiebreakers.some((t) => t.enabled)) errs.push('Habilite pelo menos um critério de classificação.');
  if (rules.closing.condition === 'targetScore' && !(finite(rules.closing.targetScore) && (rules.closing.targetScore as number) > 0)) {
    errs.push('Defina uma pontuação-alvo maior que zero para esta condição de encerramento.');
  }
  if (!rules.placement.enabled && !rules.kills.enabled && !rules.extras.some((e) => e.enabled)) {
    errs.push('Habilite pelo menos um componente de pontuação.');
  }
  return errs;
}
