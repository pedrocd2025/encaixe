import type { CustomMetric, PositionKey } from '../types';

export type Unit = 'por90' | 'pct' | 'total';
export type Group = 'Criação' | 'Finalização' | 'Passe' | 'Condução' | 'Defesa' | 'Duelos' | 'Goleiro' | 'Disciplina';
export const GROUPS: Group[] = ['Criação', 'Finalização', 'Passe', 'Condução', 'Defesa', 'Duelos', 'Goleiro', 'Disciplina'];

export interface MetricDef {
  key: string;
  label: string;
  unit: Unit;
  better: 'high' | 'low';
  decimals: number;
  group: Group;
  /** Nomes que costumam aparecer em Sofascore, FotMob, Transfermarkt (pt e en). Usados na colagem. */
  aliases: string[];
  /** Métrica de porcentagem que acompanha esta (ex.: "45 (85%)" -> passes certos + passes certos %). */
  pctKey?: string;
  /** Calculada a partir de gols/assistências e minutos; não é digitada. */
  derived?: boolean;
}

const m = (
  key: string,
  label: string,
  unit: Unit,
  better: 'high' | 'low',
  group: Group,
  aliases: string[],
  extra: Partial<MetricDef> = {},
): MetricDef => ({ key, label, unit, better, group, aliases, decimals: unit === 'pct' ? 1 : 2, ...extra });

export const METRICS: MetricDef[] = [
  // Físico
  m('topSpeed', 'Velocidade máxima (km/h)', 'total', 'high', 'Condução', ['top speed', 'max speed', 'velocidade maxima', 'velocidade maxima km h', 'velocidade'], { decimals: 1 }),
  // Criação
  m('keyPasses90', 'Passes decisivos', 'por90', 'high', 'Criação', [
    'key passes', 'chances created', 'chances criadas', 'passes decisivos', 'passes chave', 'passes para finalizacao',
  ]),
  m('xa90', 'Assistências esperadas (xA)', 'por90', 'high', 'Criação', [
    'expected assists xa', 'expected assists', 'xa', 'assistencias esperadas xa', 'assistencias esperadas',
  ]),
  m('bigChancesCreated90', 'Grandes chances criadas', 'por90', 'high', 'Criação', [
    'big chances created', 'grandes chances criadas',
  ]),
  m('touchesBox90', 'Ações com a bola na área adversária', 'por90', 'high', 'Criação', [
    'touches in opposition box', 'touches in penalty area', 'touches in box', 'toques na area adversaria',
    'toques na area', 'toques na grande area',
  ]),
  m('crosses90', 'Cruzamentos certos', 'por90', 'high', 'Criação', [
    'accurate crosses', 'successful crosses', 'crosses completed', 'cruzamentos certos', 'cruzamentos completados',
    'cruzamentos',
  ], { pctKey: 'crossesPct' }),
  m('crossesPct', 'Precisão de cruzamentos %', 'pct', 'high', 'Criação', [
    'accurate crosses pct', 'cross accuracy', 'cruzamentos certos pct', 'precisao dos cruzamentos',
  ]),
  m('linebreaking90', 'Passes que quebram linhas', 'por90', 'high', 'Criação', [
    'passes que quebram linhas', 'line breaking passes', 'linebreaking passes', 'passes quebra linhas',
    'passes entre linhas',
  ]),
  m('finalThirdPasses90', 'Passes certos no terço final', 'por90', 'high', 'Criação', [
    'passes into final third', 'accurate passes final third', 'passes no terco final', 'passes para o terco final',
  ]),
  // Finalização
  m('xg90', 'Gols esperados (xG)', 'por90', 'high', 'Finalização', [
    'expected goals xg', 'expected goals', 'xg', 'gols esperados xg', 'gols esperados',
  ]),
  m('shots90', 'Total de chutes', 'por90', 'high', 'Finalização', [
    'total shots', 'shots', 'chutes', 'chutes totais', 'finalizacoes', 'finalizacoes totais',
  ]),
  m('sot90', 'Chutes ao gol', 'por90', 'high', 'Finalização', [
    'shots on target', 'chutes no alvo', 'finalizacoes no alvo', 'chutes certos',
  ]),
  m('goals90', 'Gols por 90', 'por90', 'high', 'Finalização', [], { derived: true }),
  m('assists90', 'Assistências por 90', 'por90', 'high', 'Finalização', [], { derived: true }),
  // Passe
  m('passes90', 'Passes certos', 'por90', 'high', 'Passe', [
    'accurate passes', 'passes certos', 'passes completados', 'passes precisos', 'successful passes',
  ], { pctKey: 'passesPct' }),
  m('passesPct', 'Precisão de passe %', 'pct', 'high', 'Passe', [
    'accurate passes pct', 'pass accuracy', 'passes certos pct', 'precisao dos passes', 'precisao de passe',
    'pass completion', 'passes pct',
  ]),
  m('touches90', 'Ações com a bola', 'por90', 'high', 'Passe', ['touches', 'toques', 'toques na bola']),
  m('longBalls90', 'Bolas longas precisas', 'por90', 'high', 'Passe', [
    'accurate long balls', 'long balls completed', 'lancamentos certos', 'bolas longas certas', 'lancamentos',
  ], { pctKey: 'longBallsPct' }),
  m('longBallsPct', 'Precisão de bolas longas %', 'pct', 'high', 'Passe', [
    'accurate long balls pct', 'long ball accuracy', 'lancamentos certos pct', 'precisao dos lancamentos',
  ]),
  m('possLost90', 'Domínios malsucedidos', 'por90', 'low', 'Passe', [
    'possession lost', 'dispossessed', 'perdas de posse', 'perdas de bola', 'bolas perdidas', 'posse perdida',
  ]),
  // Condução
  m('dribbles90', 'Dribles certos', 'por90', 'high', 'Condução', [
    'successful dribbles', 'dribbles won', 'dribles certos', 'dribles bem sucedidos', 'dribles completados',
    'take ons won',
  ], { pctKey: 'dribblesPct' }),
  m('dribblesPct', 'Sucesso em dribles %', 'pct', 'high', 'Condução', [
    'successful dribbles pct', 'dribble success', 'dribles certos pct', 'dribles bem sucedidos pct',
  ]),
  m('foulsWon90', 'Faltas sofridas', 'por90', 'high', 'Condução', [
    'was fouled', 'fouls won', 'faltas sofridas', 'faltas recebidas',
  ]),
  // Defesa
  m('tackles90', 'Desarmes', 'por90', 'high', 'Defesa', ['tackles', 'tackles won', 'desarmes', 'desarmes certos']),
  m('interceptions90', 'Interceptações', 'por90', 'high', 'Defesa', ['interceptions', 'interceptacoes']),
  m('recoveries90', 'Recuperações de bola', 'por90', 'high', 'Defesa', [
    'ball recovery', 'ball recoveries', 'recoveries', 'recuperacoes de bola', 'recuperacoes', 'bolas recuperadas',
  ]),
  m('finalThirdRecoveries90', 'Posse recuperada no terço final', 'por90', 'high', 'Defesa', [
    'possession won final 3rd', 'possession won in final third', 'posse recuperada no terco final',
    'recuperacoes no terco final',
  ]),
  m('clearances90', 'Cortes', 'por90', 'high', 'Defesa', [
    'clearances', 'cortes', 'rebatidas', 'afastamentos',
  ]),
  m('blocks90', 'Chutes bloqueados', 'por90', 'high', 'Defesa', [
    'blocked shots', 'shots blocked', 'blocks', 'finalizacoes bloqueadas', 'chutes bloqueados', 'bloqueios',
  ]),
  m('dribbledPast90', 'Driblado', 'por90', 'low', 'Defesa', [
    'dribbled past', 'dribles sofridos', 'driblado', 'foi driblado',
  ]),
  // Duelos
  m('duelsWon90', 'Duelos ganhos', 'por90', 'high', 'Duelos', [
    'total duels won', 'duels won', 'disputas ganhas', 'duelos ganhos',
  ], { pctKey: 'duelsWonPct' }),
  m('duelsWonPct', 'Duelos ganhos %', 'pct', 'high', 'Duelos', [
    'total duels won pct', 'duels won pct', 'disputas ganhas pct', 'duelos ganhos pct',
  ]),
  m('groundDuelsWonPct', 'Duelos no chão ganhos %', 'pct', 'high', 'Duelos', [
    'ground duels won pct', 'disputas no chao ganhas pct', 'duelos no chao ganhos pct',
  ]),
  m('aerialWon90', 'Duelos aéreos ganhos', 'por90', 'high', 'Duelos', [
    'aerial duels won', 'duelos aereos ganhos', 'disputas aereas ganhas', 'bolas aereas ganhas',
  ], { pctKey: 'aerialWonPct' }),
  m('aerialWonPct', 'Duelos aéreos ganhos %', 'pct', 'high', 'Duelos', [
    'aerial duels won pct', 'duelos aereos ganhos pct', 'disputas aereas ganhas pct',
  ]),
  // Disciplina
  m('foulsCommitted90', 'Faltas', 'por90', 'low', 'Disciplina', [
    'fouls', 'fouls committed', 'faltas', 'faltas cometidas',
  ]),
  // Goleiro
  m('savePct', 'Defesas %', 'pct', 'high', 'Goleiro', [
    'saves pct', 'save percentage', 'save pct', 'defesas pct', 'percentual de defesas',
  ]),
  m('saves90', 'Defesas', 'por90', 'high', 'Goleiro', ['saves', 'defesas']),
  m('penaltySavePct', 'Defesas de pênalti %', 'pct', 'high', 'Goleiro', [
    'penalty save pct', 'penalty saves pct', 'penalties saved pct', 'penalty save percentage', 'defesas de penalti pct', 'penaltis defendidos pct',
    'defesa de penalti pct',
  ]),
  m('errorsToGoal90', 'Erros que levaram ao gol', 'por90', 'low', 'Goleiro', [
    'errors leading to goal', 'errors leading to a goal', 'error led to goal', 'erros que levaram a gol', 'erro que levou a gol', 'erros que resultaram em gol',
  ]),
  m('goalsConceded90', 'Gols sofridos', 'por90', 'low', 'Goleiro', ['goals conceded', 'gols sofridos']),
  m('goalsPrevented90', 'Gols evitados', 'por90', 'high', 'Goleiro', ['goals prevented', 'gols evitados']),
  m('cleanSheetPct', 'Jogos sem sofrer gol %', 'pct', 'high', 'Goleiro', [
    'clean sheets pct', 'jogos sem sofrer gol pct', 'clean sheet pct',
  ]),
  m('claims90', 'Bolas altas seguras', 'por90', 'high', 'Goleiro', [
    'high claims', 'claims', 'saidas de gol', 'bolas altas',
  ]),
  m('sweeper90', 'Saídas do gol', 'por90', 'high', 'Goleiro', [
    'runs out', 'successful runs out', 'sweeper actions', 'saidas', 'acoes fora da area',
  ]),
];

export const METRIC_BY_KEY: Record<string, MetricDef> = Object.fromEntries(METRICS.map((x) => [x.key, x]));

/** Campos de volume do registro (nunca convertidos). */
export interface TotalField {
  key: 'apps' | 'starts' | 'minutes' | 'goals' | 'assists' | 'yellow' | 'red';
  label: string;
  aliases: string[];
}
export const TOTAL_FIELDS: TotalField[] = [
  { key: 'apps', label: 'Jogos', aliases: ['appearances', 'matches played', 'matches', 'games', 'jogos', 'partidas', 'partidas jogadas'] },
  { key: 'starts', label: 'Titularidades', aliases: ['started', 'starts', 'titular', 'jogos como titular', 'titularidades', 'partidas como titular'] },
  { key: 'minutes', label: 'Minutos', aliases: ['minutes played', 'minutes', 'minutos jogados', 'minutos'] },
  { key: 'goals', label: 'Gols', aliases: ['goals', 'gols'] },
  { key: 'assists', label: 'Assistências', aliases: ['assists', 'assistencias'] },
  { key: 'yellow', label: 'Cartões amarelos', aliases: ['yellow cards', 'yellow card', 'cartoes amarelos', 'amarelos'] },
  { key: 'red', label: 'Cartões vermelhos', aliases: ['red cards', 'red card', 'cartoes vermelhos', 'vermelhos'] },
];

export interface PositionDef {
  key: PositionKey;
  label: string;
  description: string;
  /** Pesos padrão (a ordem das chaves é a ordem de exibição). Peso 0 = só contexto, fora do ranking. */
  weights: Record<string, number>;
}

export const POSITIONS: Record<PositionKey, PositionDef> = {
  goleiro: {
    key: 'goleiro',
    label: 'Goleiro',
    description: 'Evita gols, domina a área e participa da saída de bola.',
    weights: { savePct: 2, goalsPrevented90: 2, errorsToGoal90: 1.5, goalsConceded90: 1, cleanSheetPct: 1, passesPct: 1, longBallsPct: 1, claims90: 1, sweeper90: 1, penaltySavePct: 0.5, saves90: 0.5 },
  },
  zagueiro: {
    key: 'zagueiro',
    label: 'Zagueiro',
    description: 'Vence duelos, protege a área e começa a construção.',
    weights: { duelsWonPct: 2, aerialWonPct: 2, clearances90: 2, interceptions90: 2, tackles90: 1, blocks90: 1, passesPct: 1, longBallsPct: 1, linebreaking90: 1, dribbledPast90: 1, possLost90: 0.5, foulsCommitted90: 0.5, passes90: 0.5 },
  },
  lateral: {
    key: 'lateral',
    label: 'Lateral / Ala',
    description: 'Apoia pelo corredor, cruza e protege a faixa defensiva.',
    weights: { crosses90: 2, keyPasses90: 2, tackles90: 2, duelsWonPct: 2, crossesPct: 1, xa90: 1, dribbles90: 1, dribblesPct: 1, interceptions90: 1, dribbledPast90: 1, passesPct: 1, passes90: 0.5, possLost90: 0.5, touches90: 0.5, recoveries90: 0.5 },
  },
  volante: {
    key: 'volante',
    label: 'Volante',
    description: 'Protege a defesa, recupera a bola e dá segurança ao passe.',
    weights: { tackles90: 2, interceptions90: 2, recoveries90: 2, duelsWonPct: 2, passesPct: 1, passes90: 1, linebreaking90: 1, aerialWonPct: 1, dribbledPast90: 1, possLost90: 1, foulsCommitted90: 0.5, clearances90: 0.5, keyPasses90: 0.5, touches90: 0.5, finalThirdRecoveries90: 0.5 },
  },
  meia: {
    key: 'meia',
    label: 'Meia central',
    description: 'Liga defesa e ataque, progride com passe e ajuda na recuperação.',
    weights: { passesPct: 2, linebreaking90: 2, keyPasses90: 1, xa90: 1, passes90: 1, touches90: 1, tackles90: 1, interceptions90: 1, recoveries90: 1, duelsWonPct: 1, possLost90: 1, dribblesPct: 0.5, dribbles90: 0.5, duelsWon90: 0.5, shots90: 0.5, xg90: 0.5, foulsCommitted90: 0 },
  },
  'meia-atacante': {
    key: 'meia-atacante',
    label: 'Meia atacante',
    description: 'Organiza o ataque, quebra linhas e encontra o passe final.',
    weights: { xa90: 2, keyPasses90: 2, passesPct: 2, touches90: 2, passes90: 1, possLost90: 1, interceptions90: 1, duelsWon90: 1, linebreaking90: 1, shots90: 0.5, sot90: 0.5, dribbles90: 0.5, dribblesPct: 0, tackles90: 0.5, duelsWonPct: 0.5, xg90: 0, finalThirdRecoveries90: 0 },
  },
  extremo: {
    key: 'extremo',
    label: 'Extremo / Ponta',
    description: 'Desequilibra no 1x1, cria pelos lados e ameaça a área.',
    weights: { dribbles90: 2, xa90: 2, keyPasses90: 2, touchesBox90: 2, dribblesPct: 1, xg90: 1, shots90: 1, sot90: 1, crosses90: 1, possLost90: 1, foulsWon90: 1, goals90: 1, duelsWonPct: 0.5, tackles90: 0.5, finalThirdRecoveries90: 0.5 },
  },
  centroavante: {
    key: 'centroavante',
    label: 'Centroavante',
    description: 'Finaliza, ataca a área e segura a bola para o time subir.',
    weights: { xg90: 2, goals90: 2, sot90: 2, touchesBox90: 2, shots90: 1, aerialWonPct: 1, duelsWonPct: 0.5, keyPasses90: 0.5, xa90: 0.5, foulsWon90: 0.5, possLost90: 0.5, dribbles90: 0.5, finalThirdRecoveries90: 0.5, passesPct: 0.5 },
  },
};

export const POSITION_ORDER: PositionKey[] = [
  'goleiro', 'zagueiro', 'lateral', 'volante', 'meia', 'meia-atacante', 'extremo', 'centroavante',
];
// Métricas criadas pelo dono (guardadas no Firebase). Entram nas mesmas listas usadas por todo o app.
const BASE_WEIGHTS: Record<PositionKey, Record<string, number>> = Object.fromEntries(POSITION_ORDER.map((k) => [k, { ...POSITIONS[k].weights }])) as Record<PositionKey, Record<string, number>>;
const BUILT_IN_COUNT = METRICS.length;

export function applyCustomMetrics(list: CustomMetric[]): void {
  METRICS.splice(BUILT_IN_COUNT);
  for (const k of Object.keys(METRIC_BY_KEY)) if (k.startsWith('c_')) delete METRIC_BY_KEY[k];
  for (const k of POSITION_ORDER) {
    const w = POSITIONS[k].weights;
    for (const key of Object.keys(w)) delete w[key];
    Object.assign(w, BASE_WEIGHTS[k]);
  }
  for (const c of list) {
    if (!c.key || METRIC_BY_KEY[c.key]) continue;
    const def: MetricDef = { key: c.key, label: c.label, unit: c.unit, better: c.better, group: (GROUPS as string[]).includes(c.group) ? (c.group as Group) : 'Passe', decimals: c.unit === 'pct' ? 1 : 2, aliases: [] };
    METRICS.push(def);
    METRIC_BY_KEY[c.key] = def;
    for (const k of POSITION_ORDER) {
      const w = c.weights[k];
      if (typeof w === 'number' && w >= 0) POSITIONS[k].weights[c.key] = w;
    }
  }
}
