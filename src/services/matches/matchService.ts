import { doc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import type { BracketStage, GameScore, Match } from '../../types';
import { paths } from '../firebase/paths';
import { snapsToModels } from '../firebase/convert';
import { deleteRefs } from '../firebase/batch';
import { getDb } from '../firebase/client';
import { computeOutcome, planFinish, planReopen, validateMatchDraft, type MatchPatch, type PlanResult } from '../../features/matches/bracket';

export function subscribeStages(schoolId: string, onData: (s: BracketStage[]) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(paths.stages(schoolId), (snap) => onData(snapsToModels<BracketStage>(snap.docs).sort((a, b) => a.order - b.order)), onError);
}

export function subscribeMatches(schoolId: string, onData: (m: Match[]) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(
    paths.matches(schoolId),
    (snap) => onData(snapsToModels<Match>(snap.docs).map((m) => ({ ...m, games: m.games ?? [] })).sort((a, b) => a.order - b.order)),
    onError,
  );
}

async function fetchMatches(schoolId: string): Promise<Match[]> {
  return snapsToModels<Match>((await getDocs(paths.matches(schoolId))).docs).map((m) => ({ ...m, games: m.games ?? [] }));
}
async function fetchStages(schoolId: string): Promise<BracketStage[]> {
  return snapsToModels<BracketStage>((await getDocs(paths.stages(schoolId))).docs).sort((a, b) => a.order - b.order);
}

/* ---------------------------- Fases ---------------------------- */

export async function createStage(schoolId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error('Informe o nome da fase.');
  const stages = await fetchStages(schoolId);
  const id = doc(paths.stages(schoolId)).id;
  await setDoc(paths.stage(schoolId, id), {
    schoolId,
    name: clean,
    order: stages.reduce((m, s) => Math.max(m, s.order), 0) + 1,
    createdAt: serverTimestamp(),
  });
}

export async function renameStage(schoolId: string, stageId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error('Informe o nome da fase.');
  await updateDoc(paths.stage(schoolId, stageId), { name: clean });
}

export async function swapStages(schoolId: string, a: BracketStage, b: BracketStage): Promise<void> {
  const matches = await fetchMatches(schoolId);
  const byId = new Map((await fetchStages(schoolId)).map((s) => [s.id, s]));
  // A nova ordem não pode quebrar "origem em fase anterior".
  const order = (s: BracketStage) => (s.id === a.id ? b.order : s.id === b.id ? a.order : s.order);
  for (const m of matches) {
    for (const src of [m.sourceA, m.sourceB]) {
      if (!src) continue;
      const srcMatch = matches.find((x) => x.id === src);
      const s1 = srcMatch && byId.get(srcMatch.stageId);
      const s2 = byId.get(m.stageId);
      if (s1 && s2 && order(s1) >= order(s2)) {
        throw new Error('Essa ordem deixaria um confronto dependendo de uma fase posterior. Ajuste os confrontos antes.');
      }
    }
  }
  const batch = writeBatch(getDb());
  batch.update(paths.stage(schoolId, a.id), { order: b.order });
  batch.update(paths.stage(schoolId, b.id), { order: a.order });
  await batch.commit();
}

export async function deleteStage(schoolId: string, stageId: string): Promise<void> {
  const matches = await fetchMatches(schoolId);
  if (matches.some((m) => m.stageId === stageId)) {
    throw new Error('Esta fase possui confrontos. Exclua os confrontos antes de excluir a fase.');
  }
  await deleteRefs([paths.stage(schoolId, stageId)]);
}

/* ------------------------- Confrontos -------------------------- */

export interface MatchDraftInput {
  id: string;
  isNew: boolean;
  stageId: string;
  label: string;
  teamAId: string | null;
  teamBId: string | null;
  sourceA: string | null;
  sourceB: string | null;
  bestOf: number;
  isBye: boolean;
  games: GameScore[];
  status: 'waiting' | 'in_progress';
}

/** Cria/edita um confronto (que NÃO esteja finalizado). Finalização é uma ação separada. */
export async function saveMatch(schoolId: string, input: MatchDraftInput, validTeamIds: string[]): Promise<void> {
  const label = input.label.trim();
  if (!label) throw new Error('Informe a identificação do confronto.');
  const [matches, stages] = await Promise.all([fetchMatches(schoolId), fetchStages(schoolId)]);
  const existing = matches.find((m) => m.id === input.id);
  if (existing?.status === 'finished') throw new Error('Confronto finalizado: use "Corrigir resultado".');

  for (const t of [input.teamAId, input.teamBId]) {
    if (t && !validTeamIds.includes(t)) throw new Error('Equipe não pertence a esta escola.');
  }
  // Slot com origem é preenchido pelo vencedor do confronto anterior (se já finalizado).
  const srcA = input.sourceA ? matches.find((m) => m.id === input.sourceA) : null;
  const srcB = input.sourceB ? matches.find((m) => m.id === input.sourceB) : null;
  const teamAId = input.sourceA ? (srcA?.status === 'finished' ? srcA.winnerId : null) : input.teamAId;
  const teamBId = input.isBye ? null : input.sourceB ? (srcB?.status === 'finished' ? srcB.winnerId : null) : input.teamBId;

  const draft = { ...input, teamAId, teamBId, id: input.id };
  const errors = validateMatchDraft(draft, matches, stages);
  if (errors.length) throw new Error(errors[0]);

  const order = existing?.order ?? matches.filter((m) => m.stageId === input.stageId).reduce((mx, m) => Math.max(mx, m.order), 0) + 1;
  const outcome = computeOutcome({ teamAId, teamBId, isBye: input.isBye, bestOf: input.bestOf, games: input.games });
  const data = {
    schoolId,
    stageId: input.stageId,
    label,
    order,
    teamAId,
    teamBId,
    sourceA: input.sourceA,
    sourceB: input.sourceB,
    bestOf: input.bestOf,
    isBye: input.isBye,
    games: input.games,
    scoreA: outcome.scoreA,
    scoreB: outcome.scoreB,
    status: input.games.length > 0 ? 'in_progress' : input.status,
    winnerId: null,
    updatedAt: serverTimestamp(),
  };
  if (input.isNew) await setDoc(paths.match(schoolId, input.id), { ...data, createdAt: serverTimestamp() });
  else await updateDoc(paths.match(schoolId, input.id), data);
}

/** Finaliza/corrige e avança em uma transação baseada no estado atual do servidor. */
export async function finishMatch(schoolId: string, matchId: string, games: GameScore[], confirmReset = false): Promise<PlanResult> {
  const refs = (await getDocs(paths.matches(schoolId))).docs.map((snapshot) => snapshot.ref);
  return runTransaction(getDb(), async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const matches = snapsToModels<Match>(snapshots).map((m) => ({ ...m, games: m.games ?? [] }));
    if (!matches.some((m) => m.id === matchId)) return { ok: false, error: 'Confronto não encontrado.' };
    const updated = matches.map((m) => (m.id === matchId ? { ...m, games } : m));
    const plan = planFinish(updated, matchId, { confirmReset });
    if (!plan.ok) return plan;
    plan.updates[matchId] = { ...plan.updates[matchId], games };
    for (const [id, patch] of Object.entries(plan.updates as Record<string, MatchPatch>)) {
      transaction.update(paths.match(schoolId, id), { ...patch, updatedAt: serverTimestamp() });
    }
    return plan;
  });
}

export async function reopenMatch(schoolId: string, matchId: string, confirmReset = false): Promise<PlanResult> {
  const refs = (await getDocs(paths.matches(schoolId))).docs.map((snapshot) => snapshot.ref);
  return runTransaction(getDb(), async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const matches = snapsToModels<Match>(snapshots).map((m) => ({ ...m, games: m.games ?? [] }));
    const plan = planReopen(matches, matchId, { confirmReset });
    if (!plan.ok) return plan;
    for (const [id, patch] of Object.entries(plan.updates as Record<string, MatchPatch>)) {
      transaction.update(paths.match(schoolId, id), { ...patch, updatedAt: serverTimestamp() });
    }
    return plan;
  });
}

export async function deleteMatch(schoolId: string, matchId: string): Promise<void> {
  const matches = await fetchMatches(schoolId);
  const dep = matches.find((m) => m.sourceA === matchId || m.sourceB === matchId);
  if (dep) throw new Error(`O vencedor deste confronto avança para "${dep.label}". Remova essa dependência primeiro.`);
  await deleteRefs([paths.match(schoolId, matchId)]);
}

export const newMatchId = (schoolId: string) => doc(paths.matches(schoolId)).id;
