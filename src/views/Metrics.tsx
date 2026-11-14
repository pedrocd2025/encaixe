import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, ConfirmButton, Field, PageHeader } from '../components/ui';
import { GROUPS, METRIC_BY_KEY, POSITION_ORDER, POSITIONS } from '../data/catalog';
import { parseNumber, slug } from '../lib/format';
import { useStore } from '../lib/store';
import type { CustomMetric, PositionKey } from '../types';

type Unit = CustomMetric['unit'];
type Texts = Record<PositionKey, string>;
interface Draft {
  key: string;
  label: string;
  unit: Unit;
  better: 'high' | 'low';
  group: string;
  w: Texts;
}

const UNIT_LABEL: Record<Unit, string> = { por90: 'Por 90 minutos', pct: 'Porcentagem (%)', total: 'Valor direto (por jogo, total, km/h...)' };
const emptyTexts = (): Texts => Object.fromEntries(POSITION_ORDER.map((k) => [k, ''])) as Texts;

const toDraft = (m: CustomMetric): Draft => ({
  key: m.key,
  label: m.label,
  unit: m.unit,
  better: m.better,
  group: m.group,
  w: Object.fromEntries(POSITION_ORDER.map((k) => [k, m.weights[k] === undefined ? '' : String(m.weights[k]).replace('.', ',')])) as Texts,
});

function toMetric(d: Draft): CustomMetric | string {
  const weights: CustomMetric['weights'] = {};
  for (const k of POSITION_ORDER) {
    const t = d.w[k].trim();
    if (t === '') continue;
    const v = parseNumber(t, false);
    if (v === null || v < 0) return `${d.label}: peso inválido em ${POSITIONS[k].label} (${t}). Use um número a partir de 0.`;
    weights[k] = v;
  }
  return { key: d.key, label: d.label.trim(), unit: d.unit, better: d.better, group: d.group, weights };
}

function WeightGrid({ w, onChange }: { w: Texts; onChange: (k: PositionKey, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {POSITION_ORDER.map((k) => (
        <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {POSITIONS[k].label}
          <input inputMode="decimal" className="num" placeholder="não usa" value={w[k]} onChange={(e) => onChange(k, e.target.value)} />
        </label>
      ))}
    </div>
  );
}

export default function Metrics() {
  const { metrics, saveMetrics, role } = useStore();
  const [list, setList] = useState<Draft[]>(() => metrics.map(toDraft));
  const [nova, setNova] = useState<Draft>({ key: '', label: '', unit: 'por90', better: 'high', group: 'Passe', w: emptyTexts() });
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  const initial = useMemo(() => JSON.stringify(metrics.map(toDraft)), [metrics]);
  const dirty = JSON.stringify(list) !== initial;

  if (role !== 'owner') return <p className="text-sm">Só os donos podem criar métricas e definir pesos.</p>;

  const persist = async (next: Draft[]) => {
    setErr('');
    setSaved('');
    const out: CustomMetric[] = [];
    for (const d of next) {
      const m = toMetric(d);
      if (typeof m === 'string') {
        setErr(m);
        return false;
      }
      out.push(m);
    }
    setSaving(true);
    const ok = await saveMetrics(out);
    setSaving(false);
    if (ok) setSaved('Alterações salvas.');
    return ok;
  };

  const add = async () => {
    const label = nova.label.trim();
    if (!label) return setErr('Dê um nome para a métrica.');
    const all = [...Object.values(METRIC_BY_KEY).map((m) => m.label.toLowerCase()), ...list.map((x) => x.label.toLowerCase())];
    if (all.includes(label.toLowerCase())) return setErr('Já existe uma métrica com esse nome.');
    let key = `c_${slug(label).replace(/-/g, '_') || 'metrica'}`;
    const used = new Set([...Object.keys(METRIC_BY_KEY), ...list.map((x) => x.key)]);
    while (used.has(key)) key += '_2';
    const draft: Draft = { ...nova, label, key };
    if (typeof toMetric(draft) === 'string') return setErr(toMetric(draft) as string);
    if (await persist([...list, draft])) {
      setList((l) => [...l, draft]);
      setNova({ key: '', label: '', unit: 'por90', better: 'high', group: 'Passe', w: emptyTexts() });
    }
  };

  return (
    <>
      <PageHeader
        title="Métricas e pesos"
        sub="Crie estatísticas novas e diga o peso de cada uma em cada posição. A métrica passa a aparecer na ficha do jogador, na tabela e no ranking. O peso define a importância: 3 muito importante, 1 normal, 0,5 pouco, 0 só aparece sem entrar na nota, em branco não usa naquela posição."
      />
      {err && (
        <p role="alert" className="mb-4 border-2 border-bad px-3 py-2 text-sm font-semibold text-bad">
          {err}
        </p>
      )}
      {saved && (
        <p role="status" className="mb-4 border-2 border-good px-3 py-2 text-sm font-semibold text-good">
          {saved}
        </p>
      )}
      <div className="space-y-5">
        <Card title="Nova métrica">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nome *" className="lg:col-span-2">
              <input value={nova.label} onChange={(e) => setNova({ ...nova, label: e.target.value })} placeholder="Passes progressivos por 90" />
            </Field>
            <Field label="Como o número é medido">
              <select value={nova.unit} onChange={(e) => setNova({ ...nova, unit: e.target.value as Unit })}>
                {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Melhor quando for">
              <select value={nova.better} onChange={(e) => setNova({ ...nova, better: e.target.value as 'high' | 'low' })}>
                <option value="high">Maior</option>
                <option value="low">Menor (ex.: erros, perdas de bola)</option>
              </select>
            </Field>
            <Field label="Grupo (organiza a ficha)">
              <select value={nova.group} onChange={(e) => setNova({ ...nova, group: e.target.value })}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <h3 className="mt-4 mb-2 text-xs font-bold tracking-wide text-muted uppercase">Peso em cada posição</h3>
          <WeightGrid w={nova.w} onChange={(k, v) => setNova((n) => ({ ...n, w: { ...n.w, [k]: v } }))} />
          <div className="mt-4 flex justify-end">
            <Button variant="accent" disabled={saving} onClick={add}>
              <Plus className="h-4 w-4" /> Adicionar métrica
            </Button>
          </div>
        </Card>

        <Card
          title={`Métricas criadas por você (${list.length})`}
          actions={
            dirty && (
              <span className="flex gap-2">
                <Button small variant="ghost" onClick={() => setList(metrics.map(toDraft))}>
                  Descartar
                </Button>
                <Button small variant="accent" disabled={saving} onClick={() => persist(list)}>
                  Salvar alterações
                </Button>
              </span>
            )
          }
        >
          {list.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma ainda. As métricas que já vêm no app não aparecem aqui; os pesos delas estão no quadro abaixo.</p>
          ) : (
            <div className="space-y-5">
              {list.map((d, i) => (
                <div key={d.key} className="border-t-2 border-ink/15 pt-4 first:border-0 first:pt-0">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{d.label}</div>
                      <div className="text-xs text-muted">
                        {UNIT_LABEL[d.unit]} · melhor quando {d.better === 'high' ? 'maior' : 'menor'} · grupo {d.group}
                      </div>
                    </div>
                    <ConfirmButton
                      label="Excluir métrica"
                      confirmLabel="Confirmar exclusão"
                      onConfirm={async () => {
                        const next = list.filter((x) => x.key !== d.key);
                        if (await persist(next)) setList(next);
                      }}
                    />
                  </div>
                  <WeightGrid
                    w={d.w}
                    onChange={(k, v) => {
                      setSaved('');
                      setList((l) => l.map((x, j) => (j === i ? { ...x, w: { ...x.w, [k]: v } } : x)));
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-muted">Excluir uma métrica não apaga os números já digitados nos jogadores; eles só deixam de aparecer e de entrar na nota.</p>
        </Card>

        <Card title="Pesos em uso em cada posição">
          <div className="space-y-2">
            {POSITION_ORDER.map((k) => (
              <details key={k} className="border-2 border-ink/20 px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold">
                  {POSITIONS[k].label} ({Object.keys(POSITIONS[k].weights).length} métricas)
                </summary>
                <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                  {Object.entries(POSITIONS[k].weights).map(([mk, w]) => (
                    <li key={mk} className="flex justify-between gap-3 border-b border-ink/10 py-0.5">
                      <span>{METRIC_BY_KEY[mk]?.label ?? mk}</span>
                      <span className="num font-bold">{String(w).replace('.', ',')}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Os pesos das métricas que já vêm no app (a lista acima) ficam no código. Os da posição meia atacante são os da sua atividade; os das demais posições são sugestões.</p>
        </Card>
      </div>
    </>
  );
}
