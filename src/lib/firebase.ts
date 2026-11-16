import { getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

// Os valores vêm das variáveis VITE_FIREBASE_* (veja o README). Elas são lidas na hora do build.
const env = import.meta.env as Record<string, string | undefined>;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId && config.authDomain);

// Opcional: nome do banco, para quem usa um banco que não é o "(default)".
const databaseId = env.VITE_FIREBASE_DATABASE_ID || undefined;

/** ID do Google Analytics (opcional). Sem ele, nada é medido. */
export const measurementId = config.measurementId;

export const app = () => getApps()[0] ?? initializeApp(config);

let cachedDb: Firestore | null = null;
export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  const a = app();
  try {
    // Guarda uma cópia no navegador: abre mesmo sem internet.
    cachedDb = initializeFirestore(a, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }, databaseId);
  } catch {
    cachedDb = databaseId ? getFirestore(a, databaseId) : getFirestore(a);
  }
  return cachedDb;
}

export const getAuthInstance = (): Auth => getAuth(app());
