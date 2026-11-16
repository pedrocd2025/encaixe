import { fmtEur } from '../lib/format';

export interface Dot {
  id: string;
  label: string;
  value: number; // valor de mercado em euros
  score: number;
}

interface Props {
  dots: Dot[];
  visible: Set<string>;
  selected: string | null;
  onSelect: (id: string) => void;
}

const W = 680;
const H = 340;
const M = { l: 48, r: 16, t: 14, b: 40 };
const TICKS = [250_000, 1_000_000, 3_000_000, 10_000_000];

/** Nota de encaixe (vertical) contra valor de mercado (horizontal, escala logarítmica). */
export default function Scatter({ dots, visible, selected, onSelect }: Props) {
  if (!dots.length) return null;
  const minV = Math.log(200_000);
  const maxV = Math.log(20_000_000);
  const x = (v: number) => M.l + ((Math.log(Math.min(Math.max(v, 200_000), 20_000_000)) - minV) / (maxV - minV)) * (W - M.l - M.r);
  const scores = dots.map((d) => d.score);
  const lo = Math.max(0, Math.floor(Math.min(...scores) - 0.5));
  const hi = Math.min(10, Math.ceil(Math.max(...scores) + 0.5));
  const y = (s: number) => H - M.b - ((s - lo) / Math.max(1, hi - lo)) * (H - M.t - M.b);
  const yTicks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const placed = dots
    .map((d) => ({ d, cx: x(d.value), cy: y(d.score), ly: 0, anchor: 'start' as 'start' | 'end' }))
    .sort((a, b) => a.cx - b.cx);
  placed.forEach((p, i) => {
    p.anchor = p.cx > W - 90 ? 'end' : 'start';
    p.ly = p.cy + 4;
    for (let j = 0; j < i; j++) {
      const q = placed[j];
      const overlapX = Math.abs((q.anchor === 'start' ? q.cx + 10 : q.cx - 10) - (p.anchor === 'start' ? p.cx + 10 : p.cx - 10)) < 70;
      if (overlapX && Math.abs(q.ly - p.ly) < 13) p.ly = q.ly + 14;
    }
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de nota de encaixe contra valor de mercado dos jogadores">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--c-ink)" strokeOpacity="0.12" />
          <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--c-muted)" className="num">
            {t}
          </text>
        </g>
      ))}
      {TICKS.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} stroke="var(--c-ink)" strokeOpacity="0.12" />
          <text x={x(t)} y={H - M.b + 16} textAnchor="middle" fontSize="11" fill="var(--c-muted)" className="num">
            {fmtEur(t)}
          </text>
        </g>
      ))}
      <text x={(W + M.l) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--c-muted)">
        Valor de mercado (escala logarítmica)
      </text>
      <text x={12} y={(H - M.b + M.t) / 2} textAnchor="middle" fontSize="11" fill="var(--c-muted)" transform={`rotate(-90 12 ${(H - M.b + M.t) / 2})`}>
        Nota de encaixe
      </text>
      {placed.map(({ d, cx, cy, ly, anchor }) => {
        const on = visible.has(d.id);
        const sel = selected === d.id;
        return (
          <g key={d.id} onClick={() => onSelect(d.id)} style={{ cursor: 'pointer' }} opacity={on ? 1 : 0.28}>
            <title>{`${d.label}: nota ${d.score.toFixed(2)}, ${fmtEur(d.value)}`}</title>
            <circle cx={cx} cy={cy} r={sel ? 8 : 6} fill={sel ? 'var(--c-accent)' : 'var(--c-ink)'} stroke="var(--c-card)" strokeWidth="2" />
            <text x={anchor === 'end' ? cx - 10 : cx + 10} y={ly} textAnchor={anchor} fontSize="11" fontWeight={sel ? 700 : 500} fill="var(--c-ink)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
