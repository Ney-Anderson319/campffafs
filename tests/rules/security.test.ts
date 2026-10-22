/**
 * Testes das regras do Firestore contra o emulador do Firebase.
 * Execute com:  npm run test:rules   (requer firebase-tools e Java instalados)
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-campeonato',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'schools/pub'), { name: 'Pública', published: true });
    await setDoc(doc(db, 'schools/priv'), { name: 'Oculta', published: false });
    await setDoc(doc(db, 'schools/pub/teams/t1'), { name: 'Time', schoolId: 'pub' });
    await setDoc(doc(db, 'schools/priv/teams/t1'), { name: 'Time', schoolId: 'priv' });
    await setDoc(doc(db, 'schools/pub/rounds/r1'), { name: 'Queda 1', published: true, status: 'open' });
    await setDoc(doc(db, 'schools/pub/rounds/r2'), { name: 'Queda 2', published: false, status: 'open' });
    await setDoc(doc(db, 'schools/pub/rounds/r1/results/t1'), { teamId: 't1', position: 1, kills: 2, extras: {}, status: 'complete' });
    await setDoc(doc(db, 'schools/pub/rounds/r2/results/t1'), { teamId: 't1', position: 1, kills: 2, extras: {}, status: 'complete' });
  });
});

const visitor = () => env.unauthenticatedContext();
const user = () => env.authenticatedContext('u1'); // logado, mas sem claim
const admin = () => env.authenticatedContext('adm', { admin: true });

describe('Firestore: leitura pública', () => {
  it('visitante lê escola publicada e lista apenas as publicadas', async () => {
    const db = visitor().firestore();
    await assertSucceeds(getDoc(doc(db, 'schools/pub')));
    await assertSucceeds(getDocs(query(collection(db, 'schools'), where('published', '==', true))));
  });
  it('visitante NÃO lê escola oculta nem listar sem filtro', async () => {
    const db = visitor().firestore();
    await assertFails(getDoc(doc(db, 'schools/priv')));
    await assertFails(getDocs(collection(db, 'schools')));
  });
  it('dados de escola oculta são inacessíveis', async () => {
    const db = visitor().firestore();
    await assertFails(getDocs(collection(db, 'schools/priv/teams')));
  });
  it('visitante lê equipes de escola publicada', async () => {
    await assertSucceeds(getDocs(collection(visitor().firestore(), 'schools/pub/teams')));
  });
  it('quedas ocultas e seus resultados não são públicos', async () => {
    const db = visitor().firestore();
    await assertSucceeds(getDocs(query(collection(db, 'schools/pub/rounds'), where('published', '==', true))));
    await assertFails(getDoc(doc(db, 'schools/pub/rounds/r2')));
    await assertSucceeds(getDocs(collection(db, 'schools/pub/rounds/r1/results')));
    await assertFails(getDocs(collection(db, 'schools/pub/rounds/r2/results')));
  });
  it('administrador lê tudo', async () => {
    const db = admin().firestore();
    await assertSucceeds(getDoc(doc(db, 'schools/priv')));
    await assertSucceeds(getDoc(doc(db, 'schools/pub/rounds/r2')));
  });
});

describe('Firestore: escrita', () => {
  it('visitante não escreve em nenhuma coleção', async () => {
    const db = visitor().firestore();
    await assertFails(setDoc(doc(db, 'schools/x'), { name: 'X', published: true }));
    await assertFails(setDoc(doc(db, 'schools/pub/teams/novo'), { name: 'N', schoolId: 'pub' }));
    await assertFails(setDoc(doc(db, 'schools/pub/rounds/r1/results/t1'), { teamId: 't1', position: 1, kills: 99, extras: {}, status: 'complete' }));
    await assertFails(deleteDoc(doc(db, 'schools/pub')));
  });
  it('usuário logado sem claim de admin não escreve', async () => {
    const db = user().firestore();
    await assertFails(setDoc(doc(db, 'schools/x'), { name: 'X', published: true }));
    await assertFails(deleteDoc(doc(db, 'schools/pub/teams/t1')));
  });
  it('um usuário não consegue se promover a admin gravando documentos', async () => {
    const db = user().firestore();
    await assertFails(setDoc(doc(db, 'admins/u1'), { admin: true }));
    await assertFails(setDoc(doc(db, 'users/u1'), { admin: true }));
  });
  it('administrador escreve dados válidos', async () => {
    const db = admin().firestore();
    await assertSucceeds(setDoc(doc(db, 'schools/nova'), { name: 'Nova', published: false }));
    await assertSucceeds(setDoc(doc(db, 'schools/pub/teams/t2'), { name: 'Outro', schoolId: 'pub' }));
  });
  it('administrador não grava dados inválidos', async () => {
    const db = admin().firestore();
    await assertFails(setDoc(doc(db, 'schools/ruim'), { name: '', published: true }));
    await assertFails(setDoc(doc(db, 'schools/pub/rounds/r1/results/t1'), { teamId: 't1', position: 0, kills: 1, extras: {}, status: 'complete' }));
    await assertFails(setDoc(doc(db, 'schools/pub/rounds/r1/results/t1'), { teamId: 't1', position: 1, kills: -3, extras: {}, status: 'complete' }));
    await assertFails(setDoc(doc(db, 'schools/pub/matches/m1'), { status: 'finished', bestOf: 2 }));
  });
  it('coleções desconhecidas são negadas até para admin', async () => {
    await assertFails(setDoc(doc(admin().firestore(), 'qualquer/coisa'), { a: 1 }));
  });
});
