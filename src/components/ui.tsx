import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Variant = 'solid' | 'accent' | 'ghost' | 'danger';

export function Button({
  variant = 'solid',
  small,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-1.5 border-2 border-ink font-semibold uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
  const size = small ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  const v: Record<Variant, string> = {
    solid: 'bg-ink text-bg hover:bg-accent hover:border-accent',
    accent: 'bg-accent border-accent text-on hover:bg-ink hover:border-ink',
    ghost: 'bg-card text-ink hover:bg-ink hover:text-bg',
    danger: 'bg-card text-bad border-bad hover:bg-bad hover:text-on',
  };
  return <button type="button" className={`${base} ${size} ${v[variant]} ${className}`} {...rest} />;
}

/** Botão de exclusão em duas etapas, sem janela de confirmação. */
export function ConfirmButton({ label = 'Excluir', confirmLabel = 'Confirmar exclusão', onConfirm, small = true }: { label?: string; confirmLabel?: string; onConfirm: () => void; small?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <Button variant="accent" small={small} onClick={onConfirm}>
      {confirmLabel}
    </Button>
  ) : (
    <Button variant="danger" small={small} onClick={() => setArmed(true)}>
      {label}
    </Button>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ children, className = '', title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`bg-card border-2 border-ink print-flat ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b-2 border-ink px-4 py-2.5">
          <h2>{title}</h2>
          <div className="no-print flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'accent' | 'good' | 'warn' }) {
  const t = {
    plain: 'border-ink text-ink',
    accent: 'border-accent text-accent',
    good: 'border-good text-good',
    warn: 'border-warn text-warn',
  }[tone];
  return <span className={`inline-block border px-1.5 py-0.5 text-[11px] font-semibold leading-none ${t}`}>{children}</span>;
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-3">
      <div className="min-w-0">
        <h1 className="leading-none">{title}</h1>
        {sub && <p className="mt-1 max-w-[70ch] text-sm text-muted">{sub}</p>}
      </div>
      <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-2 border-dashed border-ink/50 px-6 py-10 text-center">
      <p className="text-base font-bold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-[56ch] text-sm text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} border-2 border-ink bg-bg`}>
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-card px-4 py-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="border-2 border-ink p-1 hover:bg-ink hover:text-bg cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

/** Barra horizontal fina. `value` entre 0 e 1. */
export function Bar({ value, tone = 'accent', label }: { value: number; tone?: 'accent' | 'pool' | 'good'; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const c = { accent: 'bg-accent', pool: 'bg-pool', good: 'bg-good' }[tone];
  return (
    <div className="h-2.5 w-full bg-sub" role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <div className={`h-full ${c}`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="border-2 border-ink bg-card px-4 py-3">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-2xl font-bold leading-none">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function TextArea({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return <textarea rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
