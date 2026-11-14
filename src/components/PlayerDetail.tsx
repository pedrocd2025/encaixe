import { useState } from 'react';
import { METRICS, POSITIONS } from '../data/catalog';
import { fmtTotal, isCountMetric, toTotal } from '../lib/units';
import { fmtEur, fmtNum, fmtYm } from '../lib/format';
import { meanOf, metricOf } from '../lib/rank';
import type { Player } from '../types';
import { Tag } from './ui';

export function Opportunity({ p }: { p: Player }) {
  if (p.situacao === 'Empréstimo')
    return (
      <span className="flex flex-wrap gap-1">
        <Tag tone="warn">Empréstimo{p.clubeOrigem ? ` de ${p.clubeOrigem}` : ''}{p.fimEmprestimo ? ` até ${fmtYm(p.fimEmprestimo)}` : ''}</Tag>
        {p.opcaoCompraEur ? <Tag>Opção de compra {fmtEur(p.opcaoCompraEur)}</Tag> : null}
      </span>
    );
  if (!p.contratoFim) return <Tag>Contrato não informado</Tag>;
  if (p.contratoFim <= '2026-12') return <Tag tone="good">Contrato termina em {fmtYm(p.contratoFim)}</Tag>;
  return <Tag>Contrato até {fmtYm(p.contratoFim)}</Tag>;
}

interface Props {
  player: Player;
  group: Player[]; // jogadores da mesma posição usados na comparação
  clubPlayers?: Player[]; // elenco atual do clube escolhido (mesma posição)
  clubName?: string;
  ranks?: Record<string, number>;
  weights?: Record<string, number>;
  n?: number;
  strengths?: string[];
  risks?: string[];
}

export default function PlayerDetail({ player: p, group, clubPlayers = [], clubName, ranks, weights, n, strengths, risks }: Props) {
  const rows = METRICS.filter((m) => metricOf(p, m.key) !== undefined);
  const [ver, setVer] = useState<'total' | 'por90'>('total');
  const canTotal = (p.minutos ?? 0) > 0;
  const asTotal = ver === 'total' && canTotal;
  const val = (q: Player, key: string, dec: number | undefined) => {
    const v = metricOf(q, key);
    if (v === undefined) return '–';
    if (asTotal && isCountMetric(key) && (q.minutos ?? 0) > 0) return fmtTotal(toTotal(v, q.minutos as number));
    return fmtNum(v, dec);
  };
  const mean = (list: Player[], key: string, dec: number | undefined) => {
    if (!asTotal || !isCountMetric(key)) return fmtNum(meanOf(list, key), dec);
    const vals = list.flatMap((q) => {
      const v = metricOf(q, key);
      return v !== undefined && (q.minutos ?? 0) > 0 ? [toTotal(v, q.minutos as number)] : [];
    });
    return vals.length ? fmtTotal(vals.reduce((a, b) => a + b, 0) / vals.length) : '–';
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Tag>{POSITIONS[p.posicao].label}</Tag>
        {p.idade !== undefined && <Tag>{p.idade} anos</Tag>}
        {p.altura && <Tag>{p.altura} cm</Tag>}
        {p.pe && <Tag>Pé {p.pe.toLowerCase()}</Tag>}
        {p.nacionalidade && <Tag>{p.nacionalidade}</Tag>}
        <Opportunity p={p} />
        <span className="num text-xs text-muted">
          {p.clube}
          {p.liga ? ` · ${p.liga}` : ''}
          {p.minutos ? ` · ${p.minutos} min` : ''}
          {p.jogos ? ` · ${p.jogos} jogos` : ''}
          {p.gols !== undefined ? ` · ${p.gols} gols` : ''}
          {p.assist !== undefined ? ` · ${p.assist} assist.` : ''}
        </span>
      </div>
      {(strengths || risks) && (
        <div className="mb-4 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-bold text-good">Por que encaixa</h3>
            {strengths && strengths.length ? (
              <ul className="list-disc pl-5 text-sm leading-relaxed">
                {strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhuma métrica de peso fica entre as melhores do grupo.</p>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-sm font-bold text-warn">O que observar</h3>
            {risks && risks.length ? (
              <ul className="list-disc pl-5 text-sm leading-relaxed">
                {risks.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhum ponto de atenção pelos critérios atuais.</p>
            )}
          </div>
        </div>
      )}
      {p.avisos && p.avisos.length > 0 && (
        <div className="mb-4 border-2 border-warn px-3 py-2 text-sm">
          <strong className="text-warn">Dado a conferir: </strong>
          {p.avisos.map((a) => a.texto).join(' ')}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Este jogador ainda não tem estatísticas cadastradas.</p>
      ) : (
        <div className="overflow-x-auto">
          {canTotal && (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs no-print">
              <span className="font-semibold">Ver estatísticas:</span>
              {([['total', 'Totais da temporada'], ['por90', 'Por 90 minutos']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={ver === k} onClick={() => setVer(k)} className={`cursor-pointer border-2 px-2 py-1 font-semibold ${ver === k ? 'border-accent bg-accent text-on' : 'border-ink bg-card'}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <table className="grid-table">
            <thead>
              <tr>
                <th>Métrica</th>
                <th>{p.nome}</th>
                {ranks && <th>Posição no grupo</th>}
                <th>Média do grupo</th>
                {clubPlayers.length > 0 && <th>Média {clubName}</th>}
                {weights && <th>Peso</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.key}>
                  <td>
                    {m.label.replace(/ por 90.*$/, '')}
                    {m.unit === 'por90' && !(asTotal && isCountMetric(m.key)) ? <span className="text-xs text-muted"> por 90</span> : null}
                  </td>
                  <td className="num font-bold">
                    {val(p, m.key, m.decimals)}
                    {m.unit === 'pct' ? '%' : ''}
                  </td>
                  {ranks && <td className="num">{ranks[m.key] ? `${ranks[m.key]}º de ${n}` : '–'}</td>}
                  <td className="num text-muted">{mean(group, m.key, m.decimals)}</td>
                  {clubPlayers.length > 0 && <td className="num text-muted">{mean(clubPlayers, m.key, m.decimals)}</td>}
                  {weights && <td className="num">{weights[m.key] ?? 0}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
