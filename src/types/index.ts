/** Modelos de domínio. Datas chegam do Firestore já convertidas para Date. */

export interface School {
  id: string;
  name: string;
  description: string;
  /** JPEG Data URL for new logos; legacy Firebase Storage URLs remain readable. */
  logoUrl: string | null;
  logoPath: string | null;
  published: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Team {
  id: string;
  schoolId: string;
  name: string;
  /** JPEG Data URL for new logos; legacy Firebase Storage URLs remain readable. */
  logoUrl: string | null;
  logoPath: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type ChampionshipFormat = 'knockout' | 'points';
export type ChampionshipStatus = 'not_started' | 'in_progress' | 'finished';

export type TiebreakerKey =
  | 'totalPoints'
  | 'totalKills'
  | 'firstPlaces'
  | 'placementPoints'
  | 'bestRoundPoints';

export interface TiebreakerRule {
  key: TiebreakerKey;
  enabled: boolean;
}

export interface PlacementEntry {
  position: number;
  points: number;
}

export interface ExtraComponent {
  id: string;
  name: string;
  enabled: boolean;
  pointsPerUnit: number;
  /** Limite por queda. null = sem limite definido (impede calcular o máximo teórico). */
  maxPerRound: number | null;
}

export type ClosingCondition = 'manual' | 'plannedRounds' | 'targetScore';
export type ChampionRule = 'standings' | 'manual';

export interface ScoringRules {
  placement: { enabled: boolean; table: PlacementEntry[] };
  kills: { enabled: boolean; pointsPerKill: number; maxPerRound: number | null };
  extras: ExtraComponent[];
  /** Ordem = prioridade. Critérios desabilitados são ignorados. */
  tiebreakers: TiebreakerRule[];
  plannedRounds: number;
  allowDuplicatePositions: boolean;
  closing: {
    condition: ClosingCondition;
    targetScore: number | null;
    championRule: ChampionRule;
  };
}

export interface Championship {
  id: string; // sempre "main" (um campeonato por escola)
  schoolId: string;
  format: ChampionshipFormat;
  status: ChampionshipStatus;
  rules: ScoringRules;
  championTeamId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type RoundStatus = 'open' | 'finished';

/** Queda (formato por pontos). */
export interface Round {
  id: string;
  schoolId: string;
  name: string;
  order: number;
  status: RoundStatus;
  /** Quedas não publicadas ficam invisíveis ao público (e fora da classificação pública). */
  published: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type ResultStatus = 'complete' | 'incomplete';

/** Resultado de uma equipe numa queda. O ID do documento é o teamId. Pontos NÃO são armazenados. */
export interface RoundResult {
  id: string;
  teamId: string;
  position: number | null;
  kills: number | null;
  extras: Record<string, number>;
  status: ResultStatus;
  updatedAt: Date | null;
}

export interface BracketStage {
  id: string;
  schoolId: string;
  name: string;
  order: number;
  createdAt: Date | null;
}

export type MatchStatus = 'waiting' | 'in_progress' | 'finished';

export interface GameScore {
  a: number;
  b: number;
}

export interface Match {
  id: string;
  schoolId: string;
  stageId: string;
  label: string;
  order: number;
  teamAId: string | null;
  teamBId: string | null;
  /** Confronto anterior cujo vencedor ocupa o slot A/B. */
  sourceA: string | null;
  sourceB: string | null;
  bestOf: number;
  games: GameScore[];
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  winnerId: string | null;
  /** Avanço direto sem adversário (BYE), declarado explicitamente. */
  isBye: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Administradores são definidos por Custom Claim (admin: true), não por documento. */
export interface AdminUser {
  uid: string;
  email: string | null;
}
