import { doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where, type Unsubscribe } from 'firebase/firestore';
import type { Team } from '../../types';
import { paths } from '../firebase/paths';
import { snapsToModels } from '../firebase/convert';
import { deleteRefs } from '../firebase/batch';
import { assertFirestoreDocumentSize, assertLogoDataUrl } from '../../utils/files';
import { getDb } from '../firebase/client';

export const newTeamId = (schoolId: string) => doc(paths.teams(schoolId)).id;

export function subscribeTeams(schoolId: string, onData: (t: Team[]) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(
    paths.teams(schoolId),
    (snap) => onData(snapsToModels<Team>(snap.docs).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))),
    onError,
  );
}

export interface TeamInput {
  id: string;
  schoolId: string;
  isNew: boolean;
  name: string;
  logoDataUrl?: string;
  removeLogo?: boolean;
  existing?: Team | null;
}

export async function saveTeam(input: TeamInput): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome da equipe.');
  if (name.length > 60) throw new Error('O nome da equipe deve ter no máximo 60 caracteres.');

  // Integridade: nome único dentro da escola (comparação sem acento/caixa)
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const current = snapsToModels<Team>((await getDocs(paths.teams(input.schoolId))).docs);
  if (current.some((t) => t.id !== input.id && norm(t.name) === norm(name))) {
    throw new Error('Já existe uma equipe com esse nome nesta escola.');
  }

  let logoUrl = input.existing?.logoUrl ?? null;
  let logoPath = input.existing?.logoPath ?? null;
  if (input.logoDataUrl !== undefined) {
    assertLogoDataUrl(input.logoDataUrl);
    logoUrl = input.logoDataUrl;
    logoPath = null;
  } else if (input.removeLogo) {
    logoUrl = null;
    logoPath = null;
  }
  const data = { schoolId: input.schoolId, name, logoUrl, logoPath, updatedAt: serverTimestamp() };
  const teamRef = paths.team(input.schoolId, input.id);
  await runTransaction(getDb(), async (transaction) => {
    const currentDoc = await transaction.get(teamRef);
    if (input.isNew) {
      const newData = { ...data, createdAt: serverTimestamp() };
      assertFirestoreDocumentSize(newData);
      transaction.set(teamRef, newData);
      return;
    }
    if (!currentDoc.exists()) throw new Error('Equipe não encontrada. Atualize a página e tente novamente.');
    assertFirestoreDocumentSize({ ...currentDoc.data(), ...data });
    transaction.update(teamRef, data);
  });
}

export interface TeamUsage {
  results: number;
  matches: number;
}

export async function getTeamUsage(schoolId: string, teamId: string): Promise<TeamUsage> {
  const rounds = await getDocs(paths.rounds(schoolId));
  let results = 0;
  for (const r of rounds.docs) {
    const res = await getDocs(query(paths.results(schoolId, r.id), where('teamId', '==', teamId)));
    results += res.size;
  }
  const [a, b] = await Promise.all([
    getDocs(query(paths.matches(schoolId), where('teamAId', '==', teamId))),
    getDocs(query(paths.matches(schoolId), where('teamBId', '==', teamId))),
  ]);
  return { results, matches: a.size + b.size };
}

/** Equipes com resultados ou confrontos NÃO podem ser excluídas (evita vínculos quebrados). */
export async function deleteTeam(team: Team): Promise<void> {
  const usage = await getTeamUsage(team.schoolId, team.id);
  if (usage.results > 0 || usage.matches > 0) {
    throw new Error(
      `A equipe tem ${usage.results} resultado(s) em quedas e ${usage.matches} confronto(s). Remova esses registros antes de excluir.`,
    );
  }
  await deleteRefs([paths.team(team.schoolId, team.id)]);
}
