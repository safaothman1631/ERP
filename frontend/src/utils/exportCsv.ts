/**
 * CSV exporter — Sprint 5 add-on rollout.
 * Stringifies a row collection using a list of {key, label} columns and
 * triggers a browser download of the resulting CSV file.
 */
export interface CsvColumn {
  key: string;
  /** String preferred; non-string nodes are coerced via String(). */
  label: unknown;
}

const escapeCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  let s: string;
  if (typeof v === 'object') {
    try { s = JSON.stringify(v); } catch { s = String(v); }
  } else {
    s = String(v);
  }
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export function rowsToCsv(rows: ReadonlyArray<unknown>, columns: CsvColumn[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows
    .map((r) => {
      const obj = (r ?? {}) as Record<string, unknown>;
      return columns.map((c) => escapeCell(obj[c.key])).join(',');
    })
    .join('\r\n');
  // Prepend BOM so Excel detects UTF-8 (important for Kurdish + Arabic).
  return `\uFEFF${header}\r\n${body}`;
}

export function downloadCsv(filename: string, rows: ReadonlyArray<unknown>, columns: CsvColumn[]): void {
  const csv = rowsToCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
