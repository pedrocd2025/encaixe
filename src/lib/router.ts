import { useEffect, useState } from 'react';

/** Roteamento mínimo por hash (#/jogadores/abc). Não precisa de configuração no servidor. */
export function usePath(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [parts, setParts] = useState<string[]>(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export const go = (...parts: string[]) => {
  location.hash = '/' + parts.map(encodeURIComponent).join('/');
};

export const href = (...parts: string[]) => '#/' + parts.map(encodeURIComponent).join('/');
