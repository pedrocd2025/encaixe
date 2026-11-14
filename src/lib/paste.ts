import { METRICS } from '../data/catalog';
import { normalizeText } from './format';

export interface PasteItem {
  label: string;
  raw: string;
  /** chave do campo no formulário ("minutos", "m:xg90"...) ou null se o app ignorou a linha */
  target: string | null;
  targetLabel?: string;
  value?: string;
  note: string;
}

type Basis = 'total' | 'jogo' | 'direto';
interface Rule {
  target: string;
  basis: Basis;
  label: string;
}

const norm = (s: string) => normalizeText(s).replace(/\s+/g, ' ').trim();

const FIELD_RULES: Record<string, Rule> = {
  jogos: { target: 'jogos', basis: 'direto', label: 'Partidas jogadas' },
  partidas: { target: 'jogos', basis: 'direto', label: 'Partidas jogadas' },
  titular: { target: 'titular', basis: 'direto', label: 'Iniciou (titular)' },
  iniciou: { target: 'titular', basis: 'direto', label: 'Iniciou (titular)' },
  'total de minutos jogados': { target: 'minutos', basis: 'direto', label: 'Minutos jogados' },
  'minutos jogados': { target: 'minutos', basis: 'direto', label: 'Minutos jogados' },
  gols: { target: 'gols', basis: 'direto', label: 'Gols' },
  assistencias: { target: 'assist', basis: 'direto', label: 'Assistências' },
  'cartoes amarelos': { target: 'amarelos', basis: 'direto', label: 'Amarelos' },
  'cartoes vermelhos': { target: 'vermelhos', basis: 'direto', label: 'Vermelhos' },
};

// Linhas que o Sofascore mostra POR JOGO (sem a palavra "por jogo" no nome) ou com nome diferente do catálogo.
const METRIC_EXTRA: Record<string, Rule> = {
  finalizacoes: { target: 'm:shots90', basis: 'jogo', label: 'Total de chutes' },
  'chutes certos por jogo': { target: 'm:sot90', basis: 'jogo', label: 'Chutes ao gol' },
};

function metricRules(): Record<string, Rule> {
  const out: Record<string, Rule> = {};
  for (const m of METRICS) {
    if (m.derived) continue;
    const basis: Basis = m.unit === 'por90' ? 'total' : 'direto';
    out[norm(m.label)] = { target: `m:${m.key}`, basis, label: m.label };
  }
  return out;
}

const VALUE = String.raw`-?\d+(?:[.,]\d+)?(?:\/\d+)?\s*(?:km\/h|km|min|%)?`;
const PURE = new RegExp(`^(${VALUE})$`, 'i');
const INLINE = new RegExp(`^(.+?)\\s*(${VALUE})$`, 'i');

const num = (raw: string): number | null => {
  const m = raw.match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
};
const fmt = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');

/** Lê o texto copiado da página do jogador no Sofascore. Não acessa site nenhum: só interpreta o que foi colado. */
export function parseSofascore(text: string, jogosAtual?: number, pesos?: Record<string, number>): PasteItem[] {
  const pairs: { label: string; raw: string }[] = [];
  let pending = '';
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    if (PURE.test(line)) {
      if (pending) pairs.push({ label: pending, raw: line });
      pending = '';
      continue;
    }
    const m = line.match(INLINE);
    if (m) {
      pairs.push({ label: m[1].trim(), raw: m[2].trim() });
      pending = '';
    } else pending = line; // título de bloco ou nome cujo valor vem na linha seguinte
  }

  const metrics = metricRules();
  let jogos = jogosAtual && jogosAtual > 0 ? jogosAtual : undefined;
  for (const p of pairs) if (norm(p.label) === 'jogos' || norm(p.label) === 'partidas') jogos = num(p.raw) ?? jogos;

  return pairs.map((p): PasteItem => {
    const k = norm(p.label.replace(/\s*\(por 90\)\s*$/i, ''));
    const rule = FIELD_RULES[k] ?? METRIC_EXTRA[k] ?? metrics[k];
    if (!rule) return { label: p.label, raw: p.raw, target: null, note: 'não usado pelo app' };
    if (pesos && rule.target.startsWith('m:') && !((pesos[rule.target.slice(2)] ?? 0) > 0)) return { label: p.label, raw: p.raw, target: null, note: 'sem peso nesta posição' };
    const v = num(p.raw);
    if (v === null) return { label: p.label, raw: p.raw, target: null, note: 'valor ilegível' };
    if (rule.basis === 'jogo') {
      if (!jogos) return { label: p.label, raw: p.raw, target: null, note: 'é por jogo e faltam as partidas jogadas' };
      return { label: p.label, raw: p.raw, target: rule.target, targetLabel: rule.label, value: fmt(v * jogos), note: `por jogo × ${jogos} partidas = total` };
    }
    return {
      label: p.label,
      raw: p.raw,
      target: rule.target,
      targetLabel: rule.label,
      value: fmt(v),
      note: rule.basis === 'total' ? 'total da temporada' : '',
    };
  });
}
