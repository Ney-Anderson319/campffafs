import type { ScoringRules, TiebreakerKey } from '../../types';

export const TIEBREAKER_LABELS: Record<TiebreakerKey, string> = {
  totalPoints: 'Maior total de pontos',
  totalKills: 'Maior total de abates',
  firstPlaces: 'Maior número de 1º lugares',
  placementPoints: 'Mais pontos por colocação',
  bestRoundPoints: 'Melhor pontuação em uma queda',
};

export const ALL_TIEBREAKERS: TiebreakerKey[] = [
  'totalPoints',
  'totalKills',
  'firstPlaces',
  'placementPoints',
  'bestRoundPoints',
];

/** Valores iniciais sugeridos. O administrador pode alterar tudo na tela de pontuação. */
export function createDefaultRules(): ScoringRules {
  const points = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0];
  return {
    placement: {
      enabled: true,
      table: points.map((p, i) => ({ position: i + 1, points: p })),
    },
    kills: { enabled: true, pointsPerKill: 1, maxPerRound: null },
    extras: [],
    tiebreakers: [
      { key: 'totalPoints', enabled: true },
      { key: 'totalKills', enabled: true },
      { key: 'firstPlaces', enabled: true },
      { key: 'placementPoints', enabled: false },
      { key: 'bestRoundPoints', enabled: false },
    ],
    plannedRounds: 6,
    allowDuplicatePositions: false,
    closing: { condition: 'manual', targetScore: null, championRule: 'standings' },
  };
}

/** Garante que regras lidas do banco tenham todos os campos (compatibilidade com dados antigos). */
export function normalizeRules(raw: Partial<ScoringRules> | undefined | null): ScoringRules {
  const d = createDefaultRules();
  if (!raw) return d;
  const known = new Set((raw.tiebreakers ?? []).map((t) => t.key));
  const tiebreakers = [
    ...(raw.tiebreakers ?? []),
    ...ALL_TIEBREAKERS.filter((k) => !known.has(k)).map((key) => ({ key, enabled: false })),
  ];
  return {
    placement: { ...d.placement, ...(raw.placement ?? {}) },
    kills: { ...d.kills, ...(raw.kills ?? {}) },
    extras: raw.extras ?? [],
    tiebreakers,
    plannedRounds: raw.plannedRounds ?? d.plannedRounds,
    allowDuplicatePositions: raw.allowDuplicatePositions ?? false,
    closing: { ...d.closing, ...(raw.closing ?? {}) },
  };
}
