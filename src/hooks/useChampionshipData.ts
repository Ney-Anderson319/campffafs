import { useEffect, useMemo, useState } from 'react';
import type { BracketStage, Championship, Match, Round, RoundResult, Team } from '../types';
import { subscribeChampionship } from '../services/championships/championshipService';
import { subscribeTeams } from '../services/teams/teamService';
import { subscribeRounds, subscribeResults } from '../services/rounds/roundService';
import { subscribeMatches, subscribeStages } from '../services/matches/matchService';
import { useSubscription } from './useSubscription';

/**
 * Agrega todos os listeners de uma escola. `mode: 'public'` consulta apenas quedas publicadas
 * (compatível com as regras do Firestore); `admin` enxerga tudo.
 */
export function useChampionshipData(schoolId: string | null, mode: 'public' | 'admin') {
  const publishedOnly = mode === 'public';
  const champ = useSubscription<Championship | null>(schoolId ? (e, f) => subscribeChampionship(schoolId, e, f) : null, [schoolId]);
  const teams = useSubscription<Team[]>(schoolId ? (e, f) => subscribeTeams(schoolId, e, f) : null, [schoolId]);
  const rounds = useSubscription<Round[]>(schoolId ? (e, f) => subscribeRounds(schoolId, { publishedOnly }, e, f) : null, [schoolId, publishedOnly]);
  const stages = useSubscription<BracketStage[]>(schoolId ? (e, f) => subscribeStages(schoolId, e, f) : null, [schoolId]);
  const matches = useSubscription<Match[]>(schoolId ? (e, f) => subscribeMatches(schoolId, e, f) : null, [schoolId]);

  const roundIds = useMemo(() => (rounds.data ?? []).map((r) => r.id), [rounds.data]);
  const roundKey = roundIds.join('|');
  const [resultsByRound, setResultsByRound] = useState<Record<string, RoundResult[]>>({});
  const [resultsError, setResultsError] = useState<unknown>(null);

  // Um listener por queda; todos são cancelados quando a lista de quedas muda ou o componente desmonta.
  useEffect(() => {
    if (!schoolId) return;
    setResultsByRound((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => roundIds.includes(id))));
    const unsubs = roundIds.map((id) =>
      subscribeResults(schoolId, id, (list) => setResultsByRound((p) => ({ ...p, [id]: list })), setResultsError),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, roundKey]);

  const resultsLoaded = roundIds.every((id) => resultsByRound[id] !== undefined);
  const loading = champ.loading || teams.loading || rounds.loading || stages.loading || matches.loading || !resultsLoaded;
  const error = champ.error || teams.error || rounds.error || stages.error || matches.error || resultsError;

  return {
    championship: champ.data ?? null,
    teams: teams.data ?? [],
    rounds: rounds.data ?? [],
    stages: stages.data ?? [],
    matches: matches.data ?? [],
    resultsByRound,
    loading,
    error,
  };
}
