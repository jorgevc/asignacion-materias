import * as XLSX from "xlsx";

export type ParsedExcel = {
  headers: string[];
  rows: string[][]; // data rows (excluding header)
  totalRows: number;
};

export function parseExcelBuffer(buffer: Buffer): ParsedExcel {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel sin hojas");
  const sheet = wb.Sheets[sheetName];
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  if (json.length === 0) throw new Error("Excel vacío");
  // Filter out completely empty rows
  const filtered = json.filter((row) => row.some((c) => String(c).trim() !== ""));
  if (filtered.length === 0) throw new Error("Excel sin datos");
  const headers = filtered[0].map((h) => String(h).trim());
  const rows = filtered.slice(1).map((r) => r.map((c) => String(c).trim()));
  return { headers, rows, totalRows: rows.length };
}

export function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, " ");
}

export function suggestMapping(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  const targetFields = ["code", "name", "cupo", "dias", "horario", "ubicacion"] as const;
  // alias definitions
  const aliases: Record<string, string[]> = {
    code: ["code", "codigo", "código", "clave", "cod", "mat_code", "codigo materia"],
    name: ["name", "nombre", "materia", "asignatura", "curso", "materia nombre"],
    cupo: ["cupo", "capacidad", "cupos", "cap", "plazas", "cupo max", "capacity"],
    dias: ["dias", "días", "days", "dia", "día", "dias semana"],
    horario: ["horario", "hora", "horas", "schedule", "hour", "horario clase"],
    ubicacion: ["ubicacion", "ubicación", "aula", "salon", "salón", "location", "sala", "lugar", "edificio"],
  };

  const used = new Set<string>();
  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (!norm) return;
    for (const field of targetFields) {
      if (used.has(field)) continue;
      const al = aliases[field];
      if (al.some((a) => norm === a || norm.includes(a))) {
        map[idx] = field;
        used.add(field);
        break;
      }
    }
  });
  return map;
}

export function transformUrlForDownload(url: string): string {
  // SharePoint: try to add download=1 if not present, or convert sharing link
  // For generic, just return as is
  try {
    const u = new URL(url);
    // SharePoint personal link handling: if contains sharepoint and not download param, add download=1
    if (u.hostname.includes("sharepoint.com") || u.hostname.includes("my.sharepoint")) {
      if (!u.searchParams.has("download")) {
        u.searchParams.set("download", "1");
      }
    }
    // Google Sheets: convert to export? If google sheets url without export, try to append export?format=xlsx
    if (u.hostname.includes("docs.google.com") && u.pathname.includes("/spreadsheets/")) {
      // keep as is, but hint
    }
    return u.toString();
  } catch {
    return url;
  }
}
