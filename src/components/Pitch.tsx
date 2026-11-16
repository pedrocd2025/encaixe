import { useRef, useState } from 'react';
import { Download, Eraser, Share2, X } from 'lucide-react';
import { Button } from './ui';
import { POSITIONS } from '../data/positions';
import { changeFormation, clamp, FORMACAO_ORDER, moveTo, placeInSlot, POS_ABBR, removeFromPitch, slotsFor } from '../lib/formations';
import { downloadBlob } from '../lib/format';
import { lineupToBlob, shortName } from '../lib/lineupImage';
import type { Escalacao, Player } from '../types';

interface Props {
  clube: string;
  lineup: Escalacao;
  players: Player[]; // elenco final (mantidos + contratados)
  onChange: (l: Escalacao) => void;
}

export default function Pitch({ clube, lineup, players, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean; px: number; py: number } | null>(null);
  const [selSlot, setSelSlot] = useState<number | null>(null);
  const [selToken, setSelToken] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const slots = slotsFor(lineup.formacao);
  const byId = new Map(players.map((p) => [p.id, p]));
  const onPitch = Object.entries(lineup.jogadores).filter(([id]) => byId.has(id));
  const used = new Set(onPitch.map(([, j]) => j.slot).filter((s) => s !== undefined));
  const bench = players.filter((p) => !lineup.jogadores[p.id]);
  const full = onPitch.length >= 11;

  const pct = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return { x: 50, y: 50 };
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
  };

  const down = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const j = lineup.jogadores[id];
    setDrag({ id, x: j.x, y: j.y, moved: false, px: e.clientX, py: e.clientY });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const { x, y } = pct(e);
    const moved = drag.moved || Math.hypot(e.clientX - drag.px, e.clientY - drag.py) > 5;
    setDrag({ ...drag, x, y, moved });
  };
  const up = () => {
    if (!drag) return;
    if (drag.moved) onChange(moveTo(lineup, drag.id, drag.x, drag.y));
    else setSelToken((s) => (s === drag.id ? null : drag.id));
    setDrag(null);
  };

  const nudge = (e: React.KeyboardEvent, id: string) => {
    const j = lineup.jogadores[id];
    const step = 2;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (d[e.key]) {
      e.preventDefault();
      onChange({ ...lineup, jogadores: { ...lineup.jogadores, [id]: { x: clamp(j.x + d[e.key][0]), y: clamp(j.y + d[e.key][1]) } } });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onChange(removeFromPitch(lineup, id));
      setSelToken(null);
    }
  };

  const addFromBench = (p: Player) => {
    if (full) return setMsg('O campo já tem 11 jogadores. Tire alguém para colocar outro.');
    setMsg('');
    onChange(placeInSlot(lineup, p.id, p.posicao, selSlot ?? undefined));
    setSelSlot(null);
  };

  const makeImage = async () => {
    setBusy(true);
    try {
      return await lineupToBlob(clube, lineup, players);
    } finally {
      setBusy(false);
    }
  };
  const fileName = `escalacao-${clube.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${lineup.formacao}.png`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && typeof File !== 'undefined';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,520px)_1fr]">
      <div>
        <div role="group" aria-label="Formação" className="mb-3 flex flex-wrap gap-1.5">
          {FORMACAO_ORDER.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={lineup.formacao === f}
              onClick={() => {
                onChange(changeFormation(lineup, f));
                setSelSlot(null);
              }}
              className={`min-h-11 cursor-pointer border-2 px-3 font-display text-lg font-bold tracking-wide ${lineup.formacao === f ? 'border-accent bg-accent text-on' : 'border-ink bg-card hover:bg-ink hover:text-bg'}`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {f}
            </button>
          ))}
        </div>

        <div
          ref={ref}
          data-testid="campo"
          className="relative aspect-[68/105] w-full select-none overflow-hidden border-[3px] border-ink"
          style={{ background: 'repeating-linear-gradient(0deg,#14573f 0,#14573f 9.09%,#0f4a35 9.09%,#0f4a35 18.18%)', touchAction: 'none' }}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDrag(null)}
        >
          <svg viewBox="0 0 68 105" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" stroke="rgba(244,241,230,.8)" strokeWidth="0.5" aria-hidden="true">
            <line x1="0" y1="52.5" x2="68" y2="52.5" />
            <circle cx="34" cy="52.5" r="9.15" />
            <circle cx="34" cy="52.5" r="0.6" fill="rgba(244,241,230,.8)" />
            <rect x="13.85" y="0" width="40.3" height="16.5" />
            <rect x="24.85" y="0" width="18.3" height="5.5" />
            <rect x="13.85" y="88.5" width="40.3" height="16.5" />
            <rect x="24.85" y="99.5" width="18.3" height="5.5" />
          </svg>

          {slots.map((s, i) =>
            used.has(i) ? null : (
              <button
                key={`s${i}`}
                type="button"
                aria-label={`Lugar vazio ${s.label} ${i + 1}`}
                aria-pressed={selSlot === i}
                onClick={() => setSelSlot((c) => (c === i ? null : i))}
                className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-dashed text-[11px] font-bold ${selSlot === i ? 'border-accent bg-accent/30 text-accent' : 'border-ink/60 text-ink/70 hover:bg-ink/10'}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
              >
                {s.label}
              </button>
            ),
          )}

          {onPitch.map(([id, j]) => {
            const p = byId.get(id) as Player;
            const d = drag?.id === id ? drag : null;
            const x = d ? d.x : j.x;
            const y = d ? d.y : j.y;
            const sel = selToken === id;
            return (
              <button
                key={id}
                type="button"
                aria-label={`${p.nome}, ${POSITIONS[p.posicao].label}. Arraste para mudar de lugar. Setas movem, Delete tira do campo.`}
                onPointerDown={(e) => down(e, id)}
                onKeyDown={(e) => nudge(e, id)}
                className="absolute z-10 flex w-24 -translate-x-1/2 -translate-y-[22px] cursor-grab flex-col items-center active:cursor-grabbing"
                style={{ left: `${x}%`, top: `${y}%`, touchAction: 'none' }}
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] text-sm font-extrabold ${sel ? 'border-ink bg-ink text-bg' : 'border-side bg-accent text-on'}`} style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
                  {POS_ABBR[p.posicao]}
                </span>
                <span className="mt-0.5 max-w-full truncate bg-side/90 px-1.5 py-0.5 text-xs font-bold uppercase leading-none text-ink" style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>
                  {shortName(p.nome)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Arraste os jogadores para onde quiser; eles não ficam presos à formação. Perto de um lugar marcado, o jogador encaixa nele.</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-lg font-bold">{onPitch.length}/11 no campo</span>
          {selToken && byId.get(selToken) && lineup.jogadores[selToken] && (
            <Button
              small
              variant="ghost"
              onClick={() => {
                onChange(removeFromPitch(lineup, selToken));
                setSelToken(null);
              }}
            >
              <X className="h-3.5 w-3.5" /> Tirar {shortName(byId.get(selToken)?.nome ?? '')} do campo
            </Button>
          )}
        </div>
        {msg && (
          <p role="status" className="text-sm font-semibold text-warn">
            {msg}
          </p>
        )}
        <div>
          <h3 className="mb-1.5">Reservas ({bench.length})</h3>
          {selSlot !== null && <p className="mb-2 text-xs text-accent">Lugar escolhido. Toque em um jogador para colocá-lo ali.</p>}
          {bench.length === 0 ? (
            <p className="text-sm text-muted">{players.length === 0 ? 'Feche o elenco acima (manter e contratar) para escalar.' : 'Todos os jogadores estão no campo.'}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {bench.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => addFromBench(p)} className="inline-flex min-h-11 cursor-pointer items-center gap-2 border-2 border-ink bg-card px-2.5 text-sm hover:bg-ink hover:text-bg">
                    <span className="font-bold">{p.nome}</span>
                    <span className="text-xs opacity-70">{POS_ABBR[p.posicao]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">Toque em um reserva para colocá-lo no campo (na linha da posição dele). Antes, toque em um lugar vazio para escolher onde.</p>
        </div>
        <div className="flex flex-wrap gap-2 border-t-2 border-ink/30 pt-4 no-print">
          <Button
            variant="accent"
            disabled={busy || onPitch.length === 0}
            onClick={async () => {
              const b = await makeImage();
              downloadBlob(b, fileName);
            }}
          >
            <Download className="h-4 w-4" /> Baixar imagem
          </Button>
          {canShare && (
            <Button
              variant="ghost"
              disabled={busy || onPitch.length === 0}
              onClick={async () => {
                const b = await makeImage();
                const f = new File([b], fileName, { type: 'image/png' });
                if (navigator.canShare({ files: [f] })) {
                  try {
                    await navigator.share({ files: [f], title: `Minha escalação do ${clube}` });
                  } catch {
                    /* cancelado */
                  }
                } else downloadBlob(b, fileName);
              }}
            >
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={onPitch.length === 0}
            onClick={() => {
              onChange({ ...lineup, jogadores: {} });
              setSelToken(null);
              setSelSlot(null);
            }}
          >
            <Eraser className="h-4 w-4" /> Limpar campo
          </Button>
        </div>
      </div>
    </div>
  );
}
