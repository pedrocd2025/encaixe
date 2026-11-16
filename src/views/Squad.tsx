import { useEffect, useMemo, useState } from 'react';
import { Plus, Undo2 } from 'lucide-react';
import { Button, Card, Empty, PageHeader } from '../components/ui';
import Pitch from '../components/Pitch';
import { Tag } from '../components/ui';
import { POSITION_ORDER, POSITIONS } from '../data/positions';
import { ELENCO_FLUMINENSE, rosterToPlayers } from '../data/elencos';
import { passesFilters, sameClub } from '../lib/filters';
import { emptyLineup, pruneLineup } from '../lib/formations';
import { fmtEur, fmtYm, normalizeText } from '../lib/format';
import { leagueOptions } from '../lib/leagues';
import { go, href } from '../lib/router';
import { track } from '../lib/analytics';
import { useStore } from '../lib/store';
import type { Decisao, Escalacao, Filters, Player, PositionKey, Squad as SquadT } from '../types';

const DEC: [Decisao, string][] = [
  ['manter', 'Manter'],
  ['vender', 'Vender'],
  ['emprestar', 'Emprestar'],
];

export default function SquadBuilder({ clubId }: { clubId?: string }) {
  const { clubs, players, squads, saveSquad, user, canEdit, savePlayers } = useStore();
  const [msg, setMsg] = useState('');
  const [posBusca, setPosBusca] = useState<PositionKey | ''>('');
  const clubsWithPlayers = useMemo(() => clubs.filter((c) => players.some((p) => sameClub(p.clube, c.nome))), [clubs, players]);
  const club = clubs.find((c) => c.id === clubId) ?? null;

  const saved = squads.find((s) => s.id === clubId);
  const [local, setLocal] = useState<SquadT | null>(null); // cenário em memória quando não dá para salvar
  const squad: SquadT = local ?? saved ?? { id: clubId ?? '', decisoes: {}, contratacoes: [], atualizadoEm: '' };
  useEffect(() => setLocal(null), [clubId]);

  const update = async (next: SquadT) => {
    setLocal(next);
    if (user) await saveSquad(next);
  };

  const elenco = useMemo(() => (club ? players.filter((p) => sameClub(p.clube, club.nome)) : []), [players, club]);
  const decisao = (p: Player): Decisao => squad.decisoes[p.id] ?? 'manter';
  const contratados = useMemo(() => squad.contratacoes.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p), [squad.contratacoes, players]);

  const resumo = POSITION_ORDER.map((pos) => {
    const hoje = elenco.filter((p) => p.posicao === pos);
    const saem = hoje.filter((p) => decisao(p) !== 'manter').length;
    const entram = contratados.filter((p) => p.posicao === pos).length;
    return { pos, hoje: hoje.length, saem, entram, fica: hoje.length - saem + entram };
  }).filter((r) => r.hoje > 0 || r.entram > 0);

  const alvo: PositionKey = posBusca || [...resumo].sort((a, b) => b.saem - b.entram - (a.saem - a.entram))[0]?.pos || 'meia-atacante';
  const [f, setF] = useState<Filters>({});
  const [ordem, setOrdem] = useState<'valor' | 'idade' | 'nome'>('valor');
  const ligas = useMemo(() => leagueOptions(players, clubs), [players, clubs]);
  const candidatos = useMemo(() => {
    if (!club) return [];
    const list = players.filter((p) => p.posicao === alvo && !sameClub(p.clube, club.nome) && !squad.contratacoes.includes(p.id) && passesFilters(p, f));
    const by = {
      valor: (a: Player, b: Player) => (a.valorEur ?? Infinity) - (b.valorEur ?? Infinity),
      idade: (a: Player, b: Player) => (a.idade ?? 999) - (b.idade ?? 999),
      nome: (a: Player, b: Player) => a.nome.localeCompare(b.nome, 'pt-BR'),
    }[ordem];
    return [...list].sort(by);
  }, [players, club, alvo, squad.contratacoes, f, ordem]);
  const setFilter = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));

  // Elenco final: quem fica + quem foi contratado. A escalação só guarda quem ainda está nele.
  const final = useMemo(() => [...elenco.filter((p) => decisao(p) === 'manter'), ...contratados], [elenco, contratados, squad.decisoes]);
  const lineup: Escalacao = useMemo(() => pruneLineup(squad.escalacao ?? emptyLineup(), new Set(final.map((p) => p.id))), [squad.escalacao, final]);

  const loadFlu = async () => {
    const novos = rosterToPlayers(ELENCO_FLUMINENSE, 'Fluminense-BRA', players, normalizeText, sameClub);
    if (!novos.length) return setMsg('O elenco do Fluminense já está completo na base.');
    if (await savePlayers(novos)) setMsg(`${novos.length} jogador(es) do Fluminense cadastrados (sem estatísticas). Os que já existiam não foram alterados.`);
  };

  return (
    <>
      <PageHeader
        title="Montar elenco"
        sub="Escolha o clube, decida o que fazer com cada jogador, contrate pelos filtros e monte o time titular no campinho. Tudo fica salvo só na sua conta."
      />
      {msg && (
        <p role="status" className="mb-4 border-2 border-good px-3 py-2 text-sm font-semibold text-good">
          {msg}
        </p>
      )}
      {canEdit && !players.some((p) => sameClub(p.clube, 'Fluminense') && p.fonte === 'Lista do elenco enviada por você') && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-2 border-ink px-3 py-2 text-sm">
          <span>Cadastrar o elenco do Fluminense (32 nomes da lista que você enviou, sem estatísticas). Quem já está na base não muda.</span>
          <Button small variant="accent" onClick={loadFlu}>
            Cadastrar elenco do Fluminense
          </Button>
        </div>
      )}
      <Card title="1. Clube">
        <select aria-label="Clube" className="max-w-sm" value={clubId ?? ''} onChange={(e) => go('elenco', ...(e.target.value ? [e.target.value] : []))}>
          <option value="">Escolha o clube</option>
          {clubsWithPlayers
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.privado ? ' (só meu)' : ''}
              </option>
            ))}
        </select>
        {!user && <p className="mt-2 text-xs text-muted">Entre com sua conta Google para o cenário ficar salvo. Sem login, ele vale só até fechar a página.</p>}
      </Card>

      {!club ? (
        <div className="mt-5">
          <Empty title="Escolha um clube para começar">Só aparecem clubes que têm jogadores na base. Cadastre o elenco em “Editar em tabela” ou use o botão acima.</Empty>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <Card title={`2. Elenco atual do ${club.nome} (${elenco.length})`}>
            {elenco.length === 0 ? (
              <p className="text-sm text-muted">Nenhum jogador neste clube.</p>
            ) : (
              <div className="space-y-5">
                {POSITION_ORDER.map((pos) => {
                  const list = elenco.filter((p) => p.posicao === pos);
                  if (!list.length) return null;
                  return (
                    <div key={pos}>
                      <h3 className="mb-1 text-xs font-bold tracking-wide text-muted uppercase">{POSITIONS[pos].label}</h3>
                      <ul className="divide-y divide-ink/15 border-2 border-ink/20">
                        {list.map((p) => (
                          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span>
                              <a className="font-semibold underline" href={href('jogadores', p.id)}>
                                {p.nome}
                              </a>{' '}
                              <span className="num text-xs text-muted">
                                {p.idade !== undefined ? `${p.idade} anos` : ''}
                                {p.contratoFim ? ` · contrato até ${fmtYm(p.contratoFim)}` : ''}
                                {p.valorEur ? ` · ${fmtEur(p.valorEur)}` : ''}
                              </span>{' '}
                            </span>
                            <span className="flex gap-1" role="group" aria-label={`Decisão para ${p.nome}`}>
                              {DEC.map(([d, l]) => (
                                <button
                                  key={d}
                                  type="button"
                                  aria-pressed={decisao(p) === d}
                                  onClick={() => update({ ...squad, id: club.id, decisoes: { ...squad.decisoes, [p.id]: d } })}
                                  className={`cursor-pointer border-2 px-2 py-1 text-xs font-semibold ${decisao(p) === d ? (d === 'manter' ? 'border-good bg-good text-on' : 'border-accent bg-accent text-on') : 'border-ink bg-card'}`}
                                >
                                  {l}
                                </button>
                              ))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="3. Contratar">
            <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Posição
                <select value={alvo} onChange={(e) => setPosBusca(e.target.value as PositionKey)}>
                  {POSITION_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {POSITIONS[k].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Idade até
                <select value={f.idadeMax ?? ''} onChange={(e) => setFilter({ idadeMax: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Qualquer</option>
                  {[21, 23, 25, 28, 30, 33].map((n) => (
                    <option key={n} value={n}>
                      {n} anos
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Altura mínima
                <select value={f.alturaMin ?? ''} onChange={(e) => setFilter({ alturaMin: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Qualquer</option>
                  {[170, 175, 180, 185, 190].map((n) => (
                    <option key={n} value={n}>
                      {n} cm
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Pé dominante
                <select value={f.pe ?? ''} onChange={(e) => setFilter({ pe: e.target.value || undefined })}>
                  <option value="">Qualquer</option>
                  <option value="Direito">Direito</option>
                  <option value="Esquerdo">Esquerdo</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Valor de mercado até
                <select value={f.valorMax ?? ''} onChange={(e) => setFilter({ valorMax: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Qualquer</option>
                  {[500000, 1000000, 2500000, 5000000, 10000000, 20000000].map((n) => (
                    <option key={n} value={n}>
                      {fmtEur(n)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Contrato termina até
                <input type="month" value={f.contratoAte ?? ''} onChange={(e) => setFilter({ contratoAte: e.target.value || undefined })} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Liga
                <select value={f.liga ?? ''} onChange={(e) => setFilter({ liga: e.target.value || undefined })}>
                  <option value="">Todas</option>
                  {ligas.map((l) => (
                    <option key={l.nome} value={l.nome}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Ordenar por
                <select value={ordem} onChange={(e) => setOrdem(e.target.value as 'valor' | 'idade' | 'nome')}>
                  <option value="valor">Menor valor</option>
                  <option value="idade">Mais jovem</option>
                  <option value="nome">Nome</option>
                </select>
              </label>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="!w-auto" checked={!!f.soBrasil} onChange={(e) => setFilter({ soBrasil: e.target.checked || undefined })} />
                Só jogadores do Brasil
              </label>
              <span className="text-muted">
                {candidatos.length} jogador(es) encontrados
                {Object.values(f).some((v) => v) && (
                  <>
                    {' · '}
                    <button type="button" className="underline" onClick={() => setF({})}>
                      limpar filtros
                    </button>
                  </>
                )}
              </span>
            </div>
            {candidatos.length === 0 ? (
              <p className="text-sm text-muted">Nenhum jogador desta posição com esses filtros. Tire algum filtro ou escolha outra posição.</p>
            ) : (
              <ul className="max-h-[420px] divide-y divide-ink/15 overflow-y-auto border-2 border-ink/20">
                {candidatos.slice(0, 60).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <a className="font-semibold underline" href={href('jogadores', p.id)}>
                        {p.nome}
                      </a>{' '}
                      <span className="text-xs text-muted">
                        {p.clube}
                        {p.idade !== undefined ? ` · ${p.idade} anos` : ''}
                        {p.altura ? ` · ${p.altura} cm` : ''}
                        {p.valorEur ? ` · ${fmtEur(p.valorEur)}` : ''}
                        {p.contratoFim ? ` · contrato até ${fmtYm(p.contratoFim)}` : ''}
                      </span>
                    </span>
                    <Button
                      small
                      variant="accent"
                      onClick={() => {
                        track('contratar', { jogador: p.nome, clube: club.nome });
                        update({ ...squad, id: club.id, contratacoes: [...squad.contratacoes, p.id] });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Contratar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {candidatos.length > 60 && <p className="mt-2 text-xs text-muted">Mostrando 60 de {candidatos.length}. Use os filtros para reduzir.</p>}
          </Card>

          <Card title="4. Como o elenco fica">
            {resumo.length === 0 ? (
              <p className="text-sm text-muted">Sem jogadores.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Posição</th>
                      <th>Hoje</th>
                      <th>Saem</th>
                      <th>Entram</th>
                      <th>Ficam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.map((r) => (
                      <tr key={r.pos}>
                        <td>{POSITIONS[r.pos].label}</td>
                        <td className="num">{r.hoje}</td>
                        <td className="num">{r.saem}</td>
                        <td className="num">{r.entram}</td>
                        <td className="num font-bold">{r.fica}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {contratados.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-1 text-xs font-bold tracking-wide text-muted uppercase">Contratações</h3>
                <ul className="flex flex-wrap gap-2">
                  {contratados.map((p) => (
                    <li key={p.id} className="inline-flex items-center border-2 border-ink bg-card text-sm">
                      <span className="px-2 py-1">
                        {p.nome} <span className="text-xs text-muted">({POSITIONS[p.posicao].label}, {p.clube})</span>
                      </span>
                      <button type="button" aria-label={`Desfazer contratação de ${p.nome}`} onClick={() => update({ ...squad, id: club.id, contratacoes: squad.contratacoes.filter((x) => x !== p.id) })} className="cursor-pointer border-l-2 border-ink px-1.5 py-1 hover:bg-accent hover:text-on">
                        <Undo2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="5. Escalar o time">
            <Pitch clube={club.nome} lineup={lineup} players={final} onChange={(l) => update({ ...squad, id: club.id, escalacao: l })} />
          </Card>
        </div>
      )}
    </>
  );
}
