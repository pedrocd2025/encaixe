import { useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import { Button, Card, Field, PageHeader } from '../components/ui';
import { POSITION_ORDER, POSITIONS } from '../data/catalog';
import { playersToCsv, templateCsv } from '../lib/exporter';
import { downloadBlob } from '../lib/format';
import { buildImport, type ImportResult } from '../lib/importer';
import { go } from '../lib/router';
import { readSheet } from '../lib/sheet';
import { useStore } from '../lib/store';
import type { PositionKey } from '../types';

export default function Import() {
  const { players, importPlayers, canEdit } = useStore();
  const [rows, setRows] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [pos, setPos] = useState<PositionKey>('meia-atacante');
  const [fonte, setFonte] = useState('');
  const [temporada, setTemporada] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  if (!canEdit) return <p className="text-sm">Só editores podem importar dados.</p>;

  const result: ImportResult | null = rows ? buildImport(rows, players, { defaultPosition: pos, fonte, temporada }) : null;

  const onFile = async (f: File | undefined) => {
    setErr('');
    setDone('');
    setRows(null);
    if (!f) return;
    try {
      setRows(await readSheet(f));
      setFileName(f.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não consegui ler o arquivo.');
    }
  };

  const confirm = async () => {
    if (!result || !result.players.length) return;
    setBusy(true);
    const ok = await importPlayers(result.players);
    setBusy(false);
    if (ok) {
      setDone(`${result.newCount} novo(s) e ${result.updatedCount} atualizado(s).`);
      setRows(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Importar planilha"
        sub="Envie um arquivo .xlsx ou .csv com um jogador por linha. As colunas são reconhecidas pelo título (Nome, Posição, Clube, Valor de mercado, Chances criadas por 90, Passes certos %...). Jogadores que já existem são atualizados."
        actions={
          <>
            <Button variant="ghost" onClick={() => downloadBlob(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }), 'modelo-jogadores.csv')}>
              <Download className="h-4 w-4" /> Baixar planilha-modelo
            </Button>
            <Button variant="ghost" disabled={!players.length} onClick={() => downloadBlob(new Blob([playersToCsv(players)], { type: 'text/csv;charset=utf-8' }), 'jogadores.csv')}>
              <Download className="h-4 w-4" /> Exportar a base atual
            </Button>
          </>
        }
      />
      <div className="space-y-5">
        <Card title="1. Arquivo">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Planilha (.xlsx ou .csv)" className="lg:col-span-2">
              <input type="file" accept=".xlsx,.xlsm,.csv,.txt,.tsv" onChange={(e) => onFile(e.target.files?.[0])} />
            </Field>
            <Field label="Posição padrão" hint="Usada quando a planilha não tem a coluna Posição ou ela não é reconhecida.">
              <select value={pos} onChange={(e) => setPos(e.target.value as PositionKey)}>
                {POSITION_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {POSITIONS[k].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fonte (se não houver coluna)">
              <input value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Sofascore, FotMob..." />
            </Field>
            <Field label="Temporada (se não houver coluna)">
              <input value={temporada} onChange={(e) => setTemporada(e.target.value)} placeholder="2026" />
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted">As métricas precisam estar por 90 minutos ou em %, como na planilha do curso. Arquivos .xls antigos não são aceitos: salve como .xlsx.</p>
          {err && (
            <p role="alert" className="mt-3 border-2 border-accent px-3 py-2 text-sm font-semibold text-accent">
              {err}
            </p>
          )}
          {done && (
            <p role="status" className="mt-3 border-2 border-good px-3 py-2 text-sm font-semibold text-good">
              Importação concluída: {done}{' '}
              <button type="button" className="underline" onClick={() => go('jogadores')}>
                Ver jogadores
              </button>
            </p>
          )}
        </Card>

        {result && (
          <Card title={`2. Conferir antes de salvar (${fileName})`}>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              {[
                ['Novos', result.newCount],
                ['Atualizados', result.updatedCount],
                ['Linhas ignoradas', result.skipped],
                ['Colunas reconhecidas', result.mapped.length],
              ].map(([l, v]) => (
                <div key={l as string} className="border-2 border-ink px-3 py-2">
                  <div className="text-xs font-semibold text-muted">{l}</div>
                  <div className="num text-xl font-bold">{v}</div>
                </div>
              ))}
            </div>
            {result.warnings.length > 0 && (
              <ul className="mb-4 list-disc border-2 border-warn px-3 py-2 pl-7 text-sm text-warn">
                {result.warnings.slice(0, 12).map((w) => (
                  <li key={w}>{w}</li>
                ))}
                {result.warnings.length > 12 && <li>E mais {result.warnings.length - 12} aviso(s).</li>}
              </ul>
            )}
            <details className="mb-3 text-sm">
              <summary className="cursor-pointer font-semibold">Como as colunas foram entendidas ({result.mapped.length})</summary>
              <ul className="mt-1 grid gap-x-6 pl-5 text-xs sm:grid-cols-2">
                {result.mapped.map((m) => (
                  <li key={m} className="list-disc">
                    {m}
                  </li>
                ))}
              </ul>
            </details>
            {result.ignored.length > 0 && (
              <details className="mb-3 text-sm">
                <summary className="cursor-pointer font-semibold">Colunas ignoradas ({result.ignored.length})</summary>
                <p className="mt-1 text-xs text-muted">{result.ignored.join(' · ')}</p>
              </details>
            )}
            <div className="mb-4 overflow-x-auto">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Jogador</th>
                    <th>Posição</th>
                    <th>Clube</th>
                    <th>Métricas</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {result.players.slice(0, 30).map((p) => (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.nome}</td>
                      <td>{POSITIONS[p.posicao].label}</td>
                      <td>{p.clube || '–'}</td>
                      <td className="num">{Object.keys(p.metrics).length}</td>
                      <td>{players.some((x) => x.id === p.id) ? 'Atualiza' : 'Novo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.players.length > 30 && <p className="mt-1 text-xs text-muted">Mostrando 30 de {result.players.length}.</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRows(null)}>
                Cancelar
              </Button>
              <Button variant="accent" disabled={busy || !result.players.length} onClick={confirm}>
                <FileUp className="h-4 w-4" /> {busy ? 'Salvando...' : `Salvar ${result.players.length} jogador(es)`}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
