import { afterEach, describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import { ELENCO_FLUMINENSE, rosterToPlayers } from '../data/elencos';
import type { Filters, Player } from '../types';
import { changeFormation, FORMACOES, moveTo, placeInSlot, slotsFor, emptyLineup } from './formations';
import { isSofascoreUrl, widgetSrc } from './sofascore';
import { passesFilters, sameClub } from './filters';
import { normalizeText } from './format';
import { leagueOptions, missingClubs } from './leagues';
import { similarNames, uniqueId } from './names';
import { localBackend } from './backend';

const players = seed.players as unknown as Player[];
const noFilter: Filters = {} as Filters;

describe('filtros', () => {
  it('filtra por valor de mercado', () => {
    const caros = players.filter((p) => passesFilters(p, { ...noFilter, valorMax: 1_000_000 }));
    expect(caros.length).toBeLessThan(players.length);
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
    expect(novos.every((p) => p.idade === undefined)).toBe(true);
  });
  it('rodar de novo não cria nada', () => {
    expect(rosterToPlayers(ELENCO_FLUMINENSE, 'Fluminense-BRA', [...base, ...novos], normalizeText, sameClub).length).toBe(0);
  });
});

describe('campinho', () => {
  it('tem as 7 formações com 11 lugares', () => {
    expect(Object.keys(FORMACOES)).toEqual(['3-4-3', '3-5-2', '4-4-2', '4-3-3', '4-2-3-1', '5-3-2', '5-2-3']);
    for (const f of Object.keys(FORMACOES)) expect(slotsFor(f).length).toBe(11);
  });
  it('começa vazio, limita a 11 e deixa mover livremente', () => {
    let l = emptyLineup('4-4-2');
    expect(Object.keys(l.jogadores).length).toBe(0);
    for (let i = 0; i < 13; i++) l = placeInSlot(l, 'j' + i, 'meia');
    expect(Object.keys(l.jogadores).length).toBe(11);
    l = moveTo(l, 'j0', 50, 50);
    expect(l.jogadores.j0.slot).toBeUndefined();
    expect(l.jogadores.j0.x).toBe(50);
  });
  it('trocar de formação mantém os jogadores', () => {
    let l = placeInSlot(emptyLineup('4-4-2'), 'a', 'goleiro');
    l = changeFormation(l, '3-5-2');
    expect(l.formacao).toBe('3-5-2');
    expect(l.jogadores.a).toBeDefined();
  });
});

describe('sofascore', () => {
  it('aceita só links do Sofascore', () => {
    expect(isSofascoreUrl('https://www.sofascore.com/player/x/1')).toBe(true);
    expect(isSofascoreUrl('http://www.sofascore.com/x')).toBe(false);
    expect(isSofascoreUrl('https://evil.com/sofascore.com')).toBe(false);
  });
  it('extrai o src do iframe e recusa outros domínios', () => {
    expect(widgetSrc('<iframe width="100%" src="https://widgets.sofascore.com/pt-BR/embed/player?id=1"></iframe>')).toBe('https://widgets.sofascore.com/pt-BR/embed/player?id=1');
    expect(widgetSrc('<iframe src="https://evil.com/x"></iframe>')).toBeNull();
    expect(widgetSrc('<script>alert(1)</script>')).toBeNull();
  });
});
