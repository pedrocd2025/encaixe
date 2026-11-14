import { METRIC_BY_KEY } from '../data/catalog';
import type { Player } from '../types';

/** Valor de uma métrica; gols/assistências por 90 são calculados dos totais. */
export function metricOf(p: Player, key: string): number | undefined {
  if (key === 'goals90') return p.minutos && p.gols !== undefined ? (p.gols * 90) / p.minutos : undefined;
  if (key === 'assists90') return p.minutos && p.assist !== undefined ? (p.assist * 90) / p.minutos : undefined;
  const v = p.metrics[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export interface RankRow {
  player: Player;
  ranks: Record<string, number>;
  score: number; // 0 a 10
  place: number;
}

export interface RankResult {
  rows: RankRow[];
  used: string[];
  ignored: { key: string; missing: number }[];
  excluded: { player: Player; reason: string }[];
  n: number;
}

export const hasMetricForAll = (players: Player[], key: string) => players.length > 0 && players.every((p) => metricOf(p, key) !== undefined);

/** Jogadores que entram no grupo de comparação (têm estatísticas e minutos suficientes). */
export function splitPool(players: Player[], minMinutes: number) {
  const pool: Player[] = [];
  const excluded: RankResult['excluded'] = [];
  for (const p of players) {
    if (Object.keys(p.metrics).length === 0) excluded.push({ player: p, reason: 'Sem estatísticas na base' });
    else if (!p.minutos || p.minutos < minMinutes) excluded.push({ player: p, reason: `Amostra pequena (${p.minutos ?? 0} min; mínimo ${minMinutes})` });
    else pool.push(p);
  }
  return { pool, excluded };
}

/**
 * Método do curso: em cada métrica, posição 1 = melhor (empates dividem a posição).
 * Pontos = (N + 1 - posição) x peso. Nota 0 a 10 = pontos / (soma dos pesos x N) x 10.
 * Só entram métricas que existem para todos os jogadores do grupo.
 */
export function rankPlayers(players: Player[], weights: Record<string, number>, minMinutes: number): RankResult {
  const { pool, excluded } = splitPool(players, minMinutes);
  const n = pool.length;
  const used: string[] = [];
  const ignored: RankResult['ignored'] = [];
  for (const [k, w] of Object.entries(weights)) {
    if (!(w > 0) || !METRIC_BY_KEY[k]) continue;
    const missing = pool.filter((p) => metricOf(p, k) === undefined).length;
    if (n > 0 && missing === 0) used.push(k);
    else ignored.push({ key: k, missing });
  }
  const weightSum = used.reduce((s, k) => s + weights[k], 0);
  const ranks = new Map<string, Record<string, number>>();
  pool.forEach((p) => ranks.set(p.id, {}));
  for (const k of used) {
    const low = METRIC_BY_KEY[k].better === 'low';
    const vals = pool.map((p) => metricOf(p, k) as number);
    pool.forEach((p, i) => {
      const better = vals.filter((v) => (low ? v < vals[i] : v > vals[i])).length;
      ranks.get(p.id)![k] = better + 1;
    });
  }
  const rows: RankRow[] = pool.map((player) => {
    const r = ranks.get(player.id)!;
    const points = used.reduce((s, k) => s + weights[k] * (n - r[k] + 1), 0);
    return { player, ranks: r, score: weightSum > 0 ? (points / (weightSum * n)) * 10 : 0, place: 0 };
  });
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => {
    r.place = i > 0 && Math.abs(rows[i - 1].score - r.score) < 1e-9 ? rows[i - 1].place : i + 1;
  });
  return { rows, used, ignored, excluded, n };
}

export function meanOf(players: Player[], key: string): number | undefined {
  const v = players.map((p) => metricOf(p, key)).filter((x): x is number => x !== undefined);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined;
}
