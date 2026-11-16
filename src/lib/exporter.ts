import type { Player } from '../types';
import { toCsv } from './format';

const BASE_HEAD = ['Nome', 'Posição', 'Idade', 'Altura (cm)', 'Nacionalidade', 'Pé dominante', 'Clube', 'Liga', 'Temporada', 'Valor de mercado (€)', 'Fim de contrato', 'Situação', 'Emprestado por', 'Fim do empréstimo', 'Opção de compra', 'Sofascore'];

export function playersToCsv(players: Player[]): string {
  const head = [...BASE_HEAD, 'Fonte', 'Data da coleta'];
  const rows = players.map((p) => [
    p.nome, p.posicao, p.idade, p.altura, p.nacionalidade, p.pe, p.clube, p.liga, p.temporada, p.valorEur, p.contratoFim, p.situacao, p.clubeOrigem, p.fimEmprestimo, p.opcaoCompraEur,
    p.sofascoreUrl,
    p.fonte, p.coleta,
  ]);
  return toCsv([head, ...rows]);
}
