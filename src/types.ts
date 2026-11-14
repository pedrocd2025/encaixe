export type PositionKey = 'goleiro' | 'zagueiro' | 'lateral' | 'volante' | 'meia' | 'meia-atacante' | 'extremo' | 'centroavante';

export interface Player {
  id: string;
  nome: string;
  posicao: PositionKey;
  idade?: number;
  altura?: number; // cm
  nacionalidade?: string;
  pe?: string; // Direito | Esquerdo | Ambidestro
  clube: string;
  liga?: string;
  temporada?: string;
  valorEur?: number;
  contratoFim?: string; // AAAA-MM
  situacao?: string; // Contrato | Empréstimo
  /** Clube dono do contrato, quando o jogador está emprestado (o campo `clube` é onde ele joga agora). */
  clubeOrigem?: string;
  fimEmprestimo?: string;
  opcaoCompraEur?: number;
  jogos?: number;
  titular?: number;
  minutos?: number;
  gols?: number;
  assist?: number;
  amarelos?: number;
  vermelhos?: number;
  metrics: Record<string, number>; // por 90, % ou total, conforme a métrica
  fonte?: string;
  coleta?: string; // AAAA-MM-DD
  avisos?: { metrica: string; texto: string }[];
  atualizadoEm: string;
}

/** Filtros duros: escondem jogadores, não mudam a nota. */
export interface Filters {
  alturaMin?: number;
  alturaMax?: number;
  pe?: string; // '' = qualquer
  idadeMax?: number;
  valorMax?: number;
  contratoAte?: string; // AAAA-MM
  situacao?: string; // '' = todas
  soBrasil?: boolean;
  liga?: string; // '' = todas
}

/** Perfil de busca salvo no clube (ex.: "Atacante veloz e finalizador"). */
export interface Need {
  id: string;
  nome: string;
  posicao: PositionKey;
  tracos: Record<string, 1 | 2>; // 1 = desejável, 2 = essencial
  filtros: Filters;
}

export interface Club {
  id: string;
  nome: string;
  liga?: string;
  estilo: string[]; // ids de StyleMarker
  notas?: string;
  necessidades: Need[];
  atualizadoEm: string;
  /** Clube pessoal: só quem criou enxerga (guardado em users/{uid}/clubs). */
  privado?: boolean;
}

export interface Access {
  owners: string[];
  editors: string[];
}

export type Role = 'viewer' | 'editor' | 'owner';

/** Métrica criada pelo dono pelo site. A chave sempre começa com "c_". */
export interface CustomMetric {
  key: string;
  label: string;
  unit: 'por90' | 'pct' | 'total';
  better: 'high' | 'low';
  group: string;
  /** Peso por posição. Posição ausente = não usa; 0 = aparece, mas fica fora do ranking. */
  weights: Partial<Record<PositionKey, number>>;
}

export type Decisao = 'manter' | 'vender' | 'emprestar';

/** Cenário pessoal de elenco para um clube: o que fazer com cada jogador e quem contratar. */
export interface Squad {
  id: string; // id do clube
  decisoes: Record<string, Decisao>; // id do jogador -> decisão (ausente = manter)
  contratacoes: string[]; // ids de jogadores de outros clubes
  atualizadoEm: string;
}
