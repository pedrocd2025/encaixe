import { parseCsv } from './format';

/** Lê um arquivo CSV ou XLSX e devolve as linhas (primeira planilha). O leitor de Excel só é carregado quando necessário. */
export async function readSheet(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets.find((w) => w.rowCount > 1) ?? wb.worksheets[0];
    if (!ws) return [];
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: unknown[] = [];
      const n = row.cellCount;
      for (let c = 1; c <= n; c++) {
        let v = row.getCell(c).value as unknown;
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
          v = o.result ?? o.text ?? (o.richText ? o.richText.map((t) => t.text).join('') : '');
        }
        vals.push(v ?? '');
      }
      rows.push(vals);
    });
    return rows;
  }
  if (name.endsWith('.xls')) throw new Error('Arquivos .xls antigos não são aceitos. Salve a planilha como .xlsx ou .csv.');
  return parseCsv(await file.text());
}
