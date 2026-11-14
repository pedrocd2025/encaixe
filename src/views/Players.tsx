import { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Plus, Table2 } from 'lucide-react';
import PlayerDetail from '../components/PlayerDetail';
import { Button, Empty, PageHeader, Tag } from '../components/ui';
import { POSITION_ORDER, POSITIONS } from '../data/catalog';
import { playersToCsv } from '../lib/exporter';
import { downloadBlob, fmtEur, normalizeText } from '../lib/format';
import { sameClub } from '../lib/filters';
import { leagueOptions, sameLeague } from '../lib/leagues';
import { track } from '../lib/analytics';
import { go, href } from '../lib/router';
import { useStore } from '../lib/store';
import type { PositionKey } from '../types';

export function PlayersList() {
  const { players, clubs, canEdit } = useStore();
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<'' | PositionKey>('');
  const [liga, setLiga] = useState('');
  const ligas = useMemo(() => leagueOptions(players, clubs), [players, clubs]);
  const rows = useMemo(() => {
    const s = normalizeText(q);
    return [...players]
      .filter((p) => (!pos || p.posicao === pos) && (!liga || sameLeague(p.liga, liga)) && (!s || normalizeText(`${p.nome} ${p.clube} ${p.liga ?? ''}`).includes(s)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [players, q, pos, liga]);

  return (
    <>
      <PageHeader
        title="Jogadores"
        sub={`${players.length} jogador(es) na base. Cada ficha guarda dados do jogador e as estatísticas da posição.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => downloadBlob(new Blob([playersToCsv(players)], { type: 'text/csv;charset=utf-8' }), 'jogadores.csv')} disabled={!players.length}>
              <Download className="h-4 w-4" /> Exportar planilha
            </Button>
            {canEdit && (
              <>
                <Button variant="ghost" onClick={() => go('tabela')}>
                  <Table2 className="h-4 w-4" /> Editar em tabela
                </Button>
                <Button variant="accent" onClick={() => go('jogadores', 'novo')}>
                  <Plus className="h-4 w-4" /> Novo jogador
                </Button>
              </>
            )}
          </>
        }
      />
      {players.length === 0 ? (
        <Empty title="A base ainda não tem jogadores">{canEdit ? 'Cadastre o primeiro jogador ou use a edição em tabela.' : 'Peça a um editor para cadastrar os jogadores.'}</Empty>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem_14rem]">
            <input type="search" aria-label="Buscar jogador" placeholder="Buscar por nome, clube ou liga" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Posição" value={pos} onChange={(e) => setPos(e.target.value as '' | PositionKey)}>
              <option value="">Todas as posições</option>
              {POSITION_ORDER.map((p) => (
                <option key={p} value={p}>
                  {POSITIONS[p].label}
                </option>
              ))}
            </select>
            <select aria-label="Liga" value={liga} onChange={(e) => setLiga(e.target.value)}>
              <option value="">Todas as ligas</option>
              {ligas.map((l) => (
                <option key={l.nome} value={l.nome}>
                  {l.nome} ({l.count})
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto border-2 border-ink bg-card">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Jogador</th>
                  <th>Posição</th>
                  <th>Idade</th>
                  <th>Altura</th>
                  <th>Minutos</th>
                  <th>Valor de mercado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a className="font-bold hover:underline" href={href('jogadores', p.id)}>
                        {p.nome}
                      </a>
                      <div className="text-xs text-muted">
                        {p.clube}
                        {p.liga ? ` · ${p.liga}` : ''}
                      </div>
                    </td>
                    <td>{POSITIONS[p.posicao].label}</td>
                    <td className="num">{p.idade ?? '–'}</td>
                    <td className="num">{p.altura ? `${p.altura} cm` : '–'}</td>
                    <td className="num">{p.minutos ?? '–'}</td>
                    <td className="num">{fmtEur(p.valorEur)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted">
                      Nenhum jogador encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export function PlayerPage({ id }: { id: string }) {
  const { players, clubs, canEdit } = useStore();
  const p = players.find((x) => x.id === id);
  const pNome = p?.nome;
  useEffect(() => {
    if (pNome) track('ver_jogador', { jogador: pNome });
  }, [pNome]);
  if (!p) {
    return (
      <p className="text-sm">
        Jogador não encontrado. <a className="underline" href={href('jogadores')}>Voltar para a lista</a>
      </p>
    );
  }
  const group = players.filter((x) => x.posicao === p.posicao);
  const club = clubs.find((c) => sameClub(p.clube, c.nome));
  const clubPlayers = club ? group.filter((x) => sameClub(x.clube, club.nome) && x.id !== p.id) : [];
  return (
    <>
      <PageHeader
        title={p.nome}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Tag>{POSITIONS[p.posicao].label}</Tag>
            <span>
              {p.clube}
              {p.liga ? ` · ${p.liga}` : ''}
            </span>
          </span>
        }
        actions={
          <>
            <a href={href('jogadores')} className="text-sm underline">
              Voltar
            </a>
            {canEdit && (
              <Button variant="accent" onClick={() => go('jogadores', p.id, 'editar')}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            )}
          </>
        }
      />
      <div className="border-2 border-ink bg-card p-4">
        <PlayerDetail player={p} group={group} clubPlayers={clubPlayers} clubName={club?.nome} />
        {(p.fonte || p.coleta) && (
          <p className="mt-4 text-xs text-muted">
            Fonte: {p.fonte ?? '–'}
            {p.coleta ? ` · coletado em ${p.coleta.split('-').reverse().join('/')}` : ''}
          </p>
        )}
      </div>
    </>
  );
}
