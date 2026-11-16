import { useState } from 'react';
import { analyticsAvailable, getConsent, setConsent, type Consent } from '../lib/analytics';
import { Button } from './ui';

/** Aviso de medição de acessos. Só aparece quando o Google Analytics está configurado. */
export default function CookieNotice() {
  const [consent, setC] = useState<Consent>(getConsent);
  const [reopen, setReopen] = useState(false);
  if (!analyticsAvailable) return null;
  const choose = (v: 'sim' | 'nao') => {
    setConsent(v);
    setC(v);
    setReopen(false);
  };
  if (consent === null || reopen) {
    return (
      <div role="dialog" aria-label="Medição de acessos" className="no-print fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-accent bg-side px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="max-w-[70ch] text-sm">
            Este site mede quantas pessoas acessam e quais clubes, posições e jogadores são mais vistos, usando o Google Analytics. Não identificamos você (sem nome nem e-mail). Você aceita essa medição?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => choose('nao')}>
              Recusar
            </Button>
            <Button variant="accent" onClick={() => choose('sim')}>
              Aceitar
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <footer className="no-print mx-auto max-w-6xl px-4 pb-6 text-xs text-muted">
      <button type="button" className="cursor-pointer underline" onClick={() => setReopen(true)}>
        Preferências de medição de acessos ({consent === 'sim' ? 'aceita' : 'recusada'})
      </button>
    </footer>
  );
}
