const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const uid = (prefix = 'id'): string => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/%/g, ' pct ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export const slug = (s: string): string => normalizeText(s).replace(/ /g, '-');

export function fmtNum(v: number | undefined | null, decimals = 2): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '–';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtEur(v: number | null | undefined): string {
  if (v === null || v === undefined) return '–';
  if (v >= 1_000_000) return `€${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  return `€${Math.round(v / 1000).toLocaleString('pt-BR')} mil`;
}

export function fmtYm(ym: string | null | undefined): string {
  if (!ym) return '–';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MESES[m - 1]}/${String(y).slice(2)}`;
}

/** Lê "dez./26", "12/2026", "2026-12", "31/12/2026" e "dezembro de 2026" como AAAA-MM. */
export function parseYm(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (raw instanceof Date && !isNaN(raw.getTime())) return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}`;
  const s = normalizeText(String(raw));
  if (!s || s === '-') return undefined;
  const yy = (v: string) => (v.length === 2 ? `20${v}` : v);
  let m = /^(\d{4}) (\d{1,2})(?: \d{1,2})?$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = /^(?:\d{1,2} )?(\d{1,2}) (\d{2,4})$/.exec(s);
  if (m) return `${yy(m[2])}-${m[1].padStart(2, '0')}`;
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  m = /^([a-z]{3})[a-z]*(?: de)? (\d{2,4})$/.exec(s);
  if (m && names.includes(m[1])) return `${yy(m[2])}-${String(names.indexOf(m[1]) + 1).padStart(2, '0')}`;
  return undefined;
}

/**
 * Lê um número digitado. Aceita "0,38", "0.38", "1.234,5", "€5.000.000,00", "86%".
 * `countLike`: para contagens (minutos, gols) trata "2.773" como 2773.
 */
export function parseNumber(raw: string | number | undefined | null, countLike = false): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = raw.trim().replace(/\s/g, '').replace(/%$/, '');
  if (!s || !/\d/.test(s)) return null;
  s = s.replace(/[^\d.,-]/g, '');
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    if (countLike && /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  } else if (hasDot) {
    if (countLike && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lê CSV com vírgula, ponto e vírgula ou tab. Aceita aspas e quebras de linha dentro de aspas. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const count = (c: string) => first.split(c).length - 1;
  const delim = [';', '\t', ','].reduce((best, c) => (count(c) > count(best) ? c : best), ';');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Gera CSV com BOM (o Excel reconhece os acentos). Números saem com vírgula decimal. */
export function toCsv(rows: unknown[][], delimiter = ';'): string {
  const esc = (v: unknown) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v === undefined || v === null ? '' : String(v);
    return s.includes(delimiter) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(delimiter)).join('\r\n');
}
