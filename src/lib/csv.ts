const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}