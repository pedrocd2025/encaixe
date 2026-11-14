import { METRIC_BY_KEY, POSITIONS } from '../data/catalog';
import type { Filters, PositionKey } from '../types';

export interface StyleMarker {
  id: string;
  label: string;
  hint: string;
  add: Record<string, number>;
}

/** Como o clube joga. Cada marcador soma peso às métricas que o representam em campo. */
export const STYLES: StyleMarker[] = [
  { id: 'posse', label: 'Posse e controle do jogo', hint: 'Mais toques e passes, poucas perdas', add: { touches90: 1, passes90: 1, possLost90: 0.5, passesPct: 0.5 } },
  { id: 'apoiado', label: 'Construção curta e apoiada', hint: 'Sai jogando e quebra linhas com passe', add: { passesPct: 1, linebreaking90: 0.5, passes90: 0.5 } },
  { id: 'pressao_alta', label: 'Pressão alta', hint: 'Recupera a bola perto do gol rival', add: { finalThirdRecoveries90: 1, tackles90: 1, recoveries90: 0.5 } },
  { id: 'bloco_medio', label: 'Bloco médio ou baixo', hint: 'Compacto, protege a área e antecipa', add: { interceptions90: 1, clearances90: 0.5, tackles90: 0.5, blocks90: 0.5 } },
  { id: 'transicao', label: 'Transição rápida', hint: 'Ataca o espaço em contra-ataque', add: { dribbles90: 1, keyPasses90: 0.5, linebreaking90: 0.5, topSpeed: 1 } },
  { id: 'direto', label: 'Jogo direto, bola longa', hint: 'Lançamentos e disputa pelo alto', add: { longBalls90: 1, longBallsPct: 0.5, aerialWon90: 0.5 } },
  { id: 'laterais', label: 'Laterais ofensivos', hint: 'Cruzamentos e apoio pelos corredores', add: { crosses90: 1, xa90: 0.5, keyPasses90: 0.5 } },
];
export const STYLE_BY_ID: Record<string, StyleMarker> = Object.fromEntries(STYLES.map((s) => [s.id, s]));

export interface Trait {
  id: string;
  label: string;
  hint: string;
  positions: PositionKey[];
  add: Record<string, number>;
  /** Usado no lugar de `add` quando alguma métrica de `add` não existe para todo o grupo. */
  fallback?: Record<string, number>;
  fallbackNote?: string;
}

const OFENSIVOS: PositionKey[] = ['meia-atacante', 'extremo', 'centroavante'];
const CAMPO: PositionKey[] = ['zagueiro', 'lateral', 'volante', 'meia', 'meia-atacante', 'extremo', 'centroavante'];

/** O que a pessoa procura no jogador. As caixas aparecem conforme a posição escolhida. */
export const TRAITS: Trait[] = [
  { id: 'finalizacao', label: 'Boa finalização', hint: 'xG, chutes no alvo e gols', positions: [...OFENSIVOS, 'meia'], add: { xg90: 2, sot90: 1.5, shots90: 1, goals90: 1 } },
  { id: 'area', label: 'Presença na área', hint: 'Toques na área adversária', positions: OFENSIVOS, add: { touchesBox90: 2 } },
  {
    id: 'velocidade',
    label: 'Velocidade',
    hint: 'Velocidade máxima (km/h) quando houver na base; sem ela, dribles e faltas sofridas',
    positions: ['lateral', 'extremo', 'centroavante', 'meia-atacante', 'zagueiro'],
    add: { topSpeed: 3 },
    fallback: { dribbles90: 1, foulsWon90: 0.5 },
    fallbackNote: 'Não há velocidade máxima para todos os jogadores do grupo. A característica “Velocidade” usa dribles e faltas sofridas como aproximação.',
  },
  { id: 'drible', label: 'Drible e 1x1', hint: 'Dribles certos e faltas sofridas', positions: ['lateral', 'meia-atacante', 'extremo'], add: { dribbles90: 2, dribblesPct: 1, foulsWon90: 0.5 } },
  { id: 'criacao', label: 'Criação de chances', hint: 'xA, chances e grandes chances criadas', positions: ['lateral', 'meia', 'meia-atacante', 'extremo', 'centroavante'], add: { keyPasses90: 2, xa90: 2, bigChancesCreated90: 1 } },
  { id: 'construcao', label: 'Passe e construção', hint: 'Acerto e volume de passes', positions: ['goleiro', 'zagueiro', 'lateral', 'volante', 'meia', 'meia-atacante'], add: { passesPct: 1.5, passes90: 1, longBallsPct: 0.5, touches90: 0.5 } },
  { id: 'quebra', label: 'Quebra de linhas', hint: 'Passes que quebram linhas e chegam ao terço final', positions: ['zagueiro', 'volante', 'meia', 'meia-atacante'], add: { linebreaking90: 2.5, finalThirdPasses90: 1 } },
  { id: 'cruzamento', label: 'Cruzamento', hint: 'Cruzamentos certos', positions: ['lateral', 'extremo', 'meia-atacante'], add: { crosses90: 2, crossesPct: 1 } },
  { id: 'marcacao', label: 'Marcação e desarme', hint: 'Desarmes, interceptações e recuperações', positions: ['lateral', 'volante', 'meia', 'meia-atacante', 'extremo'], add: { tackles90: 2, interceptions90: 1.5, recoveries90: 1 } },
  { id: 'duelos', label: 'Duelos e força', hint: 'Disputas ganhas', positions: CAMPO, add: { duelsWonPct: 2, duelsWon90: 1 } },
  { id: 'aereo', label: 'Jogo aéreo', hint: 'Duelos aéreos ganhos', positions: ['zagueiro', 'volante', 'lateral', 'centroavante'], add: { aerialWonPct: 2, aerialWon90: 1 } },
  { id: 'leitura', label: 'Antecipação e cobertura', hint: 'Interceptações, cortes, bloqueios e poucos dribles sofridos', positions: ['zagueiro', 'lateral', 'volante'], add: { interceptions90: 2, clearances90: 1, blocks90: 1, dribbledPast90: 1 } },
  { id: 'pressao', label: 'Pressão após a perda', hint: 'Recuperação no terço final e desarmes', positions: CAMPO, add: { finalThirdRecoveries90: 2, recoveries90: 1, tackles90: 0.5 } },
  { id: 'seguranca', label: 'Segurança com a bola', hint: 'Poucas perdas de posse e passe certo', positions: CAMPO, add: { possLost90: 2, passesPct: 1 } },
  { id: 'disciplina', label: 'Disciplina', hint: 'Poucas faltas cometidas', positions: CAMPO, add: { foulsCommitted90: 1.5 } },
  { id: 'g_defesa', label: 'Defesa de chutes', hint: 'Defesas %, gols evitados, pênaltis', positions: ['goleiro'], add: { savePct: 2, goalsPrevented90: 2, penaltySavePct: 1, saves90: 0.5 } },
  { id: 'g_erros', label: 'Poucos erros', hint: 'Erros que levaram a gol', positions: ['goleiro'], add: { errorsToGoal90: 2 } },
  { id: 'g_pes', label: 'Jogo com os pés', hint: 'Passe curto e lançamento', positions: ['goleiro'], add: { passesPct: 2, longBallsPct: 1.5, longBalls90: 1, sweeper90: 0.5 } },
  { id: 'g_area', label: 'Domínio da área', hint: 'Bolas altas e saídas do gol', positions: ['goleiro'], add: { claims90: 2, sweeper90: 1 } },
];
export const TRAIT_BY_ID: Record<string, Trait> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));
export const traitsFor = (pos: PositionKey) => TRAITS.filter((t) => t.positions.includes(pos));

export interface ProfileInput {
  posicao: PositionKey;
  estilo: string[];
  tracos: Record<string, 1 | 2>;
}

export interface BuiltProfile {
  weights: Record<string, number>;
  notices: string[];
}

/**
 * Junta os pesos-base da posição, o estilo do clube e as características marcadas.
 * `available`: métricas que existem para todos os jogadores do grupo.
 */
export function buildWeights(input: ProfileInput, available: (key: string) => boolean): BuiltProfile {
  const base = POSITIONS[input.posicao].weights;
  const w: Record<string, number> = { ...base };
  const notices: string[] = [];
  const isGk = input.posicao === 'goleiro';
  const allowed = (k: string) => {
    const def = METRIC_BY_KEY[k];
    if (!def) return false;
    if (isGk) return k in base;
    return def.group !== 'Goleiro';
  };
  const add = (k: string, v: number) => {
    if (allowed(k)) w[k] = (w[k] ?? 0) + v;
  };
  for (const id of input.estilo) {
    const st = STYLE_BY_ID[id];
    if (!st) continue;
    for (const [k, v] of Object.entries(st.add)) if (k !== 'topSpeed' || available(k)) add(k, v);
  }
  for (const [id, level] of Object.entries(input.tracos)) {
    const t = TRAIT_BY_ID[id];
    if (!t || !t.positions.includes(input.posicao)) continue;
    const useFallback = t.fallback && Object.keys(t.add).some((k) => !available(k));
    if (useFallback) notices.push(t.fallbackNote ?? `Dados insuficientes para “${t.label}”.`);
    for (const [k, v] of Object.entries(useFallback ? t.fallback! : t.add)) add(k, v * level);
  }
  return { weights: w, notices };
}

export function describeProfile(input: ProfileInput, filtros: Filters, clubName: string): string {
  const pos = POSITIONS[input.posicao].label;
  const estilo = input.estilo.map((id) => STYLE_BY_ID[id]?.label).filter(Boolean);
  const tr = Object.entries(input.tracos)
    .map(([id, lv]) => (TRAIT_BY_ID[id] ? `${TRAIT_BY_ID[id].label}${lv === 2 ? ' (essencial)' : ''}` : ''))
    .filter(Boolean);
  const fl: string[] = [];
  if (filtros.alturaMin) fl.push(`altura de ${filtros.alturaMin} cm ou mais`);
  if (filtros.alturaMax) fl.push(`até ${filtros.alturaMax} cm`);
  if (filtros.pe) fl.push(`pé ${filtros.pe.toLowerCase()}`);
  if (filtros.idadeMax) fl.push(`até ${filtros.idadeMax} anos`);
  if (filtros.soBrasil) fl.push('já joga no Brasil');
  if (filtros.liga) fl.push(`liga: ${filtros.liga}`);
  return [
    `${clubName}: ${pos.toLowerCase()}`,
    estilo.length ? `estilo do clube: ${estilo.join(', ').toLowerCase()}` : '',
    tr.length ? `procura: ${tr.join(', ').toLowerCase()}` : 'sem características marcadas (pesos-base da posição)',
    fl.length ? `filtros: ${fl.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
