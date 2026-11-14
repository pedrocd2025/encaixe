import { useState } from 'react';
import { Button, Card, ConfirmButton, PageHeader } from '../components/ui';
import { useStore } from '../lib/store';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Access() {
  const { role, access, saveAccess, user, mode } = useStore();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  if (role !== 'owner' || !access) return <p className="text-sm">Só os donos podem gerenciar o acesso.</p>;

  const add = async () => {
    const e = email.trim().toLowerCase();
    setErr('');
    if (!EMAIL.test(e)) return setErr('Digite um e-mail válido.');
    if (access.owners.includes(e) || access.editors.includes(e)) return setErr('Esse e-mail já tem acesso.');
    if (await saveAccess({ ...access, editors: [...access.editors, e] })) setEmail('');
  };

  return (
    <>
      <PageHeader title="Quem pode editar" sub="Qualquer pessoa pode consultar a base. Só os e-mails desta lista (conta Google) conseguem cadastrar ou alterar clubes e jogadores." />
      <div className="space-y-5">
        <Card title="Donos">
          <p className="mb-2 text-sm text-muted">Editam a base e gerenciam esta lista. Para mudar donos, edite o documento config/access no console do Firebase.</p>
          <ul className="space-y-1 text-sm">
            {access.owners.map((o) => (
              <li key={o} className="num">
                {o} {o === user?.email && <span className="text-xs text-muted">(você)</span>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Editores autorizados">
          {access.editors.length === 0 ? (
            <p className="mb-3 text-sm text-muted">Ninguém além dos donos pode editar.</p>
          ) : (
            <ul className="mb-4 divide-y divide-ink/15 text-sm">
              {access.editors.map((e) => (
                <li key={e} className="flex items-center justify-between gap-3 py-2">
                  <span className="num">{e}</span>
                  <ConfirmButton label="Remover" confirmLabel="Confirmar" onConfirm={() => saveAccess({ ...access, editors: access.editors.filter((x) => x !== e) })} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-semibold text-muted">
              Adicionar editor (e-mail da conta Google)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@gmail.com" onKeyDown={(e) => e.key === 'Enter' && add()} />
            </label>
            <Button variant="accent" onClick={add}>
              Adicionar
            </Button>
          </div>
          {err && (
            <p role="alert" className="mt-3 text-sm font-semibold text-bad">
              {err}
            </p>
          )}
          {mode === 'local' && <p className="mt-3 text-xs text-muted">Modo demonstração: esta lista só vale neste navegador. No site publicado, ela fica no Firebase.</p>}
        </Card>
      </div>
    </>
  );
}
