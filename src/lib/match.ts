import { METRICS } from '../data/catalog';
import { normalizeText } from './format';

export interface TotalCol {
  key: 'jogos' | 'titular' | 'minutos' | 'gols' | 'assist' | 'amarelos' | 'vermelhos';
  aliases: string[];
}

export const TOTAL_COLS: TotalCol[] = [
  { key: 'jogos', aliases: ['jogos', 'partidas', 'appearances', 'matches played', 'matches', 'games'] },
  { key: 'titular', aliases: ['titularidades', 'titular', 'jogos como titular', 'partidas como titular', 'starts', 'started'] },
  { key: 'minutos', aliases: ['minutos', 'minutos jogados', 'minutes', 'minutes played'] },
  { key: 'gols', aliases: ['gols', 'goals'] },
  { key: 'assist', aliases: ['assistencias', 'assists'] },
  { key: 'amarelos', aliases: ['cartoes amarelos', 'amarelos', 'yellow cards', 'yellow card'] },
  { key: 'vermelhos', aliases: ['cartoes vermelhos', 'vermelhos', 'red cards', 'red card'] },
];

let aliasMap: Map<string, string> | null = null;
function getAliasMap(): Map<string, string> {
  if (aliasMap) return aliasMap;
  const map = new Map<string, string>();
  for (const mt of METRICS) {
    if (mt.derived) continue;
    for (const a of mt.aliases) {
      const n = normalizeText(a);
      if (!map.has(n)) map.set(n, mt.key);
    }
  }
  aliasMap = map;
  return map;
}

const STRIP = /\b(?:per|por) 90(?: min(?:utes|utos)?)?\b|\bp90\b|\b(?:per|por) (?:game|match|jogo|partida)\b/g;

/** Descobre a métrica de um título de coluna ("Chances criadas por 90" → keyPasses90). */
export function matchMetric(label: string): string | null {
  const map = getAliasMap();
  const n = normalizeText(label).replace(STRIP, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return null;
  const exact = map.get(n);
  if (exact) return exact;
  let best: string | null = null;
  let bestLen = 0;
  for (const [alias, key] of map) {
    if (alias.length < 4 || alias.length <= bestLen) continue;
    if (n.startsWith(alias + ' ') || n.endsWith(' ' + alias)) {
      best = key;
      bestLen = alias.length;
    }
  }
  return best;
}

export function matchTotal(label: string): TotalCol['key'] | null {
  const n = normalizeText(label);
  for (const t of TOTAL_COLS) if (t.aliases.some((a) => normalizeText(a) === n)) return t.key;
  return null;
}
