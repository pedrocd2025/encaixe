import { app, isFirebaseConfigured, measurementId } from './firebase';

/**
 * Medição de acessos (Google Analytics via Firebase). Regras:
 * - só funciona se VITE_FIREBASE_MEASUREMENT_ID existir (senão nada é enviado);
 * - só começa depois que a pessoa aceita o aviso de cookies;
 * - nunca envia e-mail nem nome da pessoa: só o que foi escolhido (clube, posição, jogador).
 */
const KEY = 'encaixe-cookies-v1';
export type Consent = 'sim' | 'nao' | null;

export const analyticsAvailable = isFirebaseConfigured && !!measurementId;

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'sim' || v === 'nao' ? v : null;
  } catch {
    return null;
  }
}

type Logger = (name: string, params?: Record<string, string | number>) => void;
let logger: Logger | null = null;
let starting: Promise<void> | null = null;
const queue: [string, Record<string, string | number> | undefined][] = [];

async function start() {
  if (logger || starting || !analyticsAvailable || getConsent() !== 'sim') return;
  starting = (async () => {
    try {
      const mod = await import('firebase/analytics');
      if (!(await mod.isSupported())) return;
      const a = mod.getAnalytics(app());
      mod.setConsent({ analytics_storage: 'granted' } as never);
      logger = (name, params) => mod.logEvent(a, name as never, params as never);
      queue.splice(0).forEach(([n, p]) => logger?.(n, p));
    } catch {
      /* sem Analytics: o app segue normal */
    }
  })();
  await starting;
}

export function setConsent(v: 'sim' | 'nao') {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* sem armazenamento */
  }
  if (v === 'sim') void start();
  else {
    logger = null;
    queue.length = 0;
  }
}

/** Registra um evento. Sem consentimento ou sem Analytics configurado, não faz nada. */
export function track(name: string, params?: Record<string, string | number>) {
  if (!analyticsAvailable || getConsent() !== 'sim') return;
  if (logger) logger(name, params);
  else {
    queue.push([name, params]);
    void start();
  }
}

if (analyticsAvailable && getConsent() === 'sim') void start();
