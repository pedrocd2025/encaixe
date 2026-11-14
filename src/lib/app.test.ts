import { afterEach, describe, expect, it } from 'vitest';
import { applyCustomMetrics, METRIC_BY_KEY, POSITIONS } from '../data/catalog';
import seed from '../data/seed.json';
import { ELENCO_FLUMINENSE, rosterToPlayers } from '../data/elencos';
import type { Filters, Player } from '../types';
import { passesFilters, sameClub } from './filters';
import { normalizeText } from './format';
import { leagueOptions, missingClubs } from './leagues';
import { similarNames, uniqueId } from './names';
import { localBackend } from './backend';
import { parseSofascore } from './paste';
import { fmtTotal, fromTotal, isCountMetric, rescaleForMinutes, toTotal } from './units';
import { buildWeights, TRAITS } from './profile';
import { hasMetricForAll, rankPlayers, splitPool } from './rank';

const players = seed.players as unknown as Player[];
const noFilter: Filters = {} as Filters;

describe('ranking do curso', () => {
  const candidatos = players.filter((p) => !sameClub(p.clube, 'Fluminense'));
  it('reproduz a nota do Evander com os pesos-base (14 métricas)', () => {
    const r = rankPlayers(candidatos, POSITIONS['meia-atacante'].weights, 900);
    expect(r.used).toHaveLength(14);
    expect(r.ignored).toEqual([]);
    expect(r.rows[0].player.nome).toBe('Evander');
    expect(r.rows[0].score).toBeCloseTo(7.52, 2);
  });
  it('exclui amostras pequenas', () => {
    const { excluded } = splitPool(candidatos, 900);
    expect(excluded.map((e) => e.player.nome).sort()).toEqual(['Gustavo Scarpa', 'Leonardo Fernandez', 'Miguelito']);
  });
});

describe('perfil por caixas', () => {
  const avail = (k: string) => hasMetricForAll(players, k);
  it('velocidade usa substituto quando falta topSpeed', () => {
    const r = buildWeights({ posicao: 'meia-atacante', estilo: [], tracos: { velocidade: 2 } }, avail);
    expect(r.notices.length).toBe(1);
    expect(r.weights.topSpeed).toBeUndefined();
  });
  it('velocidade usa topSpeed quando existe para todos', () => {
    const r = buildWeights({ posicao: 'meia-atacante', estilo: [], tracos: { velocidade: 2 } }, () => true);
    expect(r.weights.topSpeed).toBeGreaterThan(0);
    expect(r.notices.length).toBe(0);
  });
  it('traços aumentam pesos', () => {
    const base = POSITIONS['meia-atacante'].weights;
    const r = buildWeights({ posicao: 'meia-atacante', estilo: ['posse'], tracos: { finalizacao: 2 } }, avail);
    expect(Object.values(r.weights).reduce((a, b) => a + b, 0)).toBeGreaterThan(Object.values(base).reduce((a, b) => a + b, 0));
    expect(TRAITS.length).toBeGreaterThan(5);
  });
});

describe('filtros', () => {
  it('só escondem, não mudam a nota', () => {
    const w = POSITIONS['meia-atacante'].weights;
    const before = rankPlayers(players, w, 900).rows.map((r) => r.score);
    const caros = players.filter((p) => passesFilters(p, { ...noFilter, valorMax: 1_000_000 }));
    expect(caros.length).toBeLessThan(players.length);
    expect(rankPlayers(players, w, 900).rows.map((r) => r.score)).toEqual(before);
  });
  it('reconhece o clube', () => {
    expect(sameClub('Fluminense-BRA', 'Fluminense')).toBe(true);
    expect(sameClub('Flamengo', 'Fluminense')).toBe(false);
  });
});

describe('nomes parecidos', () => {
  it('reconhece variações do mesmo nome', () => {
    expect(similarNames('G. Scarpa', 'Gustavo Scarpa')).toBe(true);
    expect(similarNames('Evander', 'Evander Ferreira')).toBe(true);
    expect(similarNames('Rodrigo Garo', 'Rodrigo Garro')).toBe(true);
  });
  it('não confunde pessoas diferentes', () => {
    expect(similarNames('Paulo Henrique Ganso', 'Lucho Acosta')).toBe(false);
    expect(similarNames('Rodrigo Garro', 'Rodrigo Pinheiro')).toBe(false);
  });
});

describe('clubes e ligas criados pelos jogadores', () => {
  const clubs = [{ id: 'fluminense', nome: 'Fluminense', liga: 'Brasileiro Série A', estilo: [], necessidades: [], atualizadoEm: '2026-11-10' }];
  const mk = (nome: string, clube: string, liga?: string): Player => ({ id: nome, nome, posicao: 'meia', clube, liga, metrics: {}, atualizadoEm: '2026-11-10' });
  it('cria só os clubes que faltam, com nome limpo e a liga do jogador', () => {
    const novos = missingClubs([mk('A', 'Fluminense-BRA'), mk('B', 'Internacional-BRA', 'Brasileiro Série A'), mk('C', 'Internacional'), mk('D', 'Atlético-MG')], clubs);
    expect(novos.map((c) => c.nome)).toEqual(['Internacional', 'Atlético-MG']);
    expect(novos[0].liga).toBe('Brasileiro Série A');
    expect(new Set(novos.map((c) => c.id)).size).toBe(2);
  });
  it('lista as ligas sem repetir por acento ou maiúscula', () => {
    const l = leagueOptions([mk('A', 'X', 'Brasileiro Série A'), mk('B', 'Y', 'brasileiro serie a'), mk('C', 'Z', 'Liga MX')], clubs);
    expect(l.map((x) => x.nome)).toEqual(['Brasileiro Série A', 'Liga MX']);
    expect(l[0].count).toBe(2);
  });
  it('filtra por liga', () => {
    expect(passesFilters(mk('A', 'X', 'Liga MX'), { liga: 'liga mx' } as Filters)).toBe(true);
    expect(passesFilters(mk('A', 'X', 'Liga MX'), { liga: 'Brasileiro Série A' } as Filters)).toBe(false);
  });
});

describe('métricas criadas pelo dono', () => {
  afterEach(() => applyCustomMetrics([]));
  it('entram nos pesos das posições escolhidas e saem quando removidas', () => {
    applyCustomMetrics([{ key: 'c_teste', label: 'Teste', unit: 'por90', better: 'high', group: 'Passe', weights: { volante: 2, meia: 0 } }]);
    expect(POSITIONS.volante.weights.c_teste).toBe(2);
    expect(POSITIONS.meia.weights.c_teste).toBe(0);
    expect(POSITIONS.zagueiro.weights.c_teste).toBeUndefined();
    expect(METRIC_BY_KEY.c_teste.label).toBe('Teste');
    applyCustomMetrics([]);
    expect(POSITIONS.volante.weights.c_teste).toBeUndefined();
    expect(METRIC_BY_KEY.c_teste).toBeUndefined();
  });
  it('não mexem nos pesos da atividade do curso', () => {
    applyCustomMetrics([{ key: 'c_x', label: 'X', unit: 'pct', better: 'low', group: 'Defesa', weights: { 'meia-atacante': 1 } }]);
    const base = Object.keys(POSITIONS['meia-atacante'].weights).filter((k) => k !== 'c_x');
    expect(base).toHaveLength(17);
  });
  it('o goleiro tem defesa de pênalti e erro que levou a gol', () => {
    expect(POSITIONS.goleiro.weights.penaltySavePct).toBeGreaterThan(0);
    expect(POSITIONS.goleiro.weights.errorsToGoal90).toBeGreaterThan(0);
    expect(METRIC_BY_KEY.errorsToGoal90.better).toBe('low');
  });
});

describe('totais do Sofascore e por 90', () => {
  it('converte total <-> por 90 sem perder o número', () => {
    const por90 = fromTotal(21, 2811);
    expect(toTotal(por90, 2811)).toBeCloseTo(21, 2);
    expect(fmtTotal(Math.round(toTotal(por90, 2811)))).toBe('21');
    expect(fmtTotal(18.39)).toBe('18,39');
  });
  it('só métricas de contagem são convertidas', () => {
    expect(isCountMetric('keyPasses90')).toBe(true);
    expect(isCountMetric('passesPct')).toBe(false);
    expect(isCountMetric('topSpeed')).toBe(false);
    expect(isCountMetric('goals90')).toBe(false);
  });
  it('mudar os minutos mantém os totais na tela', () => {
    const antes = { keyPasses90: 1.2, passesPct: 80 };
    const depois = rescaleForMinutes(antes, 900, 1800);
    expect(toTotal(depois.keyPasses90, 1800)).toBeCloseTo(toTotal(1.2, 900), 2);
    expect(depois.passesPct).toBe(80);
  });
  it('nomes das métricas seguem o Sofascore', () => {
    expect(METRIC_BY_KEY.keyPasses90.label).toBe('Passes decisivos');
    expect(METRIC_BY_KEY.passesPct.label).toBe('Precisão de passe %');
    expect(METRIC_BY_KEY.possLost90.label).toBe('Domínios malsucedidos');
  });
});

describe('homônimos', () => {
  it('mesmo nome em clubes diferentes recebe ids diferentes', () => {
    const used = new Set(['gabriel']);
    const a = uniqueId('Gabriel', 'Santos', used);
    expect(a).toBe('gabriel-santos');
    used.add(a);
    expect(uniqueId('Gabriel', 'Santos', used)).toBe('gabriel-santos-2');
    expect(uniqueId('Pedro', 'Flamengo', used)).toBe('pedro');
  });
});

describe('colar do Sofascore', () => {
  const texto = `Jogos18
Titular13
Minutos por jogo63
Total de minutos jogados1132
Time da semana1
Desempenho de corrida (por 90)
Distância percorrida8.6 km
Número de sprints15.6
Velocidade máxima34.8 km/h
Atacando
Gols9
Gols esperados (xG)6.58
Finalizações2.1
Chutes certos por jogo1.4
Conversão de gols24%
Gols de dentro da área9/29
Gols de cabeça`;
  const lido = parseSofascore(texto);
  const get = (t: string) => lido.find((i) => i.target === t)?.value;
  it('preenche campos do jogador', () => {
    expect(get('jogos')).toBe('18');
    expect(get('titular')).toBe('13');
    expect(get('minutos')).toBe('1132');
    expect(get('gols')).toBe('9');
  });
  it('xG é total, finalizações viram total e velocidade vem direto', () => {
    expect(get('m:xg90')).toBe('6,58');
    expect(get('m:shots90')).toBe('37,8');
    expect(get('m:sot90')).toBe('25,2');
    expect(get('m:topSpeed')).toBeUndefined();
  });
  it('ignora o que o app não usa e aceita valor na linha seguinte', () => {
    expect(lido.find((i) => i.label === 'Time da semana')?.target).toBeNull();
    expect(lido.find((i) => i.label.startsWith('Gols de dentro'))?.target).toBeNull();
    expect(parseSofascore('Gols\n9').find((i) => i.target === 'gols')?.value).toBe('9');
  });
  it('por jogo sem partidas não é convertido', () => {
    expect(parseSofascore('Finalizações2.1')[0].target).toBeNull();
    expect(parseSofascore('Finalizações2.1', 10)[0].value).toBe('21');
  });
});

describe('colar só métricas com peso na posição', () => {
  const t = 'Jogos18\nGols esperados (xG)6.58\nVelocidade máxima34.8 km/h\nChutes certos por jogo1.4';
  it('ignora métricas sem peso e mantém dados básicos', () => {
    const r = parseSofascore(t, undefined, { xg90: 1, sot90: 0 });
    expect(r.find((i) => i.target === 'jogos')?.value).toBe('18');
    expect(r.find((i) => i.target === 'm:xg90')?.value).toBe('6,58');
    expect(r.find((i) => i.label.startsWith('Velocidade'))?.target).toBeNull();
    expect(r.find((i) => i.label.startsWith('Chutes certos'))?.note).toBe('sem peso nesta posição');
    expect(r.find((i) => i.target === 'm:sot90')).toBeUndefined();
  });
  it('meia-atacante: xG entra, velocidade não', () => {
    const r = parseSofascore(t, undefined, POSITIONS['meia-atacante'].weights as Record<string, number>);
    expect(r.some((i) => i.target === 'm:topSpeed')).toBe(false);
  });
});

describe('clubes pessoais', () => {
  it('modo local guarda por conta e não mistura', async () => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
    const b = localBackend();
    const c = { id: 'meu-teste', nome: 'Teste', estilo: [], necessidades: [], atualizadoEm: '2026-01-01' };
    await b.saveMyClub('ana', c);
    let ana: any[] = [], bia: any[] = [];
    b.subscribeMyClubs('ana', (l: any[]) => (ana = l), () => {});
    b.subscribeMyClubs('bia', (l: any[]) => (bia = l), () => {});
    await Promise.resolve();
    expect(ana.map((x) => x.id)).toEqual(['meu-teste']);
    expect(ana[0].privado).toBe(true);
    expect(bia).toEqual([]);
    await b.removeMyClub('ana', 'meu-teste');
    b.subscribeMyClubs('ana', (l: any[]) => (ana = l), () => {});
    await Promise.resolve();
    expect(ana).toEqual([]);
  });
});

describe('elenco do Fluminense', () => {
  const base = (seed as unknown as { players: Player[] }).players;
  const novos = rosterToPlayers(ELENCO_FLUMINENSE, 'Fluminense-BRA', base, normalizeText, sameClub);
  it('não duplica quem já está na base (Ganso e Acosta)', () => {
    expect(ELENCO_FLUMINENSE.length).toBe(32);
    expect(novos.length).toBe(30);
    expect(novos.some((p) => p.nome === 'PH Ganso' || p.nome === 'Lucho Acosta')).toBe(false);
  });
  it('ids únicos e sem estatísticas inventadas', () => {
    const ids = new Set([...base, ...novos].map((p) => p.id));
    expect(ids.size).toBe(base.length + novos.length);
    expect(novos.every((p) => Object.keys(p.metrics).length === 0 && p.idade === undefined)).toBe(true);
  });
  it('rodar de novo não cria nada', () => {
    expect(rosterToPlayers(ELENCO_FLUMINENSE, 'Fluminense-BRA', [...base, ...novos], normalizeText, sameClub).length).toBe(0);
  });
});
