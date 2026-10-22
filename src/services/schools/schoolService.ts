import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { School } from '../../types';
import { paths } from '../firebase/paths';
import { snapToModel, snapsToModels } from '../firebase/convert';
import { deleteRefs } from '../firebase/batch';
import { assertFirestoreDocumentSize, assertLogoDataUrl } from '../../utils/files';
import { getDb } from '../firebase/client';

export const newSchoolId = () => doc(paths.schools()).id;

export function subscribeSchools(
  opts: { publishedOnly: boolean },
  onData: (s: School[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe {
  const q = opts.publishedOnly ? query(paths.schools(), where('published', '==', true)) : paths.schools();
  return onSnapshot(
    q,
    (snap) => {
      const list = snapsToModels<School>(snap.docs).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      onData(list);
    },
    onError,
  );
}

export function subscribeSchool(id: string, onData: (s: School | null) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(paths.school(id), (snap) => onData(snapToModel<School>(snap)), onError);
}

export interface SchoolInput {
  id: string;
  isNew: boolean;
  name: string;
  description: string;
  published: boolean;
  logoDataUrl?: string;
  removeLogo?: boolean;
  existing?: School | null;
}

/** Salva a escola. Só retorna após a confirmação do Firestore. */
export async function saveSchool(input: SchoolInput): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome da escola.');
  if (name.length > 100) throw new Error('O nome deve ter no máximo 100 caracteres.');

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

  const data = {
    name,
    description: input.description.trim().slice(0, 500),
    published: input.published,
    logoUrl,
    logoPath,
    updatedAt: serverTimestamp(),
  };
  const schoolRef = paths.school(input.id);
  await runTransaction(getDb(), async (transaction) => {
    const currentDoc = await transaction.get(schoolRef);
    if (input.isNew) {
      const newData = { ...data, createdAt: serverTimestamp() };
      assertFirestoreDocumentSize(newData);
      transaction.set(schoolRef, newData);
      return;
    }
    if (!currentDoc.exists()) throw new Error('Escola não encontrada. Atualize a página e tente novamente.');
    assertFirestoreDocumentSize({ ...currentDoc.data(), ...data });
    transaction.update(schoolRef, data);
  });
}

export async function setSchoolPublished(id: string, published: boolean): Promise<void> {
  await updateDoc(paths.school(id), { published, updatedAt: serverTimestamp() });
}

export interface SchoolImpact {
  teams: number;
  rounds: number;
  stages: number;
  matches: number;
  hasChampionship: boolean;
}

export async function getSchoolImpact(id: string): Promise<SchoolImpact> {
  const [teams, rounds, stages, matches, champ] = await Promise.all([
    getDocs(paths.teams(id)),
    getDocs(paths.rounds(id)),
    getDocs(paths.stages(id)),
    getDocs(paths.matches(id)),
    getDocs(query(collectionOf(id, 'championship'))),
  ]);
  return {
    teams: teams.size,
    rounds: rounds.size,
    stages: stages.size,
    matches: matches.size,
    hasChampionship: !champ.empty,
  };
}

function collectionOf(schoolId: string, name: string) {
  return collection(getDb(), 'schools', schoolId, name);
}

/**
 * Estratégia de exclusão: CASCATA. Remove equipes, campeonato, quedas (e resultados), fases e confrontos.
 * Arquivos antigos do Storage não são removidos. O documento da escola é apagado por último: se algo falhar no meio, a escola
 * continua existindo e a exclusão pode ser repetida, sem referências quebradas para dados órfãos.
 */
export async function deleteSchoolCascade(id: string): Promise<void> {
  const [teams, rounds, stages, matches, champ] = await Promise.all([
    getDocs(paths.teams(id)),
    getDocs(paths.rounds(id)),
    getDocs(paths.stages(id)),
    getDocs(paths.matches(id)),
    getDocs(collectionOf(id, 'championship')),
  ]);
  const resultRefs = [];
  for (const r of rounds.docs) {
    const res = await getDocs(paths.results(id, r.id));
    resultRefs.push(...res.docs.map((d) => d.ref));
  }
  await deleteRefs(resultRefs);
  await deleteRefs([
    ...rounds.docs.map((d) => d.ref),
    ...stages.docs.map((d) => d.ref),
    ...matches.docs.map((d) => d.ref),
    ...champ.docs.map((d) => d.ref),
    ...teams.docs.map((d) => d.ref),
  ]);
  await deleteRefs([paths.school(id)]);
}
