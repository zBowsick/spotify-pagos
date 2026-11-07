// Formateo de dinero, fechas y CSV. Todo en COP, zona America/Bogota.
export function formatCOP(cop: number | null | undefined): string {
  if (cop == null || Number.isNaN(cop)) return '$0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(cop);
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatMonth(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

export function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
}

export function periodKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  const get = (t: string) => parts.find(x => x.type === t)!.value;
  return `${get('year')}-${get('month')}`;
}

/** Escape CSV: envolver en comillas y duplicar las internas. */
export function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) lines.push(headers.map(h => csvEscape(r[h])).join(','));
  return lines.join('\n');
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[], headers: string[]) {
  const blob = new Blob([buildCsv(rows, headers)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}