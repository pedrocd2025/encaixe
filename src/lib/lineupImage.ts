import { POSITIONS } from '../data/positions';
import { POS_ABBR, slotsFor } from './formations';
import type { Escalacao, Player } from '../types';

export const shortName = (nome: string): string => {
  const parts = nome.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : parts[parts.length - 1];
};

const W = 1080;
const H = 1400;
const DISPLAY = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';

/** Desenha a escalação em uma imagem (PNG) para baixar ou compartilhar. */
export async function lineupToBlob(clube: string, lineup: Escalacao, players: Player[]): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load(`800 40px "Barlow Condensed"`), document.fonts.load(`600 24px "Barlow Condensed"`)]);
  } catch {
    /* usa a fonte reserva */
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('Não foi possível criar a imagem.');

  // gramado listrado
  for (let i = 0; i * 90 < W; i++) {
    g.fillStyle = i % 2 ? '#0d3b2b' : '#0f4230';
    g.fillRect(i * 90, 0, 90, H);
  }
  // topo
  g.fillStyle = '#08271c';
  g.fillRect(0, 0, W, 130);
  g.fillStyle = '#ffd93b';
  g.fillRect(0, 126, W, 5);
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillStyle = '#ffd93b';
  g.font = `700 26px ${DISPLAY}`;
  g.fillText('ENCAIXE · MINHA ESCALAÇÃO', 56, 38);
  g.fillStyle = '#f4f1e6';
  g.font = `800 64px ${DISPLAY}`;
  g.fillText(clube.toUpperCase(), 56, 88, 700);
  g.textAlign = 'right';
  g.fillStyle = '#ffd93b';
  g.font = `800 80px ${DISPLAY}`;
  g.fillText(lineup.formacao, W - 56, 76);

  // campo
  const pw = 720;
  const ph = 1111;
  const px = (W - pw) / 2;
  const py = 150;
  g.strokeStyle = 'rgba(244,241,230,.85)';
  g.lineWidth = 4;
  g.strokeRect(px, py, pw, ph);
  g.beginPath();
  g.moveTo(px, py + ph / 2);
  g.lineTo(px + pw, py + ph / 2);
  g.stroke();
  g.beginPath();
  g.arc(px + pw / 2, py + ph / 2, pw * 0.134, 0, Math.PI * 2);
  g.stroke();
  const boxW = pw * 0.593;
  const boxH = ph * 0.157;
  const goalW = pw * 0.27;
  const goalH = ph * 0.052;
  [[py, 1], [py + ph, -1]].forEach(([y, d]) => {
    g.strokeRect(px + (pw - boxW) / 2, d === 1 ? y : y - boxH, boxW, boxH);
    g.strokeRect(px + (pw - goalW) / 2, d === 1 ? y : y - goalH, goalW, goalH);
  });

  // jogadores
  const byId = new Map(players.map((p) => [p.id, p]));
  const slots = slotsFor(lineup.formacao);
  const entries = Object.entries(lineup.jogadores).filter(([id]) => byId.has(id));
  // lugares vazios (para o desenho não ficar sem referência)
  const used = new Set(entries.map(([, j]) => j.slot).filter((s) => s !== undefined));
  g.textAlign = 'center';
  slots.forEach((s, i) => {
    if (used.has(i)) return;
    g.setLineDash([8, 8]);
    g.strokeStyle = 'rgba(244,241,230,.45)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(px + (s.x / 100) * pw, py + (s.y / 100) * ph, 32, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  });
  for (const [id, j] of entries) {
    const p = byId.get(id) as Player;
    const x = px + (j.x / 100) * pw;
    const y = py + (j.y / 100) * ph;
    g.fillStyle = '#ffd93b';
    g.beginPath();
    g.arc(x, y, 34, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#08271c';
    g.stroke();
    g.fillStyle = '#08271c';
    g.font = `800 26px ${DISPLAY}`;
    g.fillText(POS_ABBR[p.posicao], x, y + 1);
    const name = shortName(p.nome).toUpperCase();
    g.font = `700 28px ${DISPLAY}`;
    const tw = Math.min(g.measureText(name).width + 22, 200);
    g.fillStyle = 'rgba(8,39,28,.92)';
    g.fillRect(x - tw / 2, y + 40, tw, 38);
    g.fillStyle = '#f4f1e6';
    g.fillText(name, x, y + 60, 190);
  }

  // rodapé
  const reservas = players.filter((p) => !lineup.jogadores[p.id]).map((p) => shortName(p.nome));
  g.textAlign = 'left';
  g.fillStyle = '#c9dccf';
  g.font = `600 26px ${DISPLAY}`;
  const line = reservas.length ? `Reservas: ${reservas.join(', ')}` : 'Sem reservas';
  g.fillText(line.length > 92 ? line.slice(0, 89) + '...' : line, 56, 1300, W - 112);
  g.fillStyle = '#ffd93b';
  g.font = `800 34px ${DISPLAY}`;
  g.fillText(`MONTE O SEU EM ${location.host.toUpperCase() || 'ENCAIXE'}`, 56, 1352);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png'));
}
export const posLabel = (p: Player) => POSITIONS[p.posicao].label;
