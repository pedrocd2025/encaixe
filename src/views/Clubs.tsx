import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button, ConfirmButton, Empty, Field, PageHeader, Tag } from '../components/ui';
import { sameClub } from '../lib/filters';
import { slug, todayISO } from '../lib/format';
import { leagueOptions, missingClubs, sameLeague } from '../lib/leagues';
import { STYLES, STYLE_BY_ID } from '../lib/profile';
import { go, href } from '../lib/router';
import { useStore } from '../lib/store';
import type { Club } from '../types';

export function ClubsList() {
  const { clubs, players, canEdit, user, createMissingClubs } = useStore();
  const [liga, setLiga] = useState('');
  const [msg, setMsg] = useState('');
  const ligas = useMemo(() => leagueOptions(players, clubs), [players, clubs]);
  const faltam = useMemo(() => missingClubs(players, clubs), [players, clubs]);
  const shown = clubs.filter((c) => !liga || sameLeague(c.liga, liga));
  return (
    <>
      <PageHeader
        title="Clubes"
        sub="Cada clube guarda o estilo de jogo. A busca de jogadores usa esse estilo para ajustar o peso das métricas. Clubes marcados “Só meu” só aparecem para a sua conta."
        actions={
          user && (
            <Button variant="accent" onClick={() => go('clubes', 'novo')}>
              <Plus className="h-4 w-4" /> Novo clube
            </Button>
          )
        }
      />
      {canEdit && faltam.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-2 border-warn px-3 py-2 text-sm">
          <span>
            <strong>{faltam.length}</strong> clube(s) aparecem nos jogadores mas ainda não estão cadastrados: {faltam.slice(0, 6).map((c) => c.nome).join(', ')}
            {faltam.length > 6 ? '...' : ''}.
          </span>
          <Button
            small
            variant="accent"
            onClick={async () => {
              const n = await createMissingClubs();
              if (n) setMsg(`${n} clube(s) criado(s).`);
            }}
          >
            Criar clubes que faltam
          </Button>
        </div>
      )}
      {msg && (
        <p role="status" className="mb-4 border-2 border-good px-3 py-2 text-sm font-semibold text-good">
          {msg}
        </p>
      )}
      {ligas.length > 0 && (
        <div className="mb-4 max-w-xs">
          <select aria-label="Liga" value={liga} onChange={(e) => setLiga(e.target.value)}>
            <option value="">Todas as ligas</option>
            {ligas.map((l) => (
              <option key={l.nome} value={l.nome}>
                {l.nome} ({l.count})
              </option>
            ))}
          </select>
        </div>
      )}
      {clubs.length === 0 ? (
        <Empty title="Nenhum clube cadastrado">{canEdit ? 'Cadastre o primeiro clube e marque como ele joga.' : user ? 'Crie um clube só seu em “Novo clube” para fazer a sua pesquisa.' : 'Entre com sua conta Google para criar clubes só seus.'}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...shown]
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
            .map((c) => {
              const nPlayers = players.filter((p) => sameClub(p.clube, c.nome)).length;
              return (
                <section key={c.id} className="border-2 border-ink bg-card p-4">
                  <h2 className="text-lg font-extrabold">
                    {c.nome} {c.privado && <Tag>Só meu</Tag>}
                  </h2>
                  <p className="text-xs text-muted">
                    {c.liga ? `${c.liga} · ` : ''}
                    {nPlayers} jogador(es) na base · {c.necessidades.length} perfil(is) salvo(s)
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.estilo.length ? c.estilo.map((id) => <Tag key={id}>{STYLE_BY_ID[id]?.label ?? id}</Tag>) : <span className="text-xs text-muted">Estilo não marcado</span>}
                  </div>
                  {c.notas && <p className="mt-3 text-sm leading-relaxed text-muted">{c.notas}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="accent" small onClick={() => go('recomendar', c.id)}>
                      <Search className="h-3.5 w-3.5" /> Buscar jogadores
                    </Button>
                    {(canEdit || c.privado) && (
                      <Button variant="ghost" small onClick={() => go('clubes', c.id, 'editar')}>
                        Editar
                      </Button>
                    )}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </>
  );
}

export function ClubForm({ id }: { id?: string }) {
  const { clubs, players, saveClub, removeClub, canEdit, user } = useStore();
  const ligas = useMemo(() => leagueOptions(players, clubs), [players, clubs]);
  const existing = id ? clubs.find((c) => c.id === id) : undefined;
  const [c, setC] = useState<Club>(() => existing ?? { id: '', nome: '', estilo: [], necessidades: [], atualizadoEm: todayISO(), privado: !canEdit || undefined });
  const [err, setErr] = useState('');
  if (!user) return <p className="text-sm">Entre com sua conta Google para criar clubes só seus.</p>;
  if (existing && !existing.privado && !canEdit) return <p className="text-sm">Só editores podem alterar os clubes da base.</p>;
  if (id && !existing) {
    return (
      <p className="text-sm">
        Clube não encontrado. <a className="underline" href={href('clubes')}>Voltar</a>
      </p>
    );
  }
  const toggle = (sid: string) => setC((x) => ({ ...x, estilo: x.estilo.includes(sid) ? x.estilo.filter((s) => s !== sid) : [...x.estilo, sid] }));
  const submit = async () => {
    setErr('');
    const nome = c.nome.trim();
    if (!nome) return setErr('Informe o nome do clube.');
    const priv = !!c.privado;
    const out: Club = { ...c, nome, privado: priv || undefined, id: existing ? existing.id : (priv ? 'meu-' : '') + slug(nome) };
    if (!existing && clubs.some((x) => x.id === out.id)) return setErr('Já existe um clube com esse nome.');
    if (await saveClub(out)) go('clubes');
  };
  return (
    <>
      <PageHeader title={existing ? `Editar ${existing.nome}` : 'Novo clube'} sub="Para o app separar o elenco atual, o nome precisa ser igual ao usado no campo “Clube” dos jogadores (ex.: Fluminense). Em clubes só seus, o nome pode ser qualquer um." />
      <datalist id="lista-ligas">
        {ligas.map((l) => (
          <option key={l.nome} value={l.nome} />
        ))}
      </datalist>
      <div className="space-y-5">
        <section className="border-2 border-ink bg-card p-4">
          {canEdit && !existing && (
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="!w-auto" checked={!!c.privado} onChange={(e) => setC({ ...c, privado: e.target.checked || undefined })} />
              Clube só meu (privado, só a minha conta enxerga)
            </label>
          )}
          {c.privado && !canEdit && <p className="mb-3 text-sm text-muted">Este clube é só seu: ninguém mais enxerga. Você usa a base completa de jogadores para pesquisar.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome do clube *">
              <input value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} disabled={!!existing} />
            </Field>
            <Field label="Liga">
              <input list="lista-ligas" value={c.liga ?? ''} onChange={(e) => setC({ ...c, liga: e.target.value || undefined })} placeholder="Brasileiro Série A" />
            </Field>
          </div>
        </section>
        <section className="border-2 border-ink bg-card p-4">
          <h2 className="mb-1 text-sm font-bold">Como o clube joga</h2>
          <p className="mb-3 text-sm text-muted">Marque o que descreve o time. Cada item muda o peso das métricas na busca por jogadores.</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => {
              const on = c.estilo.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  title={s.hint}
                  onClick={() => toggle(s.id)}
                  className={`cursor-pointer border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${on ? 'border-accent bg-accent text-on' : 'border-ink bg-card hover:bg-ink hover:text-bg'}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <Field label="Notas sobre o estilo (opcional)">
              <textarea rows={4} value={c.notas ?? ''} onChange={(e) => setC({ ...c, notas: e.target.value || undefined })} />
            </Field>
          </div>
        </section>
        {err && (
          <p role="alert" className="border-2 border-bad px-3 py-2 text-sm font-semibold text-bad">
            {err}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
          <div>
            {existing && (
              <ConfirmButton
                label="Excluir clube"
                confirmLabel="Confirmar exclusão"
                small={false}
                onConfirm={async () => {
                  if (await removeClub(existing.id)) go('clubes');
                }}
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => go('clubes')}>
              Cancelar
            </Button>
            <Button variant="accent" onClick={submit}>
              Salvar clube
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
