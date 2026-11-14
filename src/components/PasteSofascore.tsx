import { useMemo, useState } from 'react';
import { Button } from './ui';
import { parseSofascore } from '../lib/paste';
import { parseNumber } from '../lib/format';

export default function PasteSofascore({ jogosAtual, pesos, onApply }: { jogosAtual: string; pesos?: Record<string, number>; onApply: (fields: Record<string, string>) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [done, setDone] = useState('');
  const items = useMemo(() => (text.trim() ? parseSofascore(text, parseNumber(jogosAtual, true) ?? undefined, pesos) : []), [text, jogosAtual, pesos]);
  const used = items.filter((i) => i.target);
  const ignored = items.filter((i) => !i.target);

  return (
    <section className="border-2 border-ink bg-card p-4 no-print">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">Colar do Sofascore</h2>
          <p className="text-xs text-muted">Copie o texto da página do jogador, cole aqui e confira. O app só lê o que você colou e só usa as métricas com peso na posição do jogador.</p>
        </div>
        <Button small variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? 'Fechar' : 'Abrir'}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <textarea
            aria-label="Texto copiado do Sofascore"
            rows={6}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDone('');
            }}
            placeholder={'Jogos18\nMinutos...\nGols esperados (xG)6.58'}
          />
          {items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Linha colada</th>
                      <th>Vai para</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {used.map((i, n) => (
                      <tr key={`u${n}`}>
                        <td>
                          {i.label} <span className="num text-muted">{i.raw}</span>
                        </td>
                        <td>
                          {i.targetLabel} {i.note && <span className="text-xs text-muted">({i.note})</span>}
                        </td>
                        <td className="num font-bold">{i.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ignored.length > 0 && (
                <p className="text-xs text-muted">
                  Ignoradas ({ignored.length}): {ignored.map((i) => i.label + (i.note.startsWith('é por jogo') ? ` [${i.note}]` : '')).join('; ')}.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  small
                  variant="accent"
                  disabled={used.length === 0}
                  onClick={() => {
                    const f: Record<string, string> = {};
                    used.forEach((i) => (f[i.target as string] = i.value as string));
                    onApply(f);
                    setDone(`${used.length} campo(s) preenchido(s). Revise e clique em salvar.`);
                  }}
                >
                  Preencher {used.length} campo(s)
                </Button>
                {done && (
                  <span role="status" className="text-sm font-semibold text-good">
                    {done}
                  </span>
                )}
              </div>
            </>
          )}
          {text.trim() && items.length === 0 && <p className="text-sm text-muted">Não encontrei linhas no formato "nome valor". Cole o texto direto da página.</p>}
        </div>
      )}
    </section>
  );
}
