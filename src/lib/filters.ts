import { normalizeText } from './format';
import type { Filters, Player } from '../types';

export const sameClub = (playerClub: string, clubName: string): boolean => {
  const a = normalizeText(playerClub);
  const b = normalizeText(clubName);
  return b !== '' && (a === b || a.startsWith(b + ' '));
};

export const isBrazilian = (liga?: string) => /brasil/i.test(liga ?? '');

export function passesFilters(p: Player, f: Filters): boolean {
  if (f.alturaMin && (p.altura ?? 0) < f.alturaMin) return false;
  if (f.alturaMax && (!p.altura || p.altura > f.alturaMax)) return false;
  if (f.pe && normalizeText(p.pe ?? '') !== normalizeText(f.pe)) return false;
  if (f.idadeMax && (p.idade ?? 999) > f.idadeMax) return false;
  if (f.valorMax !== undefined && f.valorMax !== null && (p.valorEur ?? Infinity) > f.valorMax) return false;
  if (f.contratoAte && (!p.contratoFim || p.contratoFim > f.contratoAte)) return false;
  if (f.situacao && p.situacao !== f.situacao) return false;
  if (f.soBrasil && !isBrazilian(p.liga)) return false;
  if (f.liga && normalizeText(p.liga ?? '') !== normalizeText(f.liga)) return false;
  return true;
}
