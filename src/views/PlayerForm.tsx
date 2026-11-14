import { useMemo, useState } from 'react';
import { Button, ConfirmButton, Field, PageHeader } from '../components/ui';
import PasteSofascore from '../components/PasteSofascore';
import { METRICS, POSITION_ORDER, POSITIONS, type Group } from '../data/catalog';
import { parseNumber, slug, todayISO } from '../lib/format';
import { sameClub } from '../lib/filters';
import { uniqueId } from '../lib/names';
import { leagueOptions } from '../lib/leagues';
import { go, href } from '../lib/router';
import { fmtTotal, fromTotal, isCountMetric, toTotal } from '../lib/units';
import { useStore } from '../lib/store';
import type { Player, PositionKey } from '../types';

const NUM_FIELDS = ['idade', 'altura', 'valorEur', 'opcaoCompraEur', 'jogos', 'titular', 'minutos', 'gols', 'assist', 'amarelos', 'vermelhos'] as const;
type NumField = (typeof NUM_FIELDS)[number];

const blank = (): Player => ({ id: '', nome: '', posicao: 'meia-atacante', clube: '', metrics: {}, situacao: 'Contrato', atualizadoEm: todayISO() });

const GROUP_ORDER: Group[] = ['Criação', 'Finalização', 'Passe', 'Condução', 'Defesa', 'Duelos', 'Goleiro', 'Disciplina'];

export default function PlayerForm({ id }: { id?: string }) {
  const { players, clubs, savePlayer, removePlayer, canEdit } = useStore();
  const ligas = useMemo(() => leagueOptions(players, clubs), [players, clubs]);
  const existing = id ? players.find((p) => p.id === id) : undefined;
  const [p, setP] = useState<Player>(() => existing ?? blank());
  const [nums, setNums] = useState<Record<string, string>>(() => {
    const e = existing;
    const o: Record<string, string> = {};
    if (e) {
      NUM_FIELDS.forEach((f) => {
        if (e[f] !== undefined) o[f] = String(e[f]).replace('.', ',');
      });
      Object.entries(e.metrics).forEach(([k, v]) => {
        const mins = e.minutos ?? 0;
        o[`m:${k}`] = isCountMetric(k) && mins > 0 ? fmtTotal(toTotal(v, mins)) : String(v).replace('.', ',');
      });
    }
    return o;
  });
  const [showAll, setShowAll] = useState(false);
  const modo = 'total' as 'total' | 'por90';
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const relevant = useMemo(() => {
    const base = new Set(Object.keys(POSITIONS[p.posicao].weights));
    return METRICS.filter((m) => !m.derived && (showAll || base.has(m.key) || nums[`m:${m.key}`] !== undefined));
  }, [p.posicao, showAll, nums]);
  const groups = GROUP_ORDER.map((g) => [g, relevant.filter((m) => m.group === g)] as const).filter(([, l]) => l.length > 0);

  if (!canEdit) return <p className="text-sm">Só editores podem alterar a base.</p>;
  if (id && !existing) {
    return (
      <p className="text-sm">
        Jogador não encontrado. <a className="underline" href={href('jogadores')}>Voltar</a>
      </p>
    );
  }

  const set = <K extends keyof Player>(k: K, v: Player[K]) => setP((x) => ({ ...x, [k]: v }));
  const setNum = (k: string, v: string) => setNums((n) => ({ ...n, [k]: v }));
  const numInput = (k: NumField, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input inputMode="decimal" className="num" value={nums[k] ?? ''} onChange={(e) => setNum(k, e.target.value)} />
    </Field>
  );

  const submit = async () => {
    setErr('');
    if (!p.nome.trim()) return setErr('Informe o nome do jogador.');
    if (!p.clube.trim()) return setErr('Informe o clube atual.');
    const out: Player = { ...p, nome: p.nome.trim(), clube: p.clube.trim(), metrics: {} };
    for (const f of NUM_FIELDS) {
      const raw = nums[f];
      if (raw === undefined || raw.trim() === '') {
        delete out[f];
        continue;
      }
      const v = parseNumber(raw, true);
      if (v === null) return setErr(`Número inválido em "${f}".`);
      out[f] = v;
    }
    for (const [k, raw] of Object.entries(nums)) {
      if (!k.startsWith('m:') || raw.trim() === '') continue;
      const v = parseNumber(raw, false);
      if (v === null) return setErr(`Número inválido em "${METRICS.find((m) => m.key === k.slice(2))?.label ?? k}".`);
      const mk = k.slice(2);
      if (modo === 'total' && isCountMetric(mk)) {
        if (!out.minutos || out.minutos <= 0) return setErr(`Informe os minutos jogados: o total de "${METRICS.find((m) => m.key === mk)?.label ?? mk}" precisa deles para virar por 90.`);
        out.metrics[mk] = fromTotal(v, out.minutos);
      } else out.metrics[mk] = v;
    }
    if (!existing) {
      out.id = uniqueId(out.nome, out.clube, new Set(players.map((x) => x.id)));
    }
    setSaving(true);
    const ok = await savePlayer(out);
    setSaving(false);
    if (ok) go('jogadores', out.id);
  };

  return (
    <>
      <PageHeader title={existing ? `Editar ${existing.nome}` : 'Novo jogador'} sub="Os números de estatística devem estar por 90 minutos ou em %, como nas planilhas." />
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
      <div className="space-y-5">
        <section className="border-2 border-ink bg-card p-4">
          <h2 className="mb-3 text-sm font-bold">Dados do jogador</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nome *" className="lg:col-span-2">
              <input value={p.nome} onChange={(e) => set('nome', e.target.value)} />
            </Field>
            <Field label="Posição *">
              <select value={p.posicao} onChange={(e) => set('posicao', e.target.value as PositionKey)}>
                {POSITION_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {POSITIONS[k].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pé dominante">
              <select value={p.pe ?? ''} onChange={(e) => set('pe', e.target.value || undefined)}>
                <option value="">Não informado</option>
                <option value="Direito">Direito</option>
                <option value="Esquerdo">Esquerdo</option>
                <option value="Ambidestro">Ambidestro</option>
              </select>
            </Field>
            {numInput('idade', 'Idade')}
            {numInput('altura', 'Altura (cm)')}
            <Field label="Nacionalidade">
              <input value={p.nacionalidade ?? ''} onChange={(e) => set('nacionalidade', e.target.value || undefined)} />
            </Field>
            <Field label="Clube atual (onde joga) *">
              <input
                list="lista-clubes"
                value={p.clube}
                onChange={(e) => {
                  const v = e.target.value;
                  const lg = clubs.find((c) => c.liga && sameClub(v, c.nome))?.liga;
                  setP((x) => ({ ...x, clube: v, liga: x.liga || lg || undefined }));
                }}
              />
            </Field>
            <Field label="Liga ou competição">
              <input list="lista-ligas" value={p.liga ?? ''} onChange={(e) => set('liga', e.target.value || undefined)} />
            </Field>
            <Field label="Temporada">
              <input value={p.temporada ?? ''} onChange={(e) => set('temporada', e.target.value || undefined)} placeholder="2026 ou 25/26" />
            </Field>
            {numInput('valorEur', 'Valor de mercado (€)', 'Ex.: 5000000')}
            <Field label="Fim do contrato">
              <input type="month" value={p.contratoFim ?? ''} onChange={(e) => set('contratoFim', e.target.value || undefined)} />
            </Field>
            <Field label="Situação">
              <select value={p.situacao ?? 'Contrato'} onChange={(e) => set('situacao', e.target.value)}>
                <option value="Contrato">Contrato</option>
                <option value="Empréstimo">Empréstimo</option>
              </select>
            </Field>
            {p.situacao === 'Empréstimo' && (
              <>
                <Field label="Emprestado por (clube dono do contrato)">
                  <input list="lista-clubes" value={p.clubeOrigem ?? ''} onChange={(e) => set('clubeOrigem', e.target.value || undefined)} placeholder="Palmeiras" />
                </Field>
                <Field label="Fim do empréstimo">
                  <input type="month" value={p.fimEmprestimo ?? ''} onChange={(e) => set('fimEmprestimo', e.target.value || undefined)} />
                </Field>
                {numInput('opcaoCompraEur', 'Opção de compra (€)')}
              </>
            )}
          </div>
        </section>

        <section className="border-2 border-ink bg-card p-4">
          <h2 className="mb-3 text-sm font-bold">Volume da temporada</h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {numInput('jogos', 'Partidas jogadas')}
            {numInput('titular', 'Iniciou (titular)')}
            {numInput('minutos', 'Minutos jogados')}
            {numInput('gols', 'Gols')}
            {numInput('assist', 'Assistências')}
            {numInput('amarelos', 'Amarelos')}
            {numInput('vermelhos', 'Vermelhos')}
          </div>
        </section>

        <PasteSofascore jogosAtual={nums.jogos ?? ''} pesos={POSITIONS[p.posicao].weights as Record<string, number>} onApply={(f) => setNums((n) => ({ ...n, ...f }))} />

        <section className="border-2 border-ink bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">Estatísticas de {POSITIONS[p.posicao].label.toLowerCase()}</h2>
            <span className="text-xs text-muted">Digite os totais da temporada, como no Sofascore.</span>
            <Button small variant="ghost" onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Mostrar só as da posição' : 'Mostrar todas as métricas'}
            </Button>
          </div>
          <div className="space-y-4">
            {groups.map(([g, list]) => (
              <div key={g}>
                <h3 className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">{g}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {list.map((m) => (
                    <Field key={m.key} label={m.label + (modo === 'por90' && isCountMetric(m.key) ? ' (por 90)' : '')}>
                      <input inputMode="decimal" className="num" value={nums[`m:${m.key}`] ?? ''} onChange={(e) => setNum(`m:${m.key}`, e.target.value)} placeholder={m.unit === 'pct' ? '%' : ''} />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {nums['m:topSpeed'] === undefined && !showAll && <p className="mt-3 text-xs text-muted">A velocidade máxima (km/h) fica em “Mostrar todas as métricas”. Ela alimenta a característica “Velocidade” da busca.</p>}
        </section>

        <section className="border-2 border-ink bg-card p-4">
          <h2 className="mb-3 text-sm font-bold">Fonte</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fonte dos números">
              <input value={p.fonte ?? ''} onChange={(e) => set('fonte', e.target.value || undefined)} placeholder="Sofascore, FotMob, Transfermarkt..." />
            </Field>
            <Field label="Data da coleta">
              <input type="date" value={p.coleta ?? ''} onChange={(e) => set('coleta', e.target.value || undefined)} />
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
                label="Excluir jogador"
                confirmLabel="Confirmar exclusão"
                small={false}
                onConfirm={async () => {
                  if (await removePlayer(existing.id)) go('jogadores');
                }}
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => go('jogadores', ...(existing ? [existing.id] : []))}>
              Cancelar
            </Button>
            <Button variant="accent" disabled={saving} onClick={submit}>
              {saving ? 'Salvando...' : 'Salvar jogador'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
