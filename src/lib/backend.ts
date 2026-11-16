import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { Access, Club, CustomMetric, Player, Squad } from '../types';
import { getAuthInstance, getDb } from './firebase';
import seed from '../data/seed.json';

export interface Snapshot {
  players: Player[];
  clubs: Club[];
}

export type Op =
  | { kind: 'set'; col: 'players'; id: string; data: Player }
  | { kind: 'set'; col: 'clubs'; id: string; data: Club }
  | { kind: 'del'; col: 'players' | 'clubs'; id: string };

export interface AuthUser {
  uid: string;
  email: string;
  name?: string;
}

export type AccessState = { status: 'none' } | { status: 'ok'; access: Access } | { status: 'denied' };

export interface Backend {
  mode: 'cloud' | 'local';
  subscribe(onData: (s: Snapshot) => void, onError: (message: string) => void): () => void;
  write(ops: Op[]): Promise<void>;
  onUser(cb: (u: AuthUser | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Lê a lista de editores. Só quem já é editor consegue; os outros recebem "denied". */
  loadAccess(): Promise<AccessState>;
  saveAccess(a: Access): Promise<void>;
  /** Métricas criadas pelo dono. Qualquer pessoa lê; só donos gravam. */
  subscribeMetrics(onData: (list: CustomMetric[]) => void): () => void;
  saveMetrics(list: CustomMetric[]): Promise<void>;
  /** Clubes pessoais: cada conta só enxerga e grava os seus. */
  subscribeMyClubs(uid: string, onData: (list: Club[]) => void, onError: (message: string) => void): () => void;
  saveMyClub(uid: string, club: Club): Promise<void>;
  removeMyClub(uid: string, id: string): Promise<void>;
  /** Cenários de elenco pessoais (montador de elenco). */
  subscribeMySquads(uid: string, onData: (list: Squad[]) => void, onError: (message: string) => void): () => void;
  saveMySquad(uid: string, squad: Squad): Promise<void>;
}

export const SEED: Snapshot = seed as unknown as Snapshot;

/** O Firestore não aceita `undefined`. */
const clean = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function applyOps(s: Snapshot, ops: Op[]): Snapshot {
  let { players, clubs } = s;
  const upsert = <T extends { id: string }>(list: T[], item: T) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);
  for (const op of ops) {
    if (op.kind === 'set') {
      if (op.col === 'players') players = upsert(players, op.data);
      else clubs = upsert(clubs, op.data);
    } else if (op.col === 'players') players = players.filter((x) => x.id !== op.id);
    else clubs = clubs.filter((x) => x.id !== op.id);
  }
  return { players, clubs };
}

export function describeError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return 'O Firebase recusou a operação. Confira se as regras do Firestore (arquivo firestore.rules) foram publicadas e se sua conta está na lista de editores.';
  if (code === 'unavailable') return 'Sem conexão com o Firebase. Tente de novo quando a internet voltar.';
  if (code === 'not-found') return 'Banco do Firestore não encontrado. Crie o banco no console do Firebase (Firestore Database > Criar banco de dados).';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Login cancelado.';
  if (code === 'auth/unauthorized-domain') return 'Este endereço não está autorizado no Firebase. Adicione o domínio em Authentication > Settings > Authorized domains.';
  if (code === 'auth/operation-not-allowed') return 'O login com Google não está ativado no Firebase (Authentication > Sign-in method).';
  if (code === 'auth/popup-blocked') return 'O navegador bloqueou a janela de login. Libere pop-ups para este site e tente de novo.';
  return e instanceof Error ? e.message : String(e);
}

export function cloudBackend(): Backend {
  const db = getDb();
  const auth = getAuthInstance();
  const accessRef = () => doc(db, 'config', 'access');
  return {
    mode: 'cloud',
    subscribe(onData, onError) {
      const cur: Snapshot = { players: [], clubs: [] };
      const got = new Set<string>();
      const emit = (k: string) => {
        got.add(k);
        if (got.size === 2) onData({ players: [...cur.players], clubs: [...cur.clubs] });
      };
      const u1 = onSnapshot(collection(db, 'players'), (s) => {
        cur.players = s.docs.map((d) => d.data() as Player);
        emit('players');
      }, (e) => onError(describeError(e)));
      const u2 = onSnapshot(collection(db, 'clubs'), (s) => {
        cur.clubs = s.docs.map((d) => d.data() as Club);
        emit('clubs');
      }, (e) => onError(describeError(e)));
      return () => {
        u1();
        u2();
      };
    },
    async write(ops) {
      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + 400)) {
          const ref = doc(db, op.col, op.id);
          if (op.kind === 'set') batch.set(ref, clean(op.data));
          else batch.delete(ref);
        }
        await batch.commit();
      }
    },
    onUser(cb) {
      return onAuthStateChanged(auth, (u) => cb(u?.email ? { uid: u.uid, email: u.email.toLowerCase(), name: u.displayName ?? undefined } : null));
    },
    async signIn() {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    async signOut() {
      await signOut(auth);
    },
    async loadAccess() {
      try {
        const s = await getDoc(accessRef());
        if (!s.exists()) return { status: 'none' };
        const d = s.data() as Partial<Access>;
        return { status: 'ok', access: { owners: (d.owners ?? []).map((x) => x.toLowerCase()), editors: (d.editors ?? []).map((x) => x.toLowerCase()) } };
      } catch (e) {
        if ((e as { code?: string }).code === 'permission-denied') return { status: 'denied' };
        throw e;
      }
    },
    subscribeMetrics(onData) {
      // Se a leitura falhar (regras antigas, sem internet), o app segue só com as métricas padrão.
      return onSnapshot(
        doc(db, 'config', 'metrics'),
        (s) => onData(s.exists() ? (((s.data() as { items?: CustomMetric[] }).items ?? []) as CustomMetric[]) : []),
        () => onData([]),
      );
    },
    async saveMetrics(list) {
      await setDoc(doc(db, 'config', 'metrics'), clean({ items: list }));
    },
    subscribeMyClubs(uid, onData, onError) {
      return onSnapshot(collection(db, 'users', uid, 'clubs'), (s) => onData(s.docs.map((d) => ({ ...(d.data() as Club), privado: true }))), (e) => onError(describeError(e)));
    },
    async saveMyClub(uid, club) {
      await setDoc(doc(db, 'users', uid, 'clubs', club.id), clean({ ...club, privado: true }));
    },
    async removeMyClub(uid, id) {
      await deleteDoc(doc(db, 'users', uid, 'clubs', id));
    },

    subscribeMySquads(uid, onData, onError) {
      return onSnapshot(collection(db, 'users', uid, 'squads'), (s) => onData(s.docs.map((d) => d.data() as Squad)), (e) => onError(describeError(e)));
    },
    async saveMySquad(uid, squad) {
      await setDoc(doc(db, 'users', uid, 'squads', squad.id), clean(squad));
    },
    async saveAccess(a) {
      await setDoc(accessRef(), clean({ owners: a.owners.map((x) => x.toLowerCase()), editors: a.editors.map((x) => x.toLowerCase()) }));
    },
  };
}

const LS = 'encaixe-base-v1';
const LS_ACCESS = 'encaixe-acesso-v1';
const LS_METRICS = 'encaixe-metricas-v1';
const LS_MY = 'encaixe-meusclubes-v1';
const LS_SQ = 'encaixe-elencos-v1';

/** Modo demonstração: tudo fica só neste navegador. Serve para testar antes de ligar o Firebase. */
export function localBackend(): Backend {
  const listeners = new Set<(s: Snapshot) => void>();
  const read = (): Snapshot => {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) return JSON.parse(raw) as Snapshot;
    } catch {
      /* usa a base inicial */
    }
    return clean(SEED);
  };
  let state = read();
  const mListeners = new Set<(l: CustomMetric[]) => void>();
  const myListeners = new Set<(l: Club[]) => void>();
  const sqListeners = new Set<(l: Squad[]) => void>();
  const readSquads = (uid: string): Squad[] => {
    try {
      const raw = localStorage.getItem(`${LS_SQ}:${uid}`);
      if (raw) return JSON.parse(raw) as Squad[];
    } catch {
      /* nenhum */
    }
    return [];
  };
  const readMine = (uid: string): Club[] => {
    try {
      const raw = localStorage.getItem(`${LS_MY}:${uid}`);
      if (raw) return JSON.parse(raw) as Club[];
    } catch {
      /* nenhum */
    }
    return [];
  };
  const writeMine = (uid: string, list: Club[]) => {
    try {
      localStorage.setItem(`${LS_MY}:${uid}`, JSON.stringify(list));
    } catch {
      /* sem armazenamento */
    }
    myListeners.forEach((l) => l(list));
  };
  const readMetrics = (): CustomMetric[] => {
    try {
      const raw = localStorage.getItem(LS_METRICS);
      if (raw) return JSON.parse(raw) as CustomMetric[];
    } catch {
      /* nenhuma */
    }
    return [];
  };
  const persist = () => {
    try {
      localStorage.setItem(LS, JSON.stringify(state));
    } catch {
      /* sem armazenamento: continua em memória */
    }
  };
  return {
    mode: 'local',
    subscribe(onData) {
      listeners.add(onData);
      queueMicrotask(() => onData(state));
      return () => listeners.delete(onData);
    },
    async write(ops) {
      state = applyOps(state, clean(ops));
      persist();
      listeners.forEach((l) => l(state));
    },
    onUser(cb) {
      queueMicrotask(() => cb({ uid: 'demo', email: 'demonstracao@local', name: 'Modo demonstração' }));
      return () => {};
    },
    async signIn() {},
    async signOut() {},
    async loadAccess() {
      try {
        const raw = localStorage.getItem(LS_ACCESS);
        if (raw) return { status: 'ok', access: JSON.parse(raw) as Access };
      } catch {
        /* padrão */
      }
      return { status: 'ok', access: { owners: ['demonstracao@local'], editors: [] } };
    },
    subscribeMetrics(onData) {
      mListeners.add(onData);
      queueMicrotask(() => onData(readMetrics()));
      return () => mListeners.delete(onData);
    },
    async saveMetrics(list) {
      try {
        localStorage.setItem(LS_METRICS, JSON.stringify(list));
      } catch {
        /* sem armazenamento */
      }
      mListeners.forEach((l) => l(list));
    },
    async saveAccess(a) {
      try {
        localStorage.setItem(LS_ACCESS, JSON.stringify(a));
      } catch {
        /* ignora */
      }
    },
    subscribeMyClubs(uid, onData) {
      const key = `${LS_MY}:${uid}`;
      const read = (): Club[] => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) return JSON.parse(raw) as Club[];
        } catch {
          /* nenhum */
        }
        return [];
      };
      const l = (list: Club[]) => onData(list);
      myListeners.add(l);
      queueMicrotask(() => onData(read()));
      return () => myListeners.delete(l);
    },
    async saveMyClub(uid, club) {
      const list = readMine(uid).filter((c) => c.id !== club.id);
      writeMine(uid, [...list, { ...club, privado: true }]);
    },
    async removeMyClub(uid, id) {
      writeMine(uid, readMine(uid).filter((c) => c.id !== id));
    },

    subscribeMySquads(uid, onData) {
      const l = (list: Squad[]) => onData(list);
      sqListeners.add(l);
      queueMicrotask(() => onData(readSquads(uid)));
      return () => sqListeners.delete(l);
    },
    async saveMySquad(uid, squad) {
      const list = [...readSquads(uid).filter((x) => x.id !== squad.id), squad];
      try {
        localStorage.setItem(`${LS_SQ}:${uid}`, JSON.stringify(list));
      } catch {
        /* sem armazenamento */
      }
      sqListeners.forEach((l) => l(list));
    },
  };
}
