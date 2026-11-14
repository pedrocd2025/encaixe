import { normalizeText, slug } from './format';

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

/** Dois nomes que provavelmente são a mesma pessoa: "G. Scarpa" e "Gustavo Scarpa", "Evander" e "Evander Ferreira", erro de digitação. */
export function similarNames(a: string, b: string): boolean {
  const ta = normalizeText(a).split(' ').filter(Boolean);
  const tb = normalizeText(b).split(' ').filter(Boolean);
  if (!ta.length || !tb.length) return false;
  const na = ta.join(' ');
  const nb = tb.join(' ');
  if (na === nb) return true;
  if (na.length > 4 && nb.length > 4 && levenshtein(na, nb) <= 2) return true;
  // mesmo sobrenome e o primeiro nome é a inicial ou o começo do outro ("G. Scarpa" x "Gustavo Scarpa")
  if (ta.length > 1 && tb.length > 1 && ta[ta.length - 1] === tb[tb.length - 1]) {
    const fa = ta[0].replace(/\.$/, '');
    const fb = tb[0].replace(/\.$/, '');
    if (fa.startsWith(fb) || fb.startsWith(fa)) return true;
  }
  // um nome contém todas as palavras do outro ("Evander" x "Evander Ferreira")
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.some((t) => t.length >= 4) && short.every((t) => long.includes(t))) return true;
  return false;
}

/** Gera um id livre: nome; se já existir (homônimo), nome-clube; se ainda existir, nome-clube-2... */
export function uniqueId(nome: string, clube: string, used: Set<string>): string {
  const base = slug(nome) || `j-${Date.now()}`;
  if (!used.has(base)) return base;
  const withClub = clube ? `${base}-${slug(clube)}` : base;
  let id = withClub;
  for (let i = 2; used.has(id); i++) id = `${withClub}-${i}`;
  return id;
}
