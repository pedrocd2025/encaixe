import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { POSITIONS } from '../data/positions';
import { fmtEur, fmtYm } from '../lib/format';
import { isSofascoreUrl, widgetSrc } from '../lib/sofascore';
import type { Player } from '../types';
import { Button, Tag } from './ui';

export function Opportunity({ p }: { p: Player }) {
  if (p.situacao === 'Empréstimo')
    return (
      <span className="flex flex-wrap gap-1">
        <Tag tone="warn">Empréstimo{p.clubeOrigem ? ` de ${p.clubeOrigem}` : ''}{p.fimEmprestimo ? ` até ${fmtYm(p.fimEmprestimo)}` : ''}</Tag>
        {p.opcaoCompraEur ? <Tag>Opção de compra {fmtEur(p.opcaoCompraEur)}</Tag> : null}
      </span>
    );
  if (!p.contratoFim) return <Tag>Contrato não informado</Tag>;
  if (p.contratoFim <= '2026-12') return <Tag tone="good">Contrato termina em {fmtYm(p.contratoFim)}</Tag>;
  return <Tag>Contrato até {fmtYm(p.contratoFim)}</Tag>;
}

export default function PlayerDetail({ player: p }: { player: Player }) {
  const [open, setOpen] = useState(false);
  const widget = p.sofascoreWidget ? widgetSrc(p.sofascoreWidget) : null;
  const link = p.sofascoreUrl && isSofascoreUrl(p.sofascoreUrl) ? p.sofascoreUrl : null;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Tag>{POSITIONS[p.posicao].label}</Tag>
        {p.idade !== undefined && <Tag>{p.idade} anos</Tag>}
        {p.altura && <Tag>{p.altura} cm</Tag>}
        {p.pe && <Tag>Pé {p.pe.toLowerCase()}</Tag>}
        {p.nacionalidade && <Tag>{p.nacionalidade}</Tag>}
        <Opportunity p={p} />
      </div>
      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 border-b border-ink/20 py-1">
          <dt className="text-muted">Clube</dt>
          <dd className="font-semibold">{p.clube}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-ink/20 py-1">
          <dt className="text-muted">Liga</dt>
          <dd className="font-semibold">{p.liga ?? '–'}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-ink/20 py-1">
          <dt className="text-muted">Valor de mercado</dt>
          <dd className="num font-semibold">{p.valorEur ? fmtEur(p.valorEur) : '–'}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-ink/20 py-1">
          <dt className="text-muted">Fim do contrato</dt>
          <dd className="num font-semibold">{p.contratoFim ? fmtYm(p.contratoFim) : '–'}</dd>
        </div>
      </dl>
      {(link || widget) && (
        <div className="mt-5 no-print">
          <div className="flex flex-wrap gap-2">
            {widget && (
              <Button variant={open ? 'ghost' : 'accent'} onClick={() => setOpen((o) => !o)}>
                {open ? 'Fechar Sofascore' : 'Ver estatísticas do Sofascore aqui'}
              </Button>
            )}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 border-2 border-ink px-3 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-bg">
                <ExternalLink className="h-4 w-4" /> Abrir no Sofascore
              </a>
            )}
          </div>
          {widget && open && (
            <div className="mt-3">
              <iframe
                title={`Sofascore: ${p.nome}`}
                src={widget}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                className="h-[568px] w-full max-w-[730px] border-2 border-ink bg-white"
              />
              <p className="mt-1 text-xs text-muted">Conteúdo do Sofascore, mostrado pelo widget oficial. Se o quadro ficar em branco, use “Abrir no Sofascore”.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
