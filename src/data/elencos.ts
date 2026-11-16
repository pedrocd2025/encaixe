import type { Player, PositionKey } from '../types';
import { slug, todayISO } from '../lib/format';

interface Linha {
  nome: string;
  pos: PositionKey;
  nac: string;
}

/**
 * Elenco do Fluminense conforme a lista que você enviou (nome, posição e bandeira).
 * Idade, contrato e valor ficam em branco: preencha na tabela.
 * Atenção: a lista só diz "A" (atacante); aqui entraram como extremo, exceto Cano e John Kennedy (centroavante). Confira.
 */
export const ELENCO_FLUMINENSE: Linha[] = [
  { nome: 'Fábio', pos: 'goleiro', nac: 'Brasil' },
  { nome: 'Marcelo Pitaluga', pos: 'goleiro', nac: 'Brasil' },
  { nome: 'Vitor Eudes', pos: 'goleiro', nac: 'Brasil' },
  { nome: 'Samuel Xavier', pos: 'lateral', nac: 'Brasil' },
  { nome: 'Guilherme Arana', pos: 'lateral', nac: 'Brasil' },
  { nome: 'Renê', pos: 'lateral', nac: 'Brasil' },
  { nome: 'Guga', pos: 'lateral', nac: 'Brasil' },
  { nome: 'Julio Fidélis', pos: 'lateral', nac: 'Brasil' },
  { nome: 'Thiago Silva', pos: 'zagueiro', nac: 'Brasil' },
  { nome: 'Ignácio', pos: 'zagueiro', nac: 'Brasil' },
  { nome: 'Igor Rabello', pos: 'zagueiro', nac: 'Brasil' },
  { nome: 'Freytes', pos: 'zagueiro', nac: 'Argentina' },
  { nome: 'Millán', pos: 'zagueiro', nac: 'Colômbia' },
  { nome: 'Jemmes', pos: 'zagueiro', nac: 'Brasil' },
  { nome: 'Martinelli', pos: 'volante', nac: 'Brasil' },
  { nome: 'Nonato', pos: 'volante', nac: 'Brasil' },
  { nome: 'Alisson', pos: 'volante', nac: 'Brasil' },
  { nome: 'Hércules', pos: 'volante', nac: 'Brasil' },
  { nome: 'Otávio', pos: 'volante', nac: 'Brasil' },
  { nome: 'Savarino', pos: 'meia', nac: 'Venezuela' },
  { nome: 'PH Ganso', pos: 'meia-atacante', nac: 'Brasil' },
  { nome: 'Lucho Acosta', pos: 'meia-atacante', nac: 'Argentina' },
  { nome: 'Hulk', pos: 'extremo', nac: 'Brasil' },
  { nome: 'John Kennedy', pos: 'centroavante', nac: 'Brasil' },
  { nome: 'Germán Cano', pos: 'centroavante', nac: 'Argentina' },
  { nome: 'Matheus Reis', pos: 'extremo', nac: 'Brasil' },
  { nome: 'Canobbio', pos: 'extremo', nac: 'Uruguai' },
  { nome: 'Castillo', pos: 'extremo', nac: 'Argentina' },
  { nome: 'Riquelme', pos: 'extremo', nac: 'Brasil' },
  { nome: 'Soteldo', pos: 'extremo', nac: 'Venezuela' },
  { nome: 'Wesley Natã', pos: 'extremo', nac: 'Brasil' },
  { nome: 'Kevin Serna', pos: 'extremo', nac: 'Colômbia' },
];

/** Só devolve jogadores que ainda não existem naquele clube (mesmo nome, ignorando acentos). Nunca altera quem já está na base. */
export function rosterToPlayers(linhas: Linha[], clubeNome: string, existentes: Player[], norm: (s: string) => string, sameClub: (a: string, b: string) => boolean): Player[] {
  const have = new Set(existentes.filter((p) => sameClub(p.clube, clubeNome)).map((p) => norm(p.nome)));
  const used = new Set(existentes.map((p) => p.id));
  const out: Player[] = [];
  for (const l of linhas) {
    if (have.has(norm(l.nome))) continue;
    let id = slug(l.nome);
    if (used.has(id)) id = `${id}-${slug(clubeNome)}`;
    for (let i = 2; used.has(id); i++) id = `${slug(l.nome)}-${slug(clubeNome)}-${i}`;
    used.add(id);
    out.push({ id, nome: l.nome, posicao: l.pos, nacionalidade: l.nac, clube: clubeNome, situacao: 'Contrato', metrics: {}, fonte: 'Lista do elenco enviada por você', coleta: todayISO(), atualizadoEm: todayISO() });
  }
  return out;
}
