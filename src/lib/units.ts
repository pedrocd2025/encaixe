import { METRIC_BY_KEY } from '../data/catalog';

/** Métricas de contagem (Passes decisivos, Desarmes...) são guardadas por 90 minutos; o Sofascore mostra o total da temporada. */
export const isCountMetric = (key: string): boolean => {
  const m = METRIC_BY_KEY[key];
  return !!m && m.unit === 'por90' && !m.derived;
};

export const toTotal = (per90: number, minutes: number): number => (per90 * minutes) / 90;
export const fromTotal = (total: number, minutes: number): number => Math.round(((total * 90) / minutes) * 10000) / 10000;
/** Total como o Sofascore mostra: inteiro quando for inteiro, até 2 casas quando não for (xG, xA). */
export const fmtTotal = (v: number): string => String(Math.round(v * 100) / 100).replace('.', ',');

/** Troca os minutos de um jogador mantendo os TOTAIS que aparecem na tela: reescala os valores por 90. */
export function rescaleForMinutes(metrics: Record<string, number>, oldMin: number, newMin: number): Record<string, number> {
  if (!(oldMin > 0) || !(newMin > 0)) return metrics;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(metrics)) out[k] = isCountMetric(k) ? Math.round(((v * oldMin) / newMin) * 10000) / 10000 : v;
  return out;
}
