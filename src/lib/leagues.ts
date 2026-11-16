import { sameClub } from './filters';
import { normalizeText, slug, todayISO } from './format';
import type { Club, Player } from '../types';

/** "Internacional-BRA" -> "Internacional". Só remove sufixo de país com 3 letras maiúsculas (não mexe em "Atlético-MG"). */
export const cleanClubName = (raw: string): string => raw.trim().replace(/-[A-Z]{3}$/, '').trim() || raw.trim();

const hasClub = (list: Club[], name: string) => list.some((c) => sameClub(name, c.nome));

/** Clubes que aparecem nos jogadores mas ainda não foram cadastrados. O nome vem limpo e a liga do primeiro jogador. */
export function missingClubs(players: Player[], clubs: Club[]): Club[] {
  const out: Club[] = [];
  const ids = new Set(clubs.map((c) => c.id));
  for (const p of players) {
    const raw = (p.clube ?? '').trim();
    if (!raw) continue;
    const nome = cleanClubName(raw);
    if (hasClub(clubs, raw) || hasClub(out, raw) || hasClub(clubs, nome) || hasClub(out, nome)) continue;
    let id = slug(nome) || `clube-${out.length + 1}`;
    while (ids.has(id)) id += '-2';
    ids.add(id);
    out.push({ id, nome, liga: p.liga?.trim() || undefined, estilo: [], necessidades: [], atualizadoEm: todayISO() });
  }
  return out;
}

export interface LeagueOption {
  nome: string;
  count: number;
}

/** Ligas conhecidas (dos jogadores e dos clubes), sem repetir por maiúscula ou acento. `count` = jogadores. */
export function leagueOptions(players: Player[], clubs: Club[]): LeagueOption[] {
  const map = new Map<string, LeagueOption>();
  const add = (l: string | undefined, n: number) => {
    const t = (l ?? '').trim();
    if (!t) return;
    const k = normalizeText(t);
    const cur = map.get(k);
    if (cur) cur.count += n;
    else map.set(k, { nome: t, count: n });
  };
  clubs.forEach((c) => add(c.liga, 0));
  players.forEach((p) => add(p.liga, 1));
  return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export const sameLeague = (a?: string, b?: string) => normalizeText(a ?? '') === normalizeText(b ?? '');
