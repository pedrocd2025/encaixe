import { METRIC_BY_KEY } from '../data/catalog';
import type { Player } from '../types';
import { fmtNum, fmtYm } from './format';
import { isBrazilian } from './filters';
import { metricOf, type RankResult, type RankRow } from './rank';

const short = (k: string) => {
  const l = METRIC_BY_KEY[k].label.replace(/ por 90.*$/, '').replace(/ \(.*\)$/, '');
  return /^x[AG]\b/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1);
};

const metricText = (key: string, p: Player) => {
  const m = METRIC_BY_KEY[key];
  const v = metricOf(p, key);
  return `${fmtNum(v, m.decimals)}${m.unit === 'pct' ? '%' : ''}`;
};

export function reasonsFor(row: RankRow, result: RankResult, weights: Record<string, number>) {
  const n = result.n;
  const third = Math.max(1, Math.ceil(n * 0.3));
  const line = (k: string) => `${row.ranks[k]}º de ${n} em ${short(k)} (${metricText(k, row.player)})`;
  const strengths = result.used
    .filter((k) => row.ranks[k] <= third)
    .sort((a, b) => weights[b] - weights[a] || row.ranks[a] - row.ranks[b])
    .slice(0, 3)
    .map(line);
  const risks = result.used
    .filter((k) => weights[k] >= 1 && row.ranks[k] > n - third)
    .sort((a, b) => weights[b] - weights[a] || row.ranks[b] - row.ranks[a])
    .slice(0, 2)
    .map(line);
  const p = row.player;
  if ((p.idade ?? 0) >= 33) risks.push(`Tem ${p.idade} anos: horizonte de carreira curto`);
  if (p.liga && !isBrazilian(p.liga)) risks.push(`Joga fora do Brasil (${p.liga}): adaptação ao futebol brasileiro`);
  if (p.situacao === 'Empréstimo') risks.push(`Está emprestado${p.clubeOrigem ? ` pelo ${p.clubeOrigem}` : ''}${p.fimEmprestimo ? ` até ${fmtYm(p.fimEmprestimo)}` : ''}; o clube dono define a negociação`);
  return { strengths, risks };
}
