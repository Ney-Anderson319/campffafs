import { getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe, type UpdateData } from 'firebase/firestore';
import type { Championship, ChampionshipFormat, ChampionshipStatus, ScoringRules } from '../../types';
import { paths } from '../firebase/paths';
import { snapToModel } from '../firebase/convert';
import { deleteRefs } from '../firebase/batch';
import { createDefaultRules, normalizeRules } from '../../features/scoring/defaults';
import { validateRules } from '../../features/scoring/engine';

export function subscribeChampionship(schoolId: string, onData: (c: Championship | null) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(
    paths.championship(schoolId),
    (snap) => {
      const c = snapToModel<Championship>(snap);
      onData(c ? { ...c, rules: normalizeRules(c.rules) } : null);
    },
    onError,
  );
}

export async function createChampionship(schoolId: string, format: ChampionshipFormat): Promise<void> {
  await setDoc(paths.championship(schoolId), {
    schoolId,
    format,
    status: 'not_started',
    rules: createDefaultRules(),
    championTeamId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function setChampionshipStatus(schoolId: string, status: ChampionshipStatus, championTeamId?: string | null): Promise<void> {
  const patch: UpdateData<Championship> = { status, updatedAt: serverTimestamp() };
  if (championTeamId !== undefined) patch.championTeamId = championTeamId;
  await updateDoc(paths.championship(schoolId), patch);
}

export async function saveRules(schoolId: string, rules: ScoringRules): Promise<void> {
  const errors = validateRules(rules);
  if (errors.length) throw new Error(errors.join(' '));
  await updateDoc(paths.championship(schoolId), { rules, updatedAt: serverTimestamp() });
}

export interface ChampionshipData {
  rounds: number;
  results: number;
  stages: number;
  matches: number;
}

export async function getChampionshipData(schoolId: string): Promise<ChampionshipData> {
  const [rounds, stages, matches] = await Promise.all([
    getDocs(paths.rounds(schoolId)),
    getDocs(paths.stages(schoolId)),
    getDocs(paths.matches(schoolId)),
  ]);
  let results = 0;
  for (const r of rounds.docs) results += (await getDocs(paths.results(schoolId, r.id))).size;
  return { rounds: rounds.size, results, stages: stages.size, matches: matches.size };
}

/**
 * Troca o formato. Se houver dados, só prossegue com `wipe: true` (confirmado pelo administrador),
 * pois resultados de um formato não fazem sentido no outro.
 */
export async function changeFormat(schoolId: string, format: ChampionshipFormat, wipe: boolean): Promise<void> {
  const data = await getChampionshipData(schoolId);
  const hasData = data.rounds + data.stages + data.matches > 0;
  if (hasData && !wipe) throw new Error('Existem resultados cadastrados. Confirme a exclusão para trocar o formato.');
  if (hasData) {
    const refs = [];
    for (const r of (await getDocs(paths.rounds(schoolId))).docs) {
      refs.push(...(await getDocs(paths.results(schoolId, r.id))).docs.map((d) => d.ref));
    }
    await deleteRefs(refs);
    await deleteRefs([
      ...(await getDocs(paths.rounds(schoolId))).docs.map((d) => d.ref),
      ...(await getDocs(paths.stages(schoolId))).docs.map((d) => d.ref),
      ...(await getDocs(paths.matches(schoolId))).docs.map((d) => d.ref),
    ]);
  }
  await updateDoc(paths.championship(schoolId), {
    format,
    status: 'not_started',
    championTeamId: null,
    updatedAt: serverTimestamp(),
  });
}
