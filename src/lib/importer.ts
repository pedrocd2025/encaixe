import { METRIC_BY_KEY } from '../data/catalog';
import type { Player, PositionKey } from '../types';
import { normalizeText, parseNumber, parseYm, slug, todayISO } from './format';
import { matchMetric, matchTotal, type TotalCol } from './match';

/** Entende o texto de uma posição ("Meia ofensivo (central)", "Ala direito", "Atacante"...). */
export function guessPosition(text: string): PositionKey | null {
  const n = normalizeText(text);
  if (!n) return null;
  if (/goleiro|goalkeeper/.test(n)) return 'goleiro';
  if (/zagueiro|centre back|center back|central defender/.test(n)) return 'zagueiro';
  if (/lateral|\bala\b|wing back|wingback|full back|fullback/.test(n)) return 'lateral';
  if (/volante|defensive mid|pivo/.test(n)) return 'volante';
  if (/meia atacante|meia ofensivo|armador|camisa 10|segundo atacante|attacking mid|trequartista/.test(n)) return 'meia-atacante';
  if (/ponta de lanca|centroavante|striker|center forward|centre forward/.test(n)) return 'centroavante';
  if (/meia|meio campo|meio campista|midfielder|central mid/.test(n)) return 'meia';
  if (/extremo|ponta|winger/.test(n)) return 'extremo';
  if (/atacante|forward/.test(n)) return 'centroavante';
  return null;
}

type Field =
  | 'nome' | 'posicao' | 'idade' | 'altura' | 'nacionalidade' | 'pe' | 'clube' | 'liga' | 'temporada'
  | 'valorEur' | 'contratoFim' | 'situacao' | 'fimEmprestimo' | 'opcaoCompraEur' | 'fonte' | 'coleta';

const FIELD_COLS: Record<string, Field> = {
  nome: 'nome', jogador: 'nome', atleta: 'nome', name: 'nome', player: 'nome',
  posicao: 'posicao', position: 'posicao', pos: 'posicao',
  idade: 'idade', age: 'idade',
  altura: 'altura', 'altura cm': 'altura', height: 'altura',
  nacionalidade: 'nacionalidade', nationality: 'nacionalidade',
  'pe dominante': 'pe', pe: 'pe', foot: 'pe',
  clube: 'clube', 'clube onde joga': 'clube', 'clube atual': 'clube', time: 'clube', equipe: 'clube', club: 'clube', team: 'clube',
  liga: 'liga', competicao: 'liga', competition: 'liga', campeonato: 'liga', league: 'liga',
  temporada: 'temporada', season: 'temporada',
  'valor de mercado': 'valorEur', 'valor de mercado eur': 'valorEur', 'market value': 'valorEur',
  'fim de contrato': 'contratoFim', 'fim de contrato clube dono': 'contratoFim', 'contrato ate': 'contratoFim', 'contract end': 'contratoFim',
  situacao: 'situacao',
  'fim do emprestimo': 'fimEmprestimo',
  'opcao de compra': 'opcaoCompraEur',
  fonte: 'fonte', source: 'fonte',
  'data da coleta': 'coleta', 'data de coleta': 'coleta', coleta: 'coleta',
};
const KNOWN_IGNORED = new Set(['clube de origem dono do contrato', 'clube de origem', 'convocacao', 'foto link', 'foto', 'valor de mercado r']);

const FIELD_LABEL: Record<Field, string> = {
  nome: 'Nome', posicao: 'Posição', idade: 'Idade', altura: 'Altura', nacionalidade: 'Nacionalidade', pe: 'Pé dominante', clube: 'Clube', liga: 'Liga',
  temporada: 'Temporada', valorEur: 'Valor de mercado', contratoFim: 'Fim de contrato', situacao: 'Situação', fimEmprestimo: 'Fim do empréstimo',
  opcaoCompraEur: 'Opção de compra', fonte: 'Fonte', coleta: 'Data da coleta',
};

type Target = { type: 'field'; key: Field } | { type: 'total'; key: TotalCol['key'] } | { type: 'metric'; key: string };

export interface ImportOptions {
  defaultPosition: PositionKey;
  fonte: string;
  temporada: string;
}

export interface ImportResult {
  players: Player[]; // novos e alterados
  mapped: string[];
  ignored: string[];
  warnings: string[];
  newCount: number;
  updatedCount: number;
  skipped: number;
}

const cellText = (v: unknown): string => (v === undefined || v === null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

function normalizeFoot(s: string): string | undefined {
  const n = normalizeText(s);
  if (/direito|destro|right/.test(n)) return 'Direito';
  if (/esquerdo|canhoto|left/.test(n)) return 'Esquerdo';
  if (/ambi|both/.test(n)) return 'Ambidestro';
  return undefined;
}

function toIsoDate(v: unknown): string | undefined {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const t = cellText(v);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

/**
 * Transforma uma planilha (linhas já lidas de CSV ou XLSX) em jogadores.
 * Valores de métricas devem estar "por 90 minutos" ou em %, como na planilha do curso.
 * Jogadores já existentes (mesmo nome) são atualizados; as demais informações são mantidas.
 */
export function buildImport(rows: unknown[][], existing: Player[], opt: ImportOptions): ImportResult {
  const out: ImportResult = { players: [], mapped: [], ignored: [], warnings: [], newCount: 0, updatedCount: 0, skipped: 0 };
  const hi = rows.findIndex((r) => r.filter((c) => cellText(c) !== '').length >= 3);
  if (hi < 0 || rows.length - hi < 2) {
    out.warnings.push('O arquivo precisa ter uma linha de cabeçalho e pelo menos uma linha de dados.');
    return out;
  }
  const header = rows[hi].map(cellText);
  const body = rows.slice(hi + 1).filter((r) => r.some((c) => cellText(c) !== ''));

  const targets: (Target | null)[] = [];
  const seen = new Set<string>();
  header.forEach((label) => {
    if (!label) {
      targets.push(null);
      return;
    }
    const n = normalizeText(label);
    let t: Target | null = null;
    if (FIELD_COLS[n]) t = { type: 'field', key: FIELD_COLS[n] };
    else if (matchTotal(label)) t = { type: 'total', key: matchTotal(label)! };
    else if (!KNOWN_IGNORED.has(n)) {
      const k = matchMetric(label);
      if (k) t = { type: 'metric', key: k };
    }
    if (t && seen.has(`${t.type}:${t.key}`)) {
      out.ignored.push(`${label} (coluna repetida)`);
      t = null;
    } else if (t) {
      seen.add(`${t.type}:${t.key}`);
      const friendly = t.type === 'metric' ? METRIC_BY_KEY[t.key].label : t.type === 'field' ? FIELD_LABEL[t.key] : label;
      out.mapped.push(`${label} → ${friendly}`);
    } else out.ignored.push(label);
    targets.push(t);
  });

  const nameCol = targets.findIndex((t) => t?.type === 'field' && t.key === 'nome');
  if (nameCol < 0) {
    out.warnings.push('Não encontrei a coluna "Nome" (ou "Jogador"). Ela é obrigatória.');
    return out;
  }

  // Colunas de % vindas do Excel como fração (0,87): converte para 87.
  const scale = new Map<number, number>();
  targets.forEach((t, c) => {
    if (t?.type !== 'metric' || METRIC_BY_KEY[t.key].unit !== 'pct') return;
    const vals = body.map((r) => parseNumber(r[c] as string | number, false)).filter((v): v is number => v !== null);
    if (vals.length && Math.max(...vals) <= 1) {
      scale.set(c, 100);
      out.warnings.push(`A coluna "${header[c]}" estava em fração (até 1); multipliquei por 100 para virar %.`);
    }
  });

  const byName = new Map(existing.map((p) => [slug(p.nome), p]));
  const batch = new Map<string, Player>();
  let posGuess = 0;
  let posFallback = 0;
  for (const r of body) {
    const nome = cellText(r[nameCol]);
    if (!nome) {
      out.skipped++;
      continue;
    }
    const key = slug(nome);
    const prev = batch.get(key) ?? byName.get(key);
    const p: Player = prev
      ? { ...prev, metrics: { ...prev.metrics } }
      : { id: key || `j-${Math.random().toString(36).slice(2, 8)}`, nome, posicao: opt.defaultPosition, clube: '', metrics: {}, atualizadoEm: todayISO() };
    let sawPos = false;
    targets.forEach((t, c) => {
      if (!t) return;
      const raw = r[c];
      const txt = cellText(raw);
      if (txt === '' || txt === '-') return;
      if (t.type === 'metric') {
        const v = parseNumber(raw as string | number, false);
        if (v === null) {
          out.warnings.push(`${nome}: valor inválido em "${header[c]}" (${txt}); ignorei.`);
          return;
        }
        p.metrics[t.key] = v * (scale.get(c) ?? 1);
      } else if (t.type === 'total') {
        const v = parseNumber(raw as string | number, true);
        if (v !== null) p[t.key] = Math.round(v);
      } else {
        switch (t.key) {
          case 'nome': p.nome = nome; break;
          case 'posicao': {
            const g = guessPosition(txt);
            sawPos = true;
            if (g) {
              p.posicao = g;
              posGuess++;
            } else {
              p.posicao = opt.defaultPosition;
              posFallback++;
            }
            break;
          }
          case 'idade': { const v = parseNumber(raw as string | number, true); if (v !== null) p.idade = Math.round(v); break; }
          case 'altura': { const v = parseNumber(raw as string | number, true); if (v !== null) p.altura = Math.round(v < 3 ? v * 100 : v); break; }
          case 'valorEur': { const v = parseNumber(raw as string | number, true); if (v !== null) p.valorEur = v; break; }
          case 'opcaoCompraEur': { const v = parseNumber(raw as string | number, true); if (v !== null) p.opcaoCompraEur = v; break; }
          case 'contratoFim': { const v = parseYm(raw); if (v) p.contratoFim = v; else out.warnings.push(`${nome}: data de contrato não reconhecida (${txt}).`); break; }
          case 'fimEmprestimo': { const v = parseYm(raw); if (v) p.fimEmprestimo = v; break; }
          case 'pe': { const v = normalizeFoot(txt); if (v) p.pe = v; break; }
          case 'situacao': p.situacao = /emprest/i.test(normalizeText(txt)) ? 'Empréstimo' : 'Contrato'; break;
          case 'coleta': { const v = toIsoDate(raw); if (v) p.coleta = v; break; }
          default: (p as unknown as Record<string, unknown>)[t.key] = txt;
        }
      }
    });
    if (!sawPos && !prev) p.posicao = opt.defaultPosition;
    if (!p.fonte && opt.fonte) p.fonte = opt.fonte;
    if (!p.temporada && opt.temporada) p.temporada = opt.temporada;
    p.atualizadoEm = todayISO();
    batch.set(key, p);
  }
  for (const [key, p] of batch) {
    out.players.push(p);
    if (byName.has(key)) out.updatedCount++;
    else out.newCount++;
  }
  if (posFallback) out.warnings.push(`${posFallback} jogador(es) com posição não reconhecida; usei "${opt.defaultPosition}".`);
  if (posGuess === 0 && !targets.some((t) => t?.type === 'field' && t.key === 'posicao')) out.warnings.push(`Sem coluna de posição: todos entraram como "${opt.defaultPosition}".`);
  if (!out.players.length) out.warnings.push('Nenhum jogador encontrado nas linhas de dados.');
  return out;
}
