import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { Button, Empty, PageHeader, Tag } from '../components/ui';
import { METRIC_BY_KEY, POSITION_ORDER, POSITIONS } from '../data/catalog';
import { playersToCsv } from '../lib/exporter';
import { downloadBlob, normalizeText, parseNumber, slug, todayISO } from '../lib/format';
import { sameClub } from '../lib/filters';
import { leagueOptions, sameLeague } from '../lib/leagues';
import { similarNames, uniqueId } from '../lib/names';
import { fmtTotal, fromTotal, isCountMetric, rescaleForMinutes, toTotal } from '../lib/units';
import { go } from '../lib/router';
import { useStore } from '../lib/store';
import type { Player, PositionKey } from '../types';

const STALE_DAYS = 90;

type Kind = 'text' | 'num' | 'month' | 'pe' | 'situacao';
interface Col {
  id: string; // campo do jogador ou "m:chave" para métrica
  label: string;
  kind: Kind;
  width: number;
}

const BASE_COLS: Col[] = [
  { id: 'clube', label: 'Clube', kind: 'text', width: 170 },
  { id: 'liga', label: 'Liga', kind: 'text', width: 160 },
  { id: 'idade', label: 'Idade', kind: 'num', width: 64 },
  { id: 'altura', label: 'Altura (cm)', kind: 'num', width: 78 },
  { id: 'pe', label: 'Pé', kind: 'pe', width: 104 },
  { id: 'valorEur', label: 'Valor de mercado (€)', kind: 'num', width: 130 },
  { id: 'contratoFim', label: 'Fim de contrato', kind: 'month', width: 170 },
  { id: 'situacao', label: 'Situação', kind: 'situacao', width: 112 },
  { id: 'clubeOrigem', label: 'Emprestado por (clube dono)', kind: 'text', width: 170 },
  { id: 'fimEmprestimo', label: 'Fim do empréstimo', kind: 'month', width: 170 },
  { id: 'minutos', label: 'Minutos jogados', kind: 'num', width: 84 },
  { id: 'jogos', label: 'Partidas jogadas', kind: 'num', width: 84 },
  { id: 'titular', label: 'Iniciou', kind: 'num', width: 64 },
  { id: 'gols', label: 'Gols', kind: 'num', width: 60 },
  { id: 'assist', label: 'Assistências', kind: 'num', width: 84 },
];
const INT_FIELDS = new Set(['idade', 'altura', 'valorEur', 'minutos', 'jogos', 'titular', 'gols', 'assist']);

type Modo = 'total' | 'por90';

const toText = (v: unknown): string => (v === undefined || v === null ? '' : String(v).replace('.', ','));

function original(p: Player, id: string, modo: Modo): string {
  if (id === 'nome') return p.nome;
  if (id.startsWith('m:')) {
    const k = id.slice(2);
    const v = p.metrics[k];
    if (v === undefined) return '';
    if (modo === 'total' && isCountMetric(k) && (p.minutos ?? 0) > 0) return fmtTotal(toTotal(v, p.minutos as number));
    return toText(v);
  }
  const v = (p as unknown as Record<string, unknown>)[id];
  return INT_FIELDS.has(id) ? toText(v) : v === undefined || v === null ? '' : String(v);
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
}

/** Aplica as células alteradas a um jogador. Devolve o jogador ou a mensagem de erro. */
function applyCells(base: Player, cells: Record<string, string>, colLabel: (id: string) => string, modo: Modo): { player: Player } | { error: string } {
  const p: Player = { ...base, metrics: { ...base.metrics } };
  const rec = p as unknown as Record<string, unknown>;
  // Minutos que valem para a conversão: os digitados agora ou os já salvos.
  const minCell = cells.minutos !== undefined ? parseNumber(cells.minutos, true) : (base.minutos ?? null);
  const minutes = minCell ?? 0;
  // Nos totais do Sofascore, mudar os minutos não pode alterar os totais que continuam na tela.
  if (modo === 'total' && cells.minutos !== undefined && (base.minutos ?? 0) > 0 && minutes > 0) {
    const keep = Object.fromEntries(Object.entries(p.metrics).filter(([k]) => cells[`m:${k}`] === undefined));
    p.metrics = { ...p.metrics, ...rescaleForMinutes(keep, base.minutos as number, minutes) };
  }
  for (const [id, raw] of Object.entries(cells)) {
    const txt = raw.trim();
    if (id === 'nome') {
      p.nome = txt;
    } else if (id === 'clube') {
      p.clube = txt;
    } else if (id.startsWith('m:')) {
      if (txt === '') delete p.metrics[id.slice(2)];
      else {
        const v = parseNumber(txt, false);
        if (v === null) return { error: `${base.nome || 'Nova linha'}: número inválido em "${colLabel(id)}" (${txt}).` };
        const k = id.slice(2);
        if (modo === 'total' && isCountMetric(k)) {
          if (!(minutes > 0)) return { error: `${base.nome || 'Nova linha'}: informe os minutos jogados antes de digitar totais de "${colLabel(id)}".` };
          p.metrics[k] = fromTotal(v, minutes);
        } else p.metrics[k] = v;
      }
    } else if (INT_FIELDS.has(id)) {
      if (txt === '') delete rec[id];
      else {
        const v = parseNumber(txt, true);
        if (v === null) return { error: `${base.nome || 'Nova linha'}: número inválido em "${colLabel(id)}" (${txt}).` };
        rec[id] = id === 'valorEur' ? v : Math.round(v);
      }
    } else if (txt === '') delete rec[id];
    else rec[id] = txt;
  }
  return { player: p };
}

interface NewRow {
  tid: string;
  cells: Record<string, string>;
}

export default function Table() {
  const { players, clubs, savePlayers, canEdit } = useStore();
  const defaultPos = useMemo<PositionKey>(() => {
    const counts = POSITION_ORDER.map((k) => [k, players.filter((x) => x.posicao === k).length] as const).sort((a, b) => b[1] - a[1]);
    return counts[0] && counts[0][1] > 0 ? counts[0][0] : 'meia-atacante';
  }, [players]);
  const [pos, setPos] = useState<PositionKey>(defaultPos);
  const [q, setQ] = useState('');
  const [onlyStale, setOnlyStale] = useState(false);
  const modo = 'total' as Modo;
  const [liga, setLiga] = useState('');
  const ligas = useMemo(() => leagueOptions(players, clubs), [players, clubs]);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [news, setNews] = useState<NewRow[]>([]);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const metricCols: Col[] = useMemo(() => {
    const keys = Object.keys(POSITIONS[pos].weights).filter((k) => METRIC_BY_KEY[k] && !METRIC_BY_KEY[k].derived);
    if (pos !== 'goleiro' && !keys.includes('topSpeed')) keys.push('topSpeed');
    return keys.map((k) => ({ id: `m:${k}`, label: METRIC_BY_KEY[k].label + (modo === 'por90' && isCountMetric(k) ? ' (por 90)' : ''), kind: 'num' as Kind, width: 104 }));
  }, [pos, modo]);
  const cols: Col[] = useMemo(() => [...BASE_COLS, ...metricCols], [metricCols]);
  const colLabel = (id: string) => (id === 'nome' ? 'Nome' : (cols.find((c) => c.id === id)?.label ?? id));

  const rows = useMemo(() => {
    const s = normalizeText(q);
    return players
      .filter((p) => p.posicao === pos)
      .filter((p) => !liga || sameLeague(p.liga, liga))
      .filter((p) => !s || normalizeText(`${p.nome} ${p.clube}`).includes(s))
      .filter((p) => {
        if (!onlyStale) return true;
        const d = daysSince(p.atualizadoEm);
        return d === null || d > STALE_DAYS;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [players, pos, q, onlyStale, liga]);

  const filledNews = news.filter((n) => Object.values(n.cells).some((v) => v.trim() !== ''));
  const dirtyIds = Object.keys(edits).filter((id) => Object.keys(edits[id]).length > 0);
  const dirty = dirtyIds.length + filledNews.length;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!canEdit) return <p className="text-sm">Só editores podem alterar a base.</p>;

  const ligaOfClub = (name: string): string | undefined => clubs.find((c) => c.liga && sameClub(name, c.nome))?.liga;
  const setCell = (key: string, col: string, value: string, isNew: boolean, orig = '') => {
    setSaved('');
    if (col === 'clube') {
      const lg = ligaOfClub(value);
      if (lg) {
        const has = isNew ? (news.find((n) => n.tid === key)?.cells.liga ?? '') : (edits[key]?.liga ?? players.find((p) => p.id === key)?.liga ?? '');
        if (!has.trim()) setCell(key, 'liga', lg, isNew, isNew ? '' : (players.find((p) => p.id === key)?.liga ?? ''));
      }
    }
    if (isNew) {
      setNews((arr) => arr.map((n) => (n.tid === key ? { ...n, cells: { ...n.cells, [col]: value } } : n)));
      return;
    }
    setEdits((e) => {
      const cur = { ...(e[key] ?? {}) };
      if (value === orig) delete cur[col];
      else cur[col] = value;
      return { ...e, [key]: cur };
    });
  };

  const addRow = () => {
    setNews((arr) => [{ tid: `n${Date.now()}${arr.length}`, cells: {} }, ...arr]);
    setTimeout(() => wrap.current?.querySelector<HTMLInputElement>('[data-new="1"][data-c="nome"]')?.focus(), 30);
  };

  const onKey = (e: React.KeyboardEvent<HTMLElement>, r: number, c: string) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = wrap.current?.querySelector<HTMLElement>(`[data-r="${r + 1}"][data-c="${c}"]`);
    next?.focus();
  };

  const discard = () => {
    setEdits({});
    setNews([]);
    setErr('');
    setSaved('');
  };

  const save = async () => {
    setErr('');
    setSaved('');
    const out: Player[] = [];
    const usedIds = new Set(players.map((p) => p.id));
    for (const id of dirtyIds) {
      const base = players.find((p) => p.id === id);
      if (!base) continue;
      const r = applyCells(base, edits[id], colLabel, modo);
      if ('error' in r) return setErr(r.error);
      if (!r.player.nome) return setErr('Um jogador ficou sem nome.');
      if (!r.player.clube) return setErr(`${r.player.nome}: informe o clube.`);
      out.push({ ...r.player, coleta: todayISO() });
    }
    for (const n of filledNews) {
      const blank: Player = { id: '', nome: '', posicao: pos, clube: '', metrics: {}, situacao: 'Contrato', atualizadoEm: todayISO(), coleta: todayISO() };
      const r = applyCells(blank, n.cells, colLabel, modo);
      if ('error' in r) return setErr(r.error);
      const p = r.player;
      if (!p.nome) return setErr('Há uma linha nova sem nome.');
      if (!p.clube) return setErr(`${p.nome}: informe o clube.`);
      const nid = uniqueId(p.nome, p.clube, usedIds);
      usedIds.add(nid);
      p.id = nid;
      out.push(p);
    }
    if (!out.length) return;
    setSaving(true);
    const ok = await savePlayers(out);
    setSaving(false);
    if (ok) {
      setEdits({});
      setNews([]);
      setSaved(`${out.length} jogador(es) salvo(s).`);
    }
  };

  const similarFor = (nome: string, clube: string): Player | undefined => {
    if (nome.trim().length < 3) return undefined;
    // nomes iguais em clubes diferentes são jogadores diferentes: só avisa se o clube também bate
    return players.find((p) => similarNames(nome, p.nome) && (!clube.trim() || sameClub(p.clube, clube)));
  };
  const similarWarnings = filledNews
    .map((n) => ({ n, hit: similarFor(n.cells.nome ?? '', n.cells.clube ?? '') }))
    .filter((x): x is { n: NewRow; hit: Player } => !!x.hit);

  const input = (kind: Kind, value: string, changed: boolean, onChange: (v: string) => void, r: number, c: string, isNew: boolean, label: string) => {
    const cls = `!w-full !rounded-none !border-0 !py-1.5 !px-1.5 text-xs ${kind === 'num' ? 'num text-right' : ''} ${changed ? '!bg-accent/15' : '!bg-transparent'}`;
    const common = { 'data-r': r, 'data-c': c, 'data-new': isNew ? '1' : '0', 'aria-label': label, onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => onKey(e, r, c) } as const;
    if (kind === 'pe')
      return (
        <select {...common} className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">–</option>
          <option>Direito</option>
          <option>Esquerdo</option>
          <option>Ambidestro</option>
        </select>
      );
    if (kind === 'situacao')
      return (
        <select {...common} className={cls} value={value || 'Contrato'} onChange={(e) => onChange(e.target.value)}>
          <option>Contrato</option>
          <option>Empréstimo</option>
        </select>
      );
    if (kind === 'month') return <input {...common} type="month" className={cls} value={value} onChange={(e) => onChange(e.target.value)} />;
    const listId = c === 'clube' || c === 'clubeOrigem' ? 'lista-clubes' : c === 'liga' ? 'lista-ligas' : undefined;
    return <input {...common} list={listId} inputMode={kind === 'num' ? 'decimal' : 'text'} className={cls} value={value} onChange={(e) => onChange(e.target.value)} />;
  };

  const stickyName = 'sticky left-0 z-10 bg-card';
  let rowIdx = 0;

  return (
    <>
      <PageHeader
        title="Editar em tabela"
        sub="Cadastre e altere vários jogadores de uma vez, direto aqui. Mude as células, adicione linhas novas e salve tudo no fim. As estatísticas devem estar por 90 minutos ou em %."
        actions={
          <Button variant="ghost" disabled={!players.length} onClick={() => downloadBlob(new Blob([playersToCsv(players)], { type: 'text/csv;charset=utf-8' }), 'jogadores.csv')}>
            <Download className="h-4 w-4" /> Exportar planilha
          </Button>
        }
      />
      <datalist id="lista-clubes">
        {clubs.map((c) => (
          <option key={c.id} value={c.nome} />
        ))}
      </datalist>
      <datalist id="lista-ligas">
        {ligas.map((l) => (
          <option key={l.nome} value={l.nome} />
        ))}
      </datalist>
      <div className="mb-3 grid gap-3 sm:grid-cols-[14rem_14rem_1fr_auto_auto]">
        <select aria-label="Posição" value={pos} onChange={(e) => setPos(e.target.value as PositionKey)}>
          {POSITION_ORDER.map((k) => (
            <option key={k} value={k}>
              {POSITIONS[k].label} ({players.filter((p) => p.posicao === k).length})
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
        <input type="search" aria-label="Buscar jogador" placeholder="Buscar por nome ou clube" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="!w-auto" checked={onlyStale} onChange={(e) => setOnlyStale(e.target.checked)} />
          Só desatualizados
        </label>
        <Button variant="accent" onClick={addRow}>
          <Plus className="h-4 w-4" /> Adicionar jogador
        </Button>
      </div>

      {similarWarnings.length > 0 && (
        <ul className="mb-3 list-disc border-2 border-warn px-3 py-2 pl-7 text-sm text-warn">
          {similarWarnings.map(({ n, hit }) => (
            <li key={n.tid}>
              “{n.cells.nome}” parece com <strong>{hit.nome}</strong> ({hit.clube}), que já está na base. Se for a mesma pessoa, altere a linha dele em vez de cadastrar de novo.
            </li>
          ))}
        </ul>
      )}
      {err && (
        <p role="alert" className="mb-3 border-2 border-bad px-3 py-2 text-sm font-semibold text-bad">
          {err}
        </p>
      )}
      {saved && (
        <p role="status" className="mb-3 border-2 border-good px-3 py-2 text-sm font-semibold text-good">
          {saved}
        </p>
      )}
      <p className="mb-3 text-sm text-muted">Digite os totais da temporada, como no Sofascore (o app converte para por 90 usando os minutos jogados).</p>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-2 border-ink bg-card px-3 py-2 text-sm">
        <span className={dirty ? 'font-semibold' : 'text-muted'}>{dirty ? `${dirty} jogador(es) com alterações não salvas` : 'Nenhuma alteração pendente'}</span>
        <span className="flex gap-2">
          <Button small variant="ghost" disabled={!dirty || saving} onClick={discard}>
            Descartar
          </Button>
          <Button small variant="accent" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </span>
      </div>

      {rows.length === 0 && news.length === 0 ? (
        <Empty title={`Nenhum jogador de ${POSITIONS[pos].label.toLowerCase()}${q || onlyStale ? ' com esse filtro' : ' na base'}`}>Use “Adicionar jogador” para cadastrar o primeiro.</Empty>
      ) : (
        <div ref={wrap} className="max-h-[68vh] overflow-auto border-2 border-ink bg-card">
          <table className="grid-table min-w-max" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className={`${stickyName} top-0 z-20`} style={{ width: 190 }}>
                  Jogador
                </th>
                {cols.map((c) => (
                  <th key={c.id} className="sticky top-0 z-10 bg-card !whitespace-normal align-bottom" style={{ width: c.width }}>
                    {c.label}
                  </th>
                ))}
                <th className="sticky top-0 z-10 bg-card" style={{ width: 150 }}>
                  Atualizado
                </th>
              </tr>
            </thead>
            <tbody>
              {news.map((n) => {
                const r = rowIdx++;
                return (
                  <tr key={n.tid} className="bg-accent/5">
                    <td className={`${stickyName} !p-0`}>
                      {input('text', n.cells.nome ?? '', !!n.cells.nome, (v) => setCell(n.tid, 'nome', v, true), r, 'nome', true, 'Nome do novo jogador')}
                    </td>
                    {cols.map((c) => (
                      <td key={c.id} className="!p-0">
                        {input(c.kind, n.cells[c.id] ?? '', !!n.cells[c.id], (v) => setCell(n.tid, c.id, v, true), r, c.id, true, `${c.label} (novo)`)}
                      </td>
                    ))}
                    <td className="text-xs">
                      <Tag tone="accent">Novo</Tag>{' '}
                      <button type="button" className="underline" onClick={() => setNews((a) => a.filter((x) => x.tid !== n.tid))}>
                        remover
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.map((p) => {
                const r = rowIdx++;
                const e = edits[p.id] ?? {};
                const days = daysSince(p.atualizadoEm);
                const stale = days === null || days > STALE_DAYS;
                const val = (id: string) => e[id] ?? original(p, id, modo);
                return (
                  <tr key={p.id}>
                    <td className={`${stickyName} !p-0`}>
                      {input('text', val('nome'), 'nome' in e, (v) => setCell(p.id, 'nome', v, false, original(p, 'nome', modo)), r, 'nome', false, `Nome de ${p.nome}`)}
                    </td>
                    {cols.map((c) =>
                      <td key={c.id} className="!p-0">
                        {input(c.kind, val(c.id), c.id in e, (v) => setCell(p.id, c.id, v, false, original(p, c.id, modo)), r, c.id, false, `${c.label} de ${p.nome}`)}
                      </td>,
                    )}
                    <td className="text-xs">
                      {p.atualizadoEm ? p.atualizadoEm.split('-').reverse().join('/') : '–'}{' '}
                      {stale && <Tag tone="warn">desatualizado</Tag>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Células alteradas ficam destacadas. Enter desce para a linha de baixo. “Desatualizado” significa sem alteração há mais de {STALE_DAYS} dias. Para excluir um jogador ou ver os avisos de dado, abra a ficha dele em{' '}
        <button type="button" className="underline" onClick={() => go('jogadores')}>
          Jogadores
        </button>
        .
      </p>
    </>
  );
}
