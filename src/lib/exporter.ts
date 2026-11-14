import { METRICS } from '../data/catalog';
import type { Player } from '../types';
import { toCsv } from './format';

const BASE_HEAD = ['Nome', 'Posição', 'Idade', 'Altura (cm)', 'Nacionalidade', 'Pé dominante', 'Clube', 'Liga', 'Temporada', 'Valor de mercado (€)', 'Fim de contrato', 'Situação', 'Emprestado por', 'Fim do empréstimo', 'Opção de compra', 'Jogos', 'Titularidades', 'Minutos', 'Gols', 'Assistências', 'Cartões amarelos', 'Cartões vermelhos'];

const metricCols = () => METRICS.filter((m) => !m.derived);

export function playersToCsv(players: Player[]): string {
  const mc = metricCols();
  const head = [...BASE_HEAD, ...mc.map((m) => m.label), 'Fonte', 'Data da coleta'];
  const rows = players.map((p) => [
    p.nome, p.posicao, p.idade, p.altura, p.nacionalidade, p.pe, p.clube, p.liga, p.temporada, p.valorEur, p.contratoFim, p.situacao, p.clubeOrigem, p.fimEmprestimo, p.opcaoCompraEur,
    p.jogos, p.titular, p.minutos, p.gols, p.assist, p.amarelos, p.vermelhos,
    ...mc.map((m) => p.metrics[m.key]),
    p.fonte, p.coleta,
  ]);
  return toCsv([head, ...rows]);
}
