import { useMemo, useState } from 'react';
import { Button, ConfirmButton, Field, PageHeader } from '../components/ui';
import { POSITION_ORDER, POSITIONS } from '../data/positions';
import { parseNumber, todayISO } from '../lib/format';
import { sameClub } from '../lib/filters';
import { uniqueId } from '../lib/names';
import { leagueOptions } from '../lib/leagues';
import { go, href } from '../lib/router';
import { isSofascoreUrl, widgetSrc } from '../lib/sofascore';
import { useStore } from '../lib/store';
import type { Player, PositionKey } from '../types';

const NUM_FIELDS = ['idade', 'altura', 'valorEur', 'opcaoCompraEur'] as const;
type NumField = (typeof NUM_FIELDS)[number];

const blank = (): Player => ({ id: '', nome: '', posicao: 'meia-atacante', clube: '', metrics: {}, situacao: 'Contrato', atualizadoEm: todayISO() });

export default function PlayerForm({ id }: { id?: string }) {
  const { players, clubs, savePlayer, removePlayer, canEdit } = useStore();
  const ligas = useMemo(() => leagueOptions(players, clubs), [players, clubs]);
  const existing = id ? players.find((p) => p.id === id) : undefined;
  const [p, setP] = useState<Player>(() => existing ?? blank());
  const [nums, setNums] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    if (existing) NUM_FIELDS.forEach((f) => {
      if (existing[f] !== undefined) o[f] = String(existing[f]).replace('.', ',');
    });
    return o;
  });
  const [widget, setWidget] = useState(existing?.sofascoreWidget ?? '');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

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
    // Os números de estatística que já estavam salvos (se houver) são preservados, mesmo sem aparecer mais na tela.
    const out: Player = { ...p, nome: p.nome.trim(), clube: p.clube.trim() };
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
    if (out.sofascoreUrl) {
      out.sofascoreUrl = out.sofascoreUrl.trim();
      if (!isSofascoreUrl(out.sofascoreUrl)) return setErr('O link do Sofascore precisa começar com https://www.sofascore.com/');
    }
    if (widget.trim()) {
      const src = widgetSrc(widget);
      if (!src) return setErr('O widget precisa ser o código (iframe) copiado do Sofascore, com endereço https://widgets.sofascore.com/...');
      out.sofascoreWidget = src;
    } else delete out.sofascoreWidget;
    out.atualizadoEm = todayISO();
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
      <PageHeader title={existing ? `Editar ${existing.nome}` : 'Novo jogador'} sub="Só dados básicos: posição, clube, idade, altura, valor de mercado e contrato. As estatísticas completas ficam no Sofascore." />
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
          <h2 className="mb-3 text-sm font-bold">Sofascore (opcional)</h2>
          <div className="grid gap-3">
            <Field label="Link da página do jogador" hint="Abre em outra aba. Ex.: https://www.sofascore.com/pt/football/player/...">
              <input type="url" value={p.sofascoreUrl ?? ''} onChange={(e) => set('sofascoreUrl', e.target.value || undefined)} placeholder="https://www.sofascore.com/..." />
            </Field>
            <Field label="Código do widget do Sofascore (mostra dentro da ficha)" hint="Na página do jogador no Sofascore, use a opção de incorporar (embed) e cole aqui o código iframe inteiro.">
              <textarea rows={3} value={widget} onChange={(e) => setWidget(e.target.value)} placeholder='<iframe src="https://widgets.sofascore.com/..."></iframe>' />
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
