import { useEffect, useState } from 'react';
import { LogIn, LogOut, Menu, X } from 'lucide-react';
import { Button } from './components/ui';
import CookieNotice from './components/CookieNotice';
import { track } from './lib/analytics';
import { go, href, usePath } from './lib/router';
import { useStore } from './lib/store';
import Access from './views/Access';
import { ClubForm, ClubsList } from './views/Clubs';
import Metrics from './views/Metrics';
import Table from './views/Table';
import PlayerForm from './views/PlayerForm';
import { PlayerPage, PlayersList } from './views/Players';
import SquadBuilder from './views/Squad';
import Recommend from './views/Recommend';

const ROLE_LABEL = { owner: 'Dono', editor: 'Editor', viewer: 'Visitante' } as const;

export default function App() {
  const path = usePath();
  const [menu, setMenu] = useState(false);
  const { mode, user, role, canEdit, denied, error, clearError, signIn, signOut, ready, players, loadSeed, catalogVersion } = useStore();
  const [a, b, c] = path;
  const pathKey = path.join('/');
  useEffect(() => track('page_view', { page_path: '/' + pathKey }), [pathKey]);
  const section = a ?? 'recomendar';

  const nav: [string, string, boolean][] = [
    ['recomendar', 'Recomendar', true],
    ['jogadores', 'Jogadores', true],
    ['clubes', 'Clubes', true],
    ['elenco', 'Montar elenco', true],
    ['tabela', 'Editar em tabela', canEdit],
    ['metricas', 'Métricas', role === 'owner'],
    ['acesso', 'Acesso', role === 'owner'],
  ];

  let view;
  if (section === 'recomendar') view = <Recommend key={b ?? 'none'} clubId={b} />;
  else if (section === 'jogadores') {
    if (b === 'novo') view = <PlayerForm key="novo" />;
    else if (b && c === 'editar') view = <PlayerForm key={b} id={b} />;
    else if (b) view = <PlayerPage key={b} id={b} />;
    else view = <PlayersList />;
  } else if (section === 'clubes') {
    if (b === 'novo') view = <ClubForm key="novo" />;
    else if (b && c === 'editar') view = <ClubForm key={b} id={b} />;
    else view = <ClubsList />;
  } else if (section === 'tabela') view = <Table />;
  else if (section === 'elenco') view = <SquadBuilder key={b ?? 'none'} clubId={b} />;
  else if (section === 'metricas') view = <Metrics />;
  else if (section === 'acesso') view = <Access />;
  else view = <Recommend key="none" />;

  return (
    <div className="min-h-screen">
      <header className="no-print border-b-[3px] border-accent bg-side">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <a href={href('recomendar')} className="order-1 flex items-center gap-2.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.9rem', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>
            <svg width="30" height="30" viewBox="0 0 34 34" aria-hidden="true" fill="none" stroke="#ffd93b" strokeWidth="2.4">
              <circle cx="17" cy="17" r="14" />
              <path d="M17 8l6 4.4-2.3 7h-7.4L11 12.4z" fill="#ffd93b" stroke="none" />
              <path d="M17 8V3M23 12.4l5-1.8M20.7 19.4l3.3 4.6M13.3 19.4L10 24M11 12.4L6 10.6" />
            </svg>
            Encaixe
          </a>
          <nav id="menu-principal" aria-label="Principal" className={`${menu ? 'flex' : 'hidden'} order-4 w-full flex-col gap-1 md:order-2 md:flex md:w-auto md:flex-row md:flex-wrap`}>
            {nav
              .filter(([, , show]) => show)
              .map(([k, label]) => (
                <a key={k} href={href(k)} aria-current={section === k ? 'page' : undefined} onClick={() => setMenu(false)} className={`flex min-h-11 items-center px-2.5 py-1 uppercase md:min-h-0 ${section === k ? 'bg-accent text-on' : 'hover:bg-ink/15'}`} style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em' }}>
                  {label}
                </a>
              ))}
          </nav>
          <div className="order-2 ml-auto flex items-center gap-2 text-sm md:order-3 md:ml-0">
            {user ? (
              <>
                <span className="hidden text-xs text-muted xl:inline">
                  {user.email} · <strong>{ROLE_LABEL[role]}</strong>
                </span>
                <Button variant="ghost" small onClick={signOut}>
                  <LogOut className="h-3.5 w-3.5" /> Sair
                </Button>
              </>
            ) : (
              <Button variant="ghost" small onClick={signIn}>
                <LogIn className="h-3.5 w-3.5" /> Entrar
              </Button>
            )}
          </div>
          <button
            type="button"
            aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menu}
            aria-controls="menu-principal"
            onClick={() => setMenu((m) => !m)}
            className="order-3 flex h-11 w-11 cursor-pointer items-center justify-center border-2 border-ink hover:bg-ink hover:text-bg md:hidden"
          >
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {mode === 'local' && (
          <p className="no-print mb-4 border-2 border-warn px-3 py-2 text-sm text-warn">
            Modo demonstração: sem Firebase configurado, os dados ficam só neste navegador e qualquer pessoa pode editar. No site publicado, só os e-mails autorizados editam.
          </p>
        )}
        {error && (
          <p role="alert" className="no-print mb-4 flex items-start justify-between gap-3 border-2 border-bad px-3 py-2 text-sm font-semibold text-bad">
            <span>{error}</span>
            <button type="button" className="underline" onClick={clearError}>
              Fechar
            </button>
          </p>
        )}
        {denied && (
          <p className="no-print mb-4 border-2 border-ink px-3 py-2 text-sm">
            Você entrou como {user?.email}, mas esse e-mail não está autorizado a editar. Você pode consultar toda a base e criar clubes só seus (aba Clubes) para a sua pesquisa; ninguém mais enxerga o que você criar. Para editar jogadores e clubes da base, peça ao dono para liberar seu acesso.
          </p>
        )}
        {ready && canEdit && players.length === 0 && mode === 'cloud' && (
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 border-2 border-ink px-3 py-2 text-sm">
            <span>A base está vazia. Você pode carregar os 15 meias do curso ou cadastrar jogadores na tabela.</span>
            <span className="flex gap-2">
              <Button small variant="ghost" onClick={() => go('tabela')}>
                Editar em tabela
              </Button>
              <Button small variant="accent" onClick={loadSeed}>
                Carregar base do curso
              </Button>
            </span>
          </div>
        )}
        {!ready ? <p className="text-sm text-muted">Carregando...</p> : <div key={catalogVersion}>{view}</div>}
      </main>
      <CookieNotice />
    </div>
  );
}
