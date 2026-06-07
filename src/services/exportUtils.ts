type ExportValue = string | number | boolean | null | undefined;

export type ExportRow = Record<string, ExportValue>;

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: ExportValue) {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: ExportRow[]) {
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(escapeCsvValue).join(';'),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(';'),
    ),
  ].join('\r\n');

  downloadBlob(filename, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
}

export function downloadJson(filename: string, rows: ExportRow[]) {
  downloadBlob(
    filename,
    JSON.stringify(rows, null, 2),
    'application/json;charset=utf-8',
  );
}
