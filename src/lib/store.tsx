import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyCustomMetrics } from '../data/catalog';
import type { Access, Club, CustomMetric, Player, Role, Squad } from '../types';
import { cloudBackend, describeError, localBackend, SEED, type AuthUser, type Backend, type Op } from './backend';
import { isFirebaseConfigured } from './firebase';
import { todayISO } from './format';
import { missingClubs } from './leagues';

interface StoreValue {
  players: Player[];
  clubs: Club[];
  ready: boolean;
  mode: 'cloud' | 'local';
  user: AuthUser | null;
  role: Role;
  canEdit: boolean;
  /** Conta com login, mas fora da lista de editores. */
  denied: boolean;
  error: string;
  clearError: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  savePlayer: (p: Player) => Promise<boolean>;
  removePlayer: (id: string) => Promise<boolean>;
  savePlayers: (list: Player[]) => Promise<boolean>;
  /** Cria os clubes que aparecem nos jogadores e ainda não existem. Devolve quantos faltavam. */
  createMissingClubs: () => Promise<number>;
  /** Clube com `privado: true` vai para a conta de quem está logado; os demais exigem editor. */
  saveClub: (c: Club) => Promise<boolean>;
  /** Cenários do montador de elenco da conta logada. */
  squads: Squad[];
  saveSquad: (s: Squad) => Promise<boolean>;
  removeClub: (id: string) => Promise<boolean>;
  loadSeed: () => Promise<boolean>;
  access: Access | null;
  saveAccess: (a: Access) => Promise<boolean>;
  metrics: CustomMetric[];
  /** Muda quando as métricas criadas mudam; as telas usam como chave para recalcular. */
  catalogVersion: number;
  saveMetrics: (list: CustomMetric[]) => Promise<boolean>;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const backend = useMemo<Backend>(() => (isFirebaseConfigured ? cloudBackend() : localBackend()), []);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sharedClubs, setClubs] = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<CustomMetric[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    const off = backend.subscribe(
      (s) => {
        setPlayers(s.players);
        setClubs(s.clubs);
        setReady(true);
        first.current = false;
      },
      (m) => {
        setError(m);
        setReady(true);
      },
    );
    return off;
  }, [backend]);

  useEffect(
    () =>
      backend.subscribeMetrics((list) => {
        applyCustomMetrics(list); // antes de renderizar, para todas as telas já enxergarem as métricas
        setMetrics(list);
        setCatalogVersion((v) => v + 1);
      }),
    [backend],
  );

  useEffect(() => backend.onUser(setUser), [backend]);

  // Clubes pessoais de quem está logado.
  const uid = user?.uid;
  useEffect(() => {
    setMyClubs([]);
    if (!uid) return;
    return backend.subscribeMyClubs(uid, setMyClubs, (m) => setError(m));
  }, [backend, uid]);

  useEffect(() => {
    setSquads([]);
    if (!uid) return;
    return backend.subscribeMySquads(uid, setSquads, (m) => setError(m));
  }, [backend, uid]);

  const clubs = useMemo(() => [...sharedClubs, ...myClubs], [sharedClubs, myClubs]);

  // Descobre se a conta logada é dono, editor ou só visitante.
  useEffect(() => {
    let alive = true;
    setAccess(null);
    setDenied(false);
    if (!user) return;
    backend
      .loadAccess()
      .then((r) => {
        if (!alive) return;
        if (r.status === 'ok') setAccess(r.access);
        else setDenied(true);
      })
      .catch((e) => alive && setError(describeError(e)));
    return () => {
      alive = false;
    };
  }, [backend, user]);

  const role: Role = useMemo(() => {
    if (!user || !access) return 'viewer';
    if (access.owners.includes(user.email.toLowerCase())) return 'owner';
    if (access.editors.includes(user.email.toLowerCase())) return 'editor';
    return 'viewer';
  }, [user, access]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
        return true;
      } catch (e) {
        setError(describeError(e));
        return false;
      }
    },
    [],
  );
  const write = useCallback((ops: Op[]) => run(() => backend.write(ops)), [backend, run]);
  const stamp = <T extends { atualizadoEm: string }>(x: T): T => ({ ...x, atualizadoEm: todayISO() });

  /** Clubes novos que os jogadores recebidos pedem; entram na mesma gravação. */
  const clubOps = (list: Player[]): Op[] => missingClubs(list, sharedClubs).map((c) => ({ kind: 'set' as const, col: 'clubs' as const, id: c.id, data: c }));

  const value: StoreValue = {
    players,
    clubs,
    ready,
    mode: backend.mode,
    user,
    role,
    canEdit: role !== 'viewer',
    denied,
    error,
    clearError: () => setError(''),
    signIn: async () => {
      setError('');
      await run(() => backend.signIn());
    },
    signOut: async () => {
      await run(() => backend.signOut());
    },
    savePlayer: (p) => write([{ kind: 'set', col: 'players', id: p.id, data: stamp(p) }, ...clubOps([p])]),
    removePlayer: (id) => write([{ kind: 'del', col: 'players', id }]),
    savePlayers: (list) => write([...list.map((p) => ({ kind: 'set' as const, col: 'players' as const, id: p.id, data: stamp(p) })), ...clubOps(list)]),
    createMissingClubs: async () => {
      const ops = clubOps(players);
      if (!ops.length) return 0;
      return (await write(ops)) ? ops.length : 0;
    },
    saveClub: (c) => {
      if (c.privado) {
        if (!user) return Promise.resolve(false);
        return run(() => backend.saveMyClub(user.uid, stamp(c)));
      }
      return write([{ kind: 'set', col: 'clubs', id: c.id, data: stamp(c) }]);
    },
    removeClub: (id) => {
      if (user && myClubs.some((c) => c.id === id)) return run(() => backend.removeMyClub(user.uid, id));
      return write([{ kind: 'del', col: 'clubs', id }]);
    },
    loadSeed: () =>
      write([
        ...SEED.players.map((p) => ({ kind: 'set' as const, col: 'players' as const, id: p.id, data: p })),
        ...SEED.clubs.map((c) => ({ kind: 'set' as const, col: 'clubs' as const, id: c.id, data: c })),
      ]),
    squads,
    saveSquad: (sq) => {
      if (!user) return Promise.resolve(false);
      return run(() => backend.saveMySquad(user.uid, { ...sq, atualizadoEm: todayISO() }));
    },
    metrics,
    catalogVersion,
    saveMetrics: (list) => run(() => backend.saveMetrics(list)),
    access,
    saveAccess: async (a) => {
      const ok = await run(() => backend.saveAccess(a));
      if (ok) setAccess({ owners: a.owners.map((x) => x.toLowerCase()), editors: a.editors.map((x) => x.toLowerCase()) });
      return ok;
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore fora do StoreProvider');
  return v;
}
