import type { Escalacao, PositionKey } from '../types';

/** Formações: linhas do goleiro ao ataque (ex.: 4-3-3 = 1 goleiro, 4, 3, 3). */
export const FORMACOES: Record<string, number[]> = {
  '3-4-3': [1, 3, 4, 3],
  '3-5-2': [1, 3, 5, 2],
  '4-4-2': [1, 4, 4, 2],
  '4-3-3': [1, 4, 3, 3],
  '4-2-3-1': [1, 4, 2, 3, 1],
  '5-3-2': [1, 5, 3, 2],
  '5-2-3': [1, 5, 2, 3],
};
export const FORMACAO_ORDER = Object.keys(FORMACOES);

export interface Slot {
  x: number; // % da largura
  y: number; // % da altura (ataque em cima, goleiro embaixo)
  row: number; // 0 = goleiro
  label: 'GOL' | 'DEF' | 'MEI' | 'ATA';
}

const SPREAD: Record<number, number[]> = { 1: [50], 2: [34, 66], 3: [20, 50, 80], 4: [13, 38, 62, 87], 5: [10, 30, 50, 70, 90] };

export function slotsFor(formacao: string): Slot[] {
  const rows = FORMACOES[formacao] ?? FORMACOES['4-3-3'];
  const out: Slot[] = [];
  const outRows = rows.length - 1;
  rows.forEach((n, r) => {
    const y = r === 0 ? 91 : 74 - (r - 1) * (60 / Math.max(outRows - 1, 1));
    const label: Slot['label'] = r === 0 ? 'GOL' : r === 1 ? 'DEF' : r === rows.length - 1 ? 'ATA' : 'MEI';
    (SPREAD[n] ?? SPREAD[1]).forEach((x) => out.push({ x, y, row: r, label }));
  });
  return out;
}

/** Linha da formação que mais combina com a posição do jogador. */
export function rowGroup(pos: PositionKey): Slot['label'] {
  if (pos === 'goleiro') return 'GOL';
  if (pos === 'zagueiro' || pos === 'lateral') return 'DEF';
  if (pos === 'volante' || pos === 'meia') return 'MEI';
  if (pos === 'meia-atacante') return 'MEI';
  return 'ATA';
}

export const POS_ABBR: Record<PositionKey, string> = { goleiro: 'GOL', zagueiro: 'ZAG', lateral: 'LAT', volante: 'VOL', meia: 'MEI', 'meia-atacante': 'MAT', extremo: 'EXT', centroavante: 'CEN' };

export const clamp = (v: number, a = 5, b = 95) => Math.min(b, Math.max(a, v));
export const emptyLineup = (formacao = '4-3-3'): Escalacao => ({ formacao, jogadores: {} });

/** Slots ainda livres, na ordem. */
export function freeSlots(l: Escalacao): number[] {
  const used = new Set(Object.values(l.jogadores).map((j) => j.slot).filter((s): s is number => s !== undefined));
  return slotsFor(l.formacao).map((_, i) => i).filter((i) => !used.has(i));
}

/** Coloca o jogador em um slot (ou no primeiro livre da linha que combina com a posição). */
export function placeInSlot(l: Escalacao, id: string, pos: PositionKey, slot?: number): Escalacao {
  if (Object.keys(l.jogadores).length >= 11 && !l.jogadores[id]) return l;
  const slots = slotsFor(l.formacao);
  const free = freeSlots({ ...l, jogadores: Object.fromEntries(Object.entries(l.jogadores).filter(([k]) => k !== id)) });
  let target = slot !== undefined && free.includes(slot) ? slot : undefined;
  if (target === undefined) {
    const g = rowGroup(pos);
    target = free.find((i) => slots[i].label === g) ?? free[0];
  }
  if (target === undefined) return l;
  return { ...l, jogadores: { ...l.jogadores, [id]: { x: slots[target].x, y: slots[target].y, slot: target } } };
}

/** Coloca o jogador em qualquer ponto do campo. Perto de um lugar da formação, ele "encaixa" nele (trocando com quem estiver lá). */
export function moveTo(l: Escalacao, id: string, x: number, y: number): Escalacao {
  const slots = slotsFor(l.formacao);
  const cur = l.jogadores[id];
  let best = -1;
  let bd = 7.5;
  slots.forEach((s, i) => {
    const d = Math.hypot(s.x - x, (s.y - y) * 0.66);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  const next = { ...l.jogadores };
  if (best >= 0) {
    const other = Object.entries(next).find(([k, v]) => k !== id && v.slot === best);
    if (other) {
      // troca: quem estava no lugar vai para onde o jogador estava
      next[other[0]] = cur ? { ...cur } : { x: clamp(x + 8), y: clamp(y + 8) };
    }
    next[id] = { x: slots[best].x, y: slots[best].y, slot: best };
  } else next[id] = { x: clamp(x), y: clamp(y) };
  return { ...l, jogadores: next };
}

export function removeFromPitch(l: Escalacao, id: string): Escalacao {
  const next = { ...l.jogadores };
  delete next[id];
  return { ...l, jogadores: next };
}

/** Troca a formação: quem estava em um lugar da formação vai para o mesmo número de lugar na nova; quem foi posto livre fica onde está. */
export function changeFormation(l: Escalacao, formacao: string): Escalacao {
  const slots = slotsFor(formacao);
  const jogadores = Object.fromEntries(
    Object.entries(l.jogadores).map(([id, j]) => [id, j.slot !== undefined && slots[j.slot] ? { x: slots[j.slot].x, y: slots[j.slot].y, slot: j.slot } : { x: j.x, y: j.y }]),
  );
  return { formacao, jogadores };
}

/** Remove da escalação quem saiu do elenco. */
export function pruneLineup(l: Escalacao, ids: Set<string>): Escalacao {
  const keep = Object.entries(l.jogadores).filter(([id]) => ids.has(id));
  return keep.length === Object.keys(l.jogadores).length ? l : { ...l, jogadores: Object.fromEntries(keep) };
}
