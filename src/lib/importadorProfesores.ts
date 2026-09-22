import * as XLSX from "xlsx";
import { prisma } from "./prisma";

export interface TeacherImportRowResult {
  rowNumber: number;
  success: boolean;
  action?: "created" | "updated" | "skipped";
  teacherId?: number;
  employeeId?: string | null;
  name?: string;
  email?: string;
  error?: string;
}

export interface TeacherImportSummary {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  results: TeacherImportRowResult[];
}

// Normaliza encabezados removiendo acentos, espacios y caracteres especiales
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Mapeo flexible de posibles nombres de columna
function matchColumn(header: string): "employeeId" | "name" | "email" | "phone" | "affiliation" | "note" | null {
  const norm = normalizeKey(header);
  
  if (
    ["notrabajador", "noempleado", "id", "iddocente", "employeeid", "nomina", "matricula", "clave", "cve"].includes(
      norm
    )
  ) {
    return "employeeId";
  }
  if (["name", "nombre", "profesor", "docente", "nombrecompleto", "nombres"].includes(norm)) {
    return "name";
  }
  if (["email", "correo", "correoinstitucional", "emailinstitucional"].includes(norm)) {
    return "email";
  }
  if (["phone", "telefono", "celular", "movil", "tel"].includes(norm)) {
    return "phone";
  }
  if (["affiliation", "adscripcion", "tipo", "fcfm"].includes(norm)) {
    return "affiliation";
  }
  if (["note", "nota", "observaciones", "comentarios"].includes(norm)) {
    return "note";
  }

  return null;
}

export async function importarProfesoresDesdeBuffer(
  buffer: Buffer
): Promise<TeacherImportSummary> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("El archivo no contiene ninguna hoja de cálculo");
  }

  const sheet = wb.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

  const summary: TeacherImportSummary = {
    totalRows: rawRows.length,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    results: [],
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2; // Considerando fila 1 como encabezados
    const row = rawRows[i];

    // Mapear campos de la fila según las columnas detectadas
    let employeeId: string | null = null;
    let name = "";
    let email = "";
    let phone: string | null = null;
    let affiliation = "Interno";
    let note: string | null = null;

    for (const [colName, val] of Object.entries(row)) {
      const field = matchColumn(colName);
      if (!field) continue;
      const strVal = String(val ?? "").trim();
      if (!strVal) continue;

      switch (field) {
        case "employeeId":
          employeeId = strVal.toUpperCase();
          break;
        case "name":
          name = strVal;
          break;
        case "email":
          email = strVal.toLowerCase();
          break;
        case "phone":
          phone = strVal.slice(0, 50);
          break;
        case "affiliation":
          affiliation = strVal.toLowerCase().includes("ext") ? "Externo" : "Interno";
          break;
        case "note":
          note = strVal;
          break;
      }
    }

    // Validar si la fila está completamente vacía
    if (!employeeId && !name && !email) {
      summary.skippedCount++;
      summary.results.push({
        rowNumber: rowNum,
        success: true,
        action: "skipped",
        error: "Fila vacía o sin campos reconocibles",
      });
      continue;
    }

    // Validaciones mínimas
    if (!name) {
      summary.errorCount++;
      summary.results.push({
        rowNumber: rowNum,
        success: false,
        employeeId,
        email,
        error: "El campo Nombre es requerido",
      });
      continue;
    }

    if (!email) {
      if (employeeId) {
        email = `${employeeId.toLowerCase()}@correo.buap.mx`;
      } else {
        summary.errorCount++;
        summary.results.push({
          rowNumber: rowNum,
          success: false,
          name,
          employeeId,
          error: "El campo Correo es requerido",
        });
        continue;
      }
    }

    if (!emailRegex.test(email)) {
      summary.errorCount++;
      summary.results.push({
        rowNumber: rowNum,
        success: false,
        name,
        email,
        error: `Formato de correo inválido: '${email}'`,
      });
      continue;
    }

    try {
      // Buscar si ya existe por employeeId o por email
      let existing = null;
      if (employeeId) {
        existing = await prisma.teacher.findFirst({
          where: { employeeId },
        });
      }
      if (!existing && email) {
        existing = await prisma.teacher.findUnique({
          where: { email },
        });
      }

      if (existing) {
        // Actualizar datos del docente sin tocar relaciones (peticiones, asignaciones, experiencia)
        const updated = await prisma.teacher.update({
          where: { id: existing.id },
          data: {
            name: name || existing.name,
            email: email || existing.email,
            employeeId: employeeId || existing.employeeId,
            phone: phone !== null ? phone : existing.phone,
            affiliation: affiliation || existing.affiliation,
            note: note !== null ? note : existing.note,
          },
        });
        summary.updatedCount++;
        summary.results.push({
          rowNumber: rowNum,
          success: true,
          action: "updated",
          teacherId: updated.id,
          employeeId: updated.employeeId,
          name: updated.name,
          email: updated.email,
        });
      } else {
        // Crear nuevo docente
        const created = await prisma.teacher.create({
          data: {
            name,
            email,
            employeeId,
            phone,
            affiliation,
            note,
          },
        });
        summary.createdCount++;
        summary.results.push({
          rowNumber: rowNum,
          success: true,
          action: "created",
          teacherId: created.id,
          employeeId: created.employeeId,
          name: created.name,
          email: created.email,
        });
      }
    } catch (err: any) {
      summary.errorCount++;
      summary.results.push({
        rowNumber: rowNum,
        success: false,
        name,
        email,
        error: err?.message || String(err),
      });
    }
  }

  return summary;
}

export function generarPlantillaProfesoresCSV(): string {
  const headers = ["No_Trabajador", "Nombre", "Correo_Institucional", "Celular", "Adscripcion", "Nota"];
  const rows = [
    ["100123456", "GARCÍA LÓPEZ JUAN CARLOS", "juan.garcia@correo.buap.mx", "2221234567", "Interno", "Profesor TC"],
    ["100654321", "RODRÍGUEZ MARTÍNEZ MARÍA ELENA", "elena.rodriguez@correo.buap.mx", "2229876543", "Interno", "Hora clase"],
    ["100789012", "SÁNCHEZ PÉREZ ROBERTO", "roberto.sanchez@correo.buap.mx", "", "Externo", "Facultad de Ingeniería"],
  ];

  const csvLines = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))];
  return csvLines.join("\n");
}
