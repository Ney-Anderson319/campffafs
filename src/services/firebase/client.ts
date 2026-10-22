import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

// Configuração PÚBLICA do app web. Não é credencial administrativa.
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

const REQUIRED: Array<[keyof typeof config, string]> = [
  ['apiKey', 'VITE_FIREBASE_API_KEY'],
  ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'],
  ['projectId', 'VITE_FIREBASE_PROJECT_ID'],
  ['appId', 'VITE_FIREBASE_APP_ID'],
];

export const missingEnvVars = REQUIRED.filter(([k]) => !config[k]).map(([, name]) => name);
export const isFirebaseConfigured = missingEnvVars.length === 0;
const useEmulators = env.VITE_USE_EMULATORS === 'true';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function getApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(`Variáveis do Firebase ausentes: ${missingEnvVars.join(', ')}`);
  }
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) {
    auth = getAuth(getApp());
    if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}

export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getApp());
    if (useEmulators) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return db;
}
