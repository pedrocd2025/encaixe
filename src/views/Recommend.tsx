import { useMemo, useState } from 'react';
import { Printer, RotateCcw, Save, X } from 'lucide-react';
import PlayerDetail, { Opportunity } from '../components/PlayerDetail';
import Scatter from '../components/Scatter';
import { Button, Card, Empty, PageHeader, Tag } from '../components/ui';
import { METRIC_BY_KEY, POSITION_ORDER, POSITIONS } from '../data/catalog';
import { passesFilters, sameClub } from '../lib/filters';
import { leagueOptions } from '../lib/leagues';
import { fmtEur, fmtNum, uid } from '../lib/format';
import { buildWeights, describeProfile, STYLES, traitsFor } from '../lib/profile';
import { hasMetricForAll, rankPlayers, splitPool } from '../lib/rank';
import { reasonsFor } from '../lib/reasons';
import { go, href } from '../lib/router';
import { track } from '../lib/analytics';
import { useStore } from '../lib/store';
import type { Filters, Need, PositionKey } from '../types';

const ALTURA_OPTS = [170, 175, 180, 185, 190];
const IDADE_OPTS = [23, 25, 28, 30, 33];
const VALOR_OPTS: [string, number][] = [['Até €1 mi', 1e6], ['Até €3 mi', 3e6], ['Até €5 mi', 5e6], ['Até €10 mi', 1e7], ['Até €15 mi', 1.5e7], ['Até €30 mi', 3e7]];
const CONTRATO_OPTS: [string, string][] = [['Termina até dez/26', '2026-12'], ['Termina até dez/27', '2027-12'], ['Termina até dez/28', '2028-12'], ['Termina até dez/29', '2029-12']];

function Sel({ label, value, onChange, children }: { label: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

const shortLabel = (k: string) => METRIC_BY_KEY[k].label.replace(/ por 90.*$/, '').replace(/ \(.*\)$/, '');

export default function Recommend({ clubId }: { clubId?: string }) {
  const { players, clubs, canEdit, saveClub } = useStore();
  const club = clubs.find((c) => c.id === clubId) ?? null;
  const defaultPos = useMemo<PositionKey>(() => {
    const counts = POSITION_ORDER.map((p) => [p, players.filter((x) => x.posicao === p).length] as const).sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 0 ? counts[0][0] : 'meia-atacante';
  }, [players]);
  const [posicao, setPosicao] = useState<PositionKey>(defaultPos);
  const [estilo, setEstilo] = useState<string[]>(club?.estilo ?? []);
  const [tracos, setTracos] = useState<Record<string, 1 | 2>>({});
  const [filtros, setFiltros] = useState<Filters>({});
  const ligas = useMemo(() => leagueOptions(players, clubs), [players, clubs]);
  const [minMin, setMinMin] = useState(900);
  const [selected, setSelected] = useState<string | null>(null);
  const [needName, setNeedName] = useState('');

  const setF = (patch: Partial<Filters>) => setFiltros((f) => ({ ...f, ...patch }));
  const cycle = (id: string) =>
    setTracos((t) => {
      const next = { ...t };
      const cur = next[id];
      if (!cur) next[id] = 1;
      else if (cur === 1) next[id] = 2;
      else delete next[id];
      return next;
    });
  const reset = () => {
    setTracos({});
    setFiltros({});
    setEstilo(club?.estilo ?? []);
  };
  const applyNeed = (n: Need) => {
    setPosicao(n.posicao);
    setTracos(n.tracos);
    setFiltros(n.filtros);
    setSelected(null);
  };

  const inPosition = useMemo(() => players.filter((p) => p.posicao === posicao), [players, posicao]);
  const clubPlayers = useMemo(() => (club ? inPosition.filter((p) => sameClub(p.clube, club.nome)) : []), [inPosition, club]);
  const candidates = useMemo(() => (club ? inPosition.filter((p) => !sameClub(p.clube, club.nome)) : inPosition), [inPosition, club]);

  const { weights, notices } = useMemo(() => {
    const { pool } = splitPool(candidates, minMin);
    return buildWeights({ posicao, estilo, tracos }, (k) => hasMetricForAll(pool, k));
  }, [candidates, minMin, posicao, estilo, tracos]);
  const result = useMemo(() => rankPlayers(candidates, weights, minMin), [candidates, weights, minMin]);
  const visible = useMemo(() => new Set(result.rows.filter((r) => passesFilters(r.player, filtros)).map((r) => r.player.id)), [result, filtros]);
  const shown = result.rows.filter((r) => visible.has(r.player.id));
  const selRow = result.rows.find((r) => r.player.id === selected);
  const reasons = selRow ? reasonsFor(selRow, result, weights) : null;
  const topWeights = result.used
    .map((k) => [k, weights[k]] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const summary = describeProfile({ posicao, estilo, tracos }, filtros, club?.nome ?? 'Sem clube');
  const hidden = result.rows.length - shown.length;
  const nFilters = Object.values(filtros).filter((v) => v !== undefined && v !== '' && v !== false).length;

  const saveNeed = async () => {
    if (!club || !needName.trim()) return;
    const need: Need = { id: uid('n'), nome: needName.trim(), posicao, tracos, filtros };
    if (await saveClub({ ...club, necessidades: [...club.necessidades, need] })) setNeedName('');
  };
  const removeNeed = (id: string) => club && saveClub({ ...club, necessidades: club.necessidades.filter((n) => n.id !== id) });

  return (
    <>
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-black">
          Jogadores recomendados{club ? ` para o ${club.nome}` : ''}: {POSITIONS[posicao].label}
        </h1>
        <p className="text-xs">Encaixe · {new Date().toLocaleDateString('pt-BR')}</p>
      </div>
      <div className="no-print">
      <PageHeader
        title="Qual jogador combina com o clube?"
        sub="Escolha o clube e a posição, marque o que você procura e o sistema monta o perfil e ordena os jogadores da base."
        actions={
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir ou salvar PDF (só a lista)
          </Button>
        }
      />
      </div>
      <div className="space-y-5">
        <Card className="no-print" title="1. Clube e posição">
          <div className="grid gap-3 sm:grid-cols-2">
            <Sel label="Clube" value={clubId ?? ''} onChange={(v) => {
              if (v) track('selecionar_clube', { clube: clubs.find((c) => c.id === v)?.nome ?? v });
              go('recomendar', ...(v ? [v] : []));
            }}>
              <option value="">Sem clube (todos os jogadores)</option>
              {[...clubs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Sel>
            <Sel
              label="Posição que precisa reforçar"
              value={posicao}
              onChange={(v) => {
                setPosicao(v as PositionKey);
                track('buscar_posicao', { posicao: v });
                setTracos({});
                setSelected(null);
              }}
            >
              {POSITION_ORDER.map((p) => (
                <option key={p} value={p}>
                  {POSITIONS[p].label}
                </option>
              ))}
            </Sel>
          </div>
          {club && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-bold text-muted">Como o {club.nome} joga (marque para ajustar)</p>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => {
                  const on = estilo.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      title={s.hint}
                      onClick={() => setEstilo(on ? estilo.filter((x) => x !== s.id) : [...estilo, s.id])}
                      className={`cursor-pointer border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${on ? 'border-accent bg-accent text-on' : 'border-ink bg-card hover:bg-ink hover:text-bg'}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {club.notas && <p className="mt-2 text-xs text-muted">{club.notas}</p>}
              {club.necessidades.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-bold text-muted">Perfis salvos deste clube</p>
                  <div className="flex flex-wrap gap-2">
                    {club.necessidades.map((n) => (
                      <span key={n.id} className="inline-flex items-center border-2 border-ink bg-card">
                        <button type="button" onClick={() => applyNeed(n)} className="cursor-pointer px-2.5 py-1 text-xs font-semibold hover:bg-ink hover:text-bg">
                          {n.nome}
                        </button>
                        {(canEdit || club.privado) && (
                          <button type="button" aria-label={`Remover perfil ${n.nome}`} onClick={() => removeNeed(n.id)} className="cursor-pointer border-l-2 border-ink px-1.5 py-1 hover:bg-accent hover:text-on">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card
          className="no-print"
          title="2. O que você procura"
          actions={
            <Button small variant="ghost" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" /> Limpar
            </Button>
          }
        >
          <p className="mb-3 text-sm text-muted">
            Toque uma vez para marcar como <strong>desejável</strong> e duas vezes para <strong>essencial</strong> (peso dobrado). Toque de novo para desmarcar.
          </p>
          <div className="flex flex-wrap gap-2">
            {traitsFor(posicao).map((t) => {
              const lv = tracos[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.hint}
                  aria-pressed={!!lv}
                  onClick={() => cycle(t.id)}
                  className={`cursor-pointer border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${lv === 2 ? 'border-accent bg-accent text-on' : lv === 1 ? 'border-accent bg-card text-accent' : 'border-ink bg-card hover:bg-ink hover:text-bg'}`}
                >
                  {t.label}
                  {lv ? <span className="ml-1.5 text-xs">{lv === 2 ? '· essencial' : '· desejável'}</span> : null}
                </button>
              );
            })}
          </div>
          {notices.map((n) => (
            <p key={n} className="mt-3 text-xs text-warn">
              {n}
            </p>
          ))}
        </Card>

        <Card className="no-print" title={`3. Filtros${nFilters ? ` (${nFilters} ativo${nFilters > 1 ? 's' : ''})` : ''}`}>
          <p className="mb-3 text-sm text-muted">Os filtros só escondem jogadores. A nota continua a mesma, calculada com todo o grupo da posição.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Sel label="Altura mínima" value={filtros.alturaMin ?? ''} onChange={(v) => setF({ alturaMin: v ? Number(v) : undefined })}>
              <option value="">Qualquer</option>
              {ALTURA_OPTS.map((a) => (
                <option key={a} value={a}>
                  {a} cm ou mais
                </option>
              ))}
            </Sel>
            <Sel label="Pé dominante" value={filtros.pe ?? ''} onChange={(v) => setF({ pe: v || undefined })}>
              <option value="">Qualquer</option>
              <option value="Direito">Direito</option>
              <option value="Esquerdo">Esquerdo</option>
            </Sel>
            <Sel label="Idade" value={filtros.idadeMax ?? ''} onChange={(v) => setF({ idadeMax: v ? Number(v) : undefined })}>
              <option value="">Qualquer</option>
              {IDADE_OPTS.map((a) => (
                <option key={a} value={a}>
                  Até {a} anos
                </option>
              ))}
            </Sel>
            <Sel label="Valor de mercado" value={filtros.valorMax ?? ''} onChange={(v) => setF({ valorMax: v ? Number(v) : undefined })}>
              <option value="">Sem limite</option>
              {VALOR_OPTS.map(([l, v]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Sel>
            <Sel label="Fim do contrato" value={filtros.contratoAte ?? ''} onChange={(v) => setF({ contratoAte: v || undefined })}>
              <option value="">Qualquer data</option>
              {CONTRATO_OPTS.map(([l, v]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Sel>
            <Sel label="Situação" value={filtros.situacao ?? ''} onChange={(v) => setF({ situacao: v || undefined })}>
              <option value="">Todas</option>
              <option value="Contrato">Contrato</option>
              <option value="Empréstimo">Empréstimo</option>
            </Sel>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              Minutos mínimos (amostra)
              <input type="number" min={0} step={100} className="num" value={minMin} onChange={(e) => setMinMin(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <Sel label="Liga" value={filtros.liga ?? ''} onChange={(v) => setF({ liga: v || undefined })}>
              <option value="">Todas as ligas</option>
              {ligas.map((l) => (
                <option key={l.nome} value={l.nome}>
                  {l.nome} ({l.count})
                </option>
              ))}
            </Sel>
            <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
              <input type="checkbox" checked={!!filtros.soBrasil} onChange={(e) => setF({ soBrasil: e.target.checked })} /> Já joga no Brasil
            </label>
          </div>
        </Card>

        {inPosition.length === 0 ? (
          <Empty title={`Nenhum jogador de ${POSITIONS[posicao].label.toLowerCase()} na base`}>
            {canEdit ? 'Cadastre jogadores na edição em tabela para começar.' : 'A base ainda não tem jogadores nesta posição.'}
          </Empty>
        ) : (
          <Card
            className="print-flow"
            title={`4. Jogadores recomendados (${shown.length} de ${result.rows.length})`}
            actions={
              club && (canEdit || club.privado) ? (
                <>
                  <input aria-label="Nome do perfil" placeholder="Nome do perfil para salvar" value={needName} onChange={(e) => setNeedName(e.target.value)} className="!w-52 !py-1 text-xs" />
                  <Button small variant="ghost" disabled={!needName.trim()} onClick={saveNeed}>
                    <Save className="h-3.5 w-3.5" /> Salvar perfil no clube
                  </Button>
                </>
              ) : undefined
            }
          >
            <div className="mb-4 border-2 border-ink/40 bg-sub px-3 py-2 text-sm">
              <strong>Perfil gerado.</strong> {summary}
              {topWeights.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {topWeights.map(([k, w]) => (
                    <Tag key={k}>
                      {shortLabel(k)} · peso {fmtNum(w, w % 1 ? 1 : 0)}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
            {result.n === 0 ? (
              <p className="text-sm text-muted">Nenhum jogador desta posição tem estatísticas e minutos suficientes. Diminua os minutos mínimos ou cadastre os números.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jogador</th>
                      <th>Idade</th>
                      <th>Altura</th>
                      <th>Nota de encaixe</th>
                      <th>Valor de mercado</th>
                      <th>Contrato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.player.id} className={selected === r.player.id ? 'bg-sub' : ''}>
                        <td className="num font-bold">{r.place}</td>
                        <td>
                          <button type="button" onClick={() => setSelected(r.player.id)} className="cursor-pointer text-left font-bold underline-offset-2 hover:underline" aria-label={`Ver detalhes de ${r.player.nome}`}>
                            {r.player.nome}
                          </button>
                          <div className="text-xs text-muted">
                            {r.player.clube}
                            {r.player.liga ? ` · ${r.player.liga}` : ''}
                          </div>
                          {r.player.avisos && r.player.avisos.length > 0 && <Tag tone="warn">Dado a conferir</Tag>}
                        </td>
                        <td className="num">{r.player.idade ?? '–'}</td>
                        <td className="num">{r.player.altura ? `${r.player.altura} cm` : '–'}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="num w-10 font-bold">{fmtNum(r.score, 2)}</span>
                            <span className="hidden h-2 w-24 bg-sub sm:block" aria-hidden>
                              <span className="block h-full bg-accent" style={{ width: `${r.score * 10}%` }} />
                            </span>
                          </div>
                        </td>
                        <td className="num">{fmtEur(r.player.valorEur)}</td>
                        <td>
                          <Opportunity p={r.player} />
                        </td>
                      </tr>
                    ))}
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-muted">
                          Nenhum jogador passa nos filtros. Afrouxe um deles.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">
              A nota de 0 a 10 compara os {result.n} jogadores deste grupo entre si: não é uma nota absoluta. {hidden > 0 ? `${hidden} escondido(s) pelos filtros. ` : ''}Toque no nome para ver os motivos.
            </p>
            {result.ignored.length > 0 && <p className="mt-2 text-xs text-warn">Métricas ignoradas por faltar em algum jogador do grupo: {result.ignored.map((i) => shortLabel(i.key)).join(', ')}.</p>}
            {result.excluded.length > 0 && (
              <details className="mt-2 text-xs text-muted">
                <summary className="cursor-pointer font-semibold">Fora do ranking ({result.excluded.length})</summary>
                <ul className="mt-1 list-disc pl-5">
                  {result.excluded.map((e) => (
                    <li key={e.player.id}>
                      {e.player.nome}: {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        )}

        {selRow && reasons && (
          <Card
            className="no-print"
            title={`${selRow.player.nome}: por que encaixa e o que observar`}
            actions={
              <Button small variant="ghost" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            }
          >
            <PlayerDetail
              player={selRow.player}
              group={result.rows.map((r) => r.player)}
              clubPlayers={clubPlayers}
              clubName={club?.nome}
              ranks={selRow.ranks}
              weights={weights}
              n={result.n}
              strengths={reasons.strengths}
              risks={reasons.risks}
            />
            <p className="mt-3 text-xs">
              <a className="underline" href={href('jogadores', selRow.player.id)}>
                Abrir a ficha completa
              </a>
            </p>
          </Card>
        )}

        {result.n > 0 && (
          <Card className="no-print" title="5. Nota de encaixe contra valor de mercado">
            <p className="mb-2 text-sm text-muted">Quem está no alto e à esquerda entrega mais por menos. Jogadores escondidos pelos filtros ficam apagados.</p>
            <Scatter
              dots={result.rows.filter((r) => r.player.valorEur).map((r) => ({ id: r.player.id, label: r.player.nome.split(' ').slice(-1)[0], value: r.player.valorEur!, score: r.score }))}
              visible={visible}
              selected={selected}
              onSelect={setSelected}
            />
          </Card>
        )}

        <p className="no-print pb-6 text-xs leading-relaxed text-muted">
          O valor de mercado não é o salário nem o preço de negociação, e a viabilidade de uma contratação depende de fatores que este app não conhece. A nota só compara os jogadores cadastrados na posição e muda se a base mudar.
        </p>
      </div>
    </>
  );
}
