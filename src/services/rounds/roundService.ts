import { doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore';
import type { Round, RoundResult, ScoringRules, Team } from '../../types';
import { paths } from '../firebase/paths';
import { snapsToModels } from '../firebase/convert';
import { deleteRefs } from '../firebase/batch';
import { getDb } from '../firebase/client';
import { isResultComplete, validateRoundResults } from '../../features/scoring/engine';

export function subscribeRounds(schoolId: string, opts: { publishedOnly: boolean }, onData: (r: Round[]) => void, onError: (e: unknown) => void): Unsubscribe {
  const q = opts.publishedOnly ? query(paths.rounds(schoolId), where('published', '==', true)) : paths.rounds(schoolId);
  return onSnapshot(q, (snap) => onData(snapsToModels<Round>(snap.docs).sort((a, b) => a.order - b.order)), onError);
}

export function subscribeResults(schoolId: string, roundId: string, onData: (r: RoundResult[]) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(paths.results(schoolId, roundId), (snap) => onData(snapsToModels<RoundResult>(snap.docs)), onError);
}

export async function createRound(schoolId: string, name: string, rounds: Round[]): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error('Informe o nome da queda.');
  const id = doc(paths.rounds(schoolId)).id;
  const order = rounds.reduce((m, r) => Math.max(m, r.order), 0) + 1;
  await setDoc(paths.round(schoolId, id), {
    schoolId,
    name: clean,
    order,
    status: 'open',
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function renameRound(schoolId: string, roundId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error('Informe o nome da queda.');
  await updateDoc(paths.round(schoolId, roundId), { name: clean, updatedAt: serverTimestamp() });
}

/** Troca a ordem de duas quedas de forma atômica. */
export async function swapRounds(schoolId: string, a: Round, b: Round): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(paths.round(schoolId, a.id), { order: b.order, updatedAt: serverTimestamp() });
  batch.update(paths.round(schoolId, b.id), { order: a.order, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function setRoundPublished(schoolId: string, roundId: string, published: boolean): Promise<void> {
  await updateDoc(paths.round(schoolId, roundId), { published, updatedAt: serverTimestamp() });
}

export async function reopenRound(schoolId: string, roundId: string): Promise<void> {
  await updateDoc(paths.round(schoolId, roundId), { status: 'open', updatedAt: serverTimestamp() });
}

/** Finaliza a queda revalidando os dados mais recentes do servidor (não confia no estado da tela). */
export async function finishRound(schoolId: string, roundId: string, rules: ScoringRules, teams: Team[]): Promise<void> {
  const results = snapsToModels<RoundResult>((await getDocs(paths.results(schoolId, roundId))).docs);
  if (results.length === 0) throw new Error('Nenhuma equipe participa desta queda.');
  const v = validateRoundResults(rules, results, teams.map((t) => t.id));
  if (v.errors.length) throw new Error(v.errors[0].message);
  if (v.incomplete.length || results.some((r) => !isResultComplete(rules, r))) {
    throw new Error('Há resultados incompletos. Preencha todas as equipes antes de finalizar.');
  }
  await updateDoc(paths.round(schoolId, roundId), { status: 'finished', updatedAt: serverTimestamp() });
}

export async function deleteRound(schoolId: string, roundId: string): Promise<void> {
  const res = await getDocs(paths.results(schoolId, roundId));
  await deleteRefs(res.docs.map((d) => d.ref));
  await deleteRefs([paths.round(schoolId, roundId)]);
}

export interface ResultDraft {
  teamId: string;
  position: number | null;
  kills: number | null;
  extras: Record<string, number>;
}

/**
 * Salva todos os resultados de uma queda em um único lote atômico.
 * Equipes em `removedTeamIds` (não participantes) têm o resultado removido.
 */
export async function saveRoundResults(
  schoolId: string,
  roundId: string,
  rules: ScoringRules,
  teams: Team[],
  drafts: ResultDraft[],
  removedTeamIds: string[],
): Promise<{ incomplete: number }> {
  const v = validateRoundResults(rules, drafts, teams.map((t) => t.id));
  if (v.errors.length) throw new Error(v.errors[0].message);
  const batch = writeBatch(getDb());
  let incomplete = 0;
  for (const d of drafts) {
    const complete = isResultComplete(rules, d);
    if (!complete) incomplete++;
    batch.set(paths.result(schoolId, roundId, d.teamId), {
      teamId: d.teamId,
      position: d.position,
      kills: d.kills,
      extras: d.extras,
      status: complete ? 'complete' : 'incomplete',
      updatedAt: serverTimestamp(),
    });
  }
  for (const id of removedTeamIds) batch.delete(paths.result(schoolId, roundId, id));
  batch.update(paths.round(schoolId, roundId), { updatedAt: serverTimestamp() });
  await batch.commit();
  return { incomplete };
}
