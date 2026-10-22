import { Timestamp, type DocumentSnapshot } from 'firebase/firestore';

/** Converte um snapshot em modelo tipado (Timestamp -> Date). Retorna null se o doc não existe. */
export function snapToModel<T>(snap: DocumentSnapshot): (T & { id: string }) | null {
  if (!snap.exists()) return null;
  const raw = snap.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = v instanceof Timestamp ? v.toDate() : v;
  return { ...out, id: snap.id } as T & { id: string };
}

export function snapsToModels<T>(snaps: DocumentSnapshot[]): Array<T & { id: string }> {
  return snaps.map((s) => snapToModel<T>(s)).filter((x): x is T & { id: string } => x !== null);
}
