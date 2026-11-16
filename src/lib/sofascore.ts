/** Só aceita endereços do próprio Sofascore, para o link e o widget não apontarem para outro site. */
export function isSofascoreUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && (url.hostname === 'www.sofascore.com' || url.hostname === 'sofascore.com');
  } catch {
    return false;
  }
}

/**
 * Extrai o endereço do widget oficial. O usuário cola o código iframe que o Sofascore mostra
 * (ou o próprio endereço). Só devolve endereços https de widgets.sofascore.com; nunca usa o HTML colado.
 */
export function widgetSrc(input: string): string | null {
  const m = input.match(/src\s*=\s*["']([^"']+)["']/i);
  const raw = (m ? m[1] : input).trim().replace(/&amp;/g, '&');
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'widgets.sofascore.com' ? url.toString() : null;
  } catch {
    return null;
  }
}
