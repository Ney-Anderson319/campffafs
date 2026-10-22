import { collection, doc } from 'firebase/firestore';
import { getDb } from './client';

/**
 * Estrutura do Firestore (ver README):
 *   schools/{schoolId}
 *     teams/{teamId}
 *     championship/main
 *     rounds/{roundId}/results/{teamId}
 *     stages/{stageId}
 *     matches/{matchId}
 */
export const paths = {
  schools: () => collection(getDb(), 'schools'),
  school: (schoolId: string) => doc(getDb(), 'schools', schoolId),
  teams: (schoolId: string) => collection(getDb(), 'schools', schoolId, 'teams'),
  team: (schoolId: string, teamId: string) => doc(getDb(), 'schools', schoolId, 'teams', teamId),
  championship: (schoolId: string) => doc(getDb(), 'schools', schoolId, 'championship', 'main'),
  rounds: (schoolId: string) => collection(getDb(), 'schools', schoolId, 'rounds'),
  round: (schoolId: string, roundId: string) => doc(getDb(), 'schools', schoolId, 'rounds', roundId),
  results: (schoolId: string, roundId: string) =>
    collection(getDb(), 'schools', schoolId, 'rounds', roundId, 'results'),
  result: (schoolId: string, roundId: string, teamId: string) =>
    doc(getDb(), 'schools', schoolId, 'rounds', roundId, 'results', teamId),
  stages: (schoolId: string) => collection(getDb(), 'schools', schoolId, 'stages'),
  stage: (schoolId: string, stageId: string) => doc(getDb(), 'schools', schoolId, 'stages', stageId),
  matches: (schoolId: string) => collection(getDb(), 'schools', schoolId, 'matches'),
  match: (schoolId: string, matchId: string) => doc(getDb(), 'schools', schoolId, 'matches', matchId),
};
