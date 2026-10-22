import { writeBatch, type DocumentReference } from 'firebase/firestore';
import { getDb } from './client';

const CHUNK = 400; // limite do Firestore é 500 operações por lote

export async function deleteRefs(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(getDb());
    refs.slice(i, i + CHUNK).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}
