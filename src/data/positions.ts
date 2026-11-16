import type { PositionKey } from '../types';

export const POSITIONS: Record<PositionKey, { label: string }> = {
  goleiro: { label: 'Goleiro' },
  zagueiro: { label: 'Zagueiro' },
  lateral: { label: 'Lateral / Ala' },
  volante: { label: 'Volante' },
  meia: { label: 'Meia central' },
  'meia-atacante': { label: 'Meia atacante' },
  extremo: { label: 'Extremo / Ponta' },
  centroavante: { label: 'Centroavante' },
};

export const POSITION_ORDER: PositionKey[] = ['goleiro', 'zagueiro', 'lateral', 'volante', 'meia', 'meia-atacante', 'extremo', 'centroavante'];
