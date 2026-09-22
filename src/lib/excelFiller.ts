import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

export interface ColumnMapping {
  codeCol: number; // 1-based index
  nameCol?: number;
  horarioCol?: number;
  diasCol?: number;
  teacherIdCol?: number;
  teacherNameCol?: number;
}

export interface HeaderInfo {
  index: number; // 1-based index
  name: string;
}

export interface AnalysisResult {
  headerRowIndex: number;
  headers: HeaderInfo[];
  suggestedMapping: ColumnMapping;
  isAmbiguous: boolean;
  ambiguityReason?: string;
  totalExcelRows: number;
  matchedCount: number;
  vacantCount: number;
  extraCoursesInExcel: Array<{
    row: number;
    code: string;
    name: string;
    horario?: string;
  }>;
  missingAssignmentsInExcel: Array<{
    assignmentId: number;
    courseCode: string;
    courseName: string;
    horario?: string;
    dias?: string;
    teacherName: string;
    employeeId?: string;
    slotNo: number;
  }>;
}

export interface DbCourseAssignment {
  id: number; // assignment id
  courseId: number;
  courseCode: string;
  courseName: string;
  dias?: string | null;
  horario?: string | null;
  slotNo: number;
  teacher: {
    id: number;
    name: string;
    employeeId?: string | null;
    email: string;
  };
}

export interface DbCourseInfo {
  id: number;
  code: string;
  name: string;
  dias?: string | null;
  horario?: string | null;
}

function cleanCellText(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if ("text" in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).text).trim();
    }
    if ("result" in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).result).trim();
    }
  }
  return String(val).trim();
}

export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Carga un Buffer en un Workbook de ExcelJS.
 * Si el archivo es un .xls legacy o HTML exportado, SheetJS lo convierte transparentemente a .xlsx.
 */
export async function loadWorkbookFromBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    return wb;
  } catch {
    // Si falla (por ejemplo formato BIFF8 / HTML de Banner), convertir con SheetJS
    const sheetWb = XLSX.read(buffer, { type: "buffer" });
    const xlsxBuf = XLSX.write(sheetWb, { type: "buffer", bookType: "xlsx" });
    const convertedWb = new ExcelJS.Workbook();
    await convertedWb.xlsx.load(xlsxBuf);
    return convertedWb;
  }
}

/**
 * Encuentra la fila que contiene los encabezados en la hoja de trabajo.
 */
export function findHeaderRow(worksheet: ExcelJS.Worksheet): { rowIndex: number; headers: HeaderInfo[] } {
  let bestRowIndex = 1;
  let maxHeaders = 0;
  let bestHeaders: HeaderInfo[] = [];

  const maxRowsToCheck = Math.min(worksheet.rowCount, 10);
  for (let r = 1; r <= maxRowsToCheck; r++) {
    const row = worksheet.getRow(r);
    const headers: HeaderInfo[] = [];
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const txt = cleanCellText(cell.value);
      if (txt) {
        headers.push({ index: colNumber, name: txt });
      }
    });

    if (headers.length > maxHeaders) {
      maxHeaders = headers.length;
      bestRowIndex = r;
      bestHeaders = headers;
    }
  }

  return { rowIndex: bestRowIndex, headers: bestHeaders };
}

/**
 * Detecta automáticamente las columnas relevantes en base a los encabezados.
 */
export function detectColumns(headers: HeaderInfo[]): {
  mapping: ColumnMapping;
  isAmbiguous: boolean;
  reason?: string;
} {
  const mapping: Partial<ColumnMapping> = {};
  const codeMatches: HeaderInfo[] = [];
  const nameMatches: HeaderInfo[] = [];
  const horarioMatches: HeaderInfo[] = [];
  const diasMatches: HeaderInfo[] = [];
  const teacherIdMatches: HeaderInfo[] = [];
  const teacherNameMatches: HeaderInfo[] = [];

  for (const h of headers) {
    const norm = normalizeText(h.name);
    if (!norm) continue;

    // ID Docente
    if (
      norm.includes("iddocente") ||
      norm.includes("idprofesor") ||
      norm.includes("noempleado") ||
      norm.includes("numempleado") ||
      norm.includes("empleadoid") ||
      norm.includes("employeeid") ||
      norm.includes("idonocol") ||
      norm.includes("nocol") ||
      norm.includes("idcol") ||
      norm.includes("colaborador") ||
      norm.includes("trabajador") ||
      norm === "id1" ||
      (norm === "id" && headers.some((other) => normalizeText(other.name).includes("docente") || normalizeText(other.name).includes("profesor")))
    ) {
      teacherIdMatches.push(h);
    }
    // Nombre Profesor / Docente
    else if (
      norm.includes("profesor") ||
      norm.includes("docente") ||
      norm.includes("maestro") ||
      norm.includes("catedratico")
    ) {
      teacherNameMatches.push(h);
    }
    // Clave / Código
    else if (
      norm.includes("clave") ||
      norm.includes("codigo") ||
      norm.includes("code") ||
      norm.includes("cve") ||
      norm.includes("nrc")
    ) {
      codeMatches.push(h);
    }
    // Nombre de la Materia
    else if (
      norm.includes("materia") ||
      norm.includes("asignatura") ||
      norm.includes("curso") ||
      norm === "nombre"
    ) {
      nameMatches.push(h);
    }
    // Horario / Hora
    else if (norm.includes("horario") || norm.includes("hora") || norm.includes("schedule")) {
      horarioMatches.push(h);
    }
    // Días
    else if (norm.includes("dia") || norm.includes("days")) {
      diasMatches.push(h);
    }
  }

  let isAmbiguous = false;
  const reasons: string[] = [];

  // Resolver Código
  if (codeMatches.length === 1) {
    mapping.codeCol = codeMatches[0].index;
  } else if (codeMatches.length > 1) {
    // Preferir uno que tenga 'clave' o 'codigo' exacto sobre 'nrc'
    const best = codeMatches.find((c) => {
      const n = normalizeText(c.name);
      return n === "clave" || n === "codigo" || n === "cve" || n === "clavemateria";
    }) || codeMatches[0];
    mapping.codeCol = best.index;
    isAmbiguous = true;
    reasons.push(`Múltiples columnas posibles para Código (${codeMatches.map((c) => c.name).join(", ")}). Se preseleccionó "${best.name}".`);
  } else {
    isAmbiguous = true;
    reasons.push("No se encontró automáticamente la columna de Código/Clave de materia.");
  }

  // Nombre Materia
  if (nameMatches.length >= 1) {
    mapping.nameCol = nameMatches[0].index;
  }

  // Horario
  if (horarioMatches.length >= 1) {
    mapping.horarioCol = horarioMatches[0].index;
  }

  // Días
  if (diasMatches.length >= 1) {
    mapping.diasCol = diasMatches[0].index;
  }

  // ID Docente
  if (teacherIdMatches.length === 1) {
    mapping.teacherIdCol = teacherIdMatches[0].index;
  } else if (teacherIdMatches.length > 1) {
    mapping.teacherIdCol = teacherIdMatches[0].index;
    isAmbiguous = true;
    reasons.push(`Múltiples columnas para ID Docente (${teacherIdMatches.map((c) => c.name).join(", ")}).`);
  }

  // Nombre Docente
  if (teacherNameMatches.length === 1) {
    mapping.teacherNameCol = teacherNameMatches[0].index;
  } else if (teacherNameMatches.length > 1) {
    mapping.teacherNameCol = teacherNameMatches[0].index;
    isAmbiguous = true;
    reasons.push(`Múltiples columnas para Profesor/Docente (${teacherNameMatches.map((c) => c.name).join(", ")}).`);
  }

  return {
    mapping: mapping as ColumnMapping,
    isAmbiguous,
    reason: reasons.join(" "),
  };
}

/**
 * Analiza el Excel y compara contra la base de datos de materias y asignaciones.
 */
export async function analyzeExcelFill(
  buffer: Buffer,
  dbCourses: DbCourseInfo[],
  dbAssignments: DbCourseAssignment[],
  customMapping?: Partial<ColumnMapping>
): Promise<AnalysisResult> {
  const wb = await loadWorkbookFromBuffer(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El archivo Excel no contiene ninguna hoja.");

  const { rowIndex: headerRowIndex, headers } = findHeaderRow(ws);
  const detected = detectColumns(headers);
  const mapping: ColumnMapping = {
    codeCol: customMapping?.codeCol || detected.mapping.codeCol,
    nameCol: customMapping?.nameCol || detected.mapping.nameCol,
    horarioCol: customMapping?.horarioCol || detected.mapping.horarioCol,
    diasCol: customMapping?.diasCol || detected.mapping.diasCol,
    teacherIdCol: customMapping?.teacherIdCol || detected.mapping.teacherIdCol,
    teacherNameCol: customMapping?.teacherNameCol || detected.mapping.teacherNameCol,
  };

  if (!mapping.codeCol) {
    return {
      headerRowIndex,
      headers,
      suggestedMapping: mapping,
      isAmbiguous: true,
      ambiguityReason: "Se requiere especificar la columna de Código/Clave de la materia.",
      totalExcelRows: 0,
      matchedCount: 0,
      vacantCount: 0,
      extraCoursesInExcel: [],
      missingAssignmentsInExcel: [],
    };
  }

  // Pre-indexar cursos y asignaciones de la DB
  const dbCoursesByNormCode = new Map<string, DbCourseInfo[]>();
  for (const c of dbCourses) {
    const k = normalizeText(c.code);
    const list = dbCoursesByNormCode.get(k) || [];
    list.push(c);
    dbCoursesByNormCode.set(k, list);
  }

  const assignmentsByCourseId = new Map<number, DbCourseAssignment>();
  for (const a of dbAssignments) {
    assignmentsByCourseId.set(a.courseId, a);
  }

  const usedCourseIds = new Set<number>();
  const matchedAssignmentIds = new Set<number>();
  const extraCoursesInExcel: AnalysisResult["extraCoursesInExcel"] = [];
  let matchedCount = 0;
  let vacantCount = 0;
  let totalExcelRows = 0;

  for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const codeVal = cleanCellText(row.getCell(mapping.codeCol).value);
    const nameVal = mapping.nameCol ? cleanCellText(row.getCell(mapping.nameCol).value) : "";
    const horarioVal = mapping.horarioCol ? cleanCellText(row.getCell(mapping.horarioCol).value) : "";
    const diasVal = mapping.diasCol ? cleanCellText(row.getCell(mapping.diasCol).value) : "";

    if (!codeVal && !nameVal) continue; // Fila vacía
    totalExcelRows++;

    const normCode = normalizeText(codeVal);
    const normHorario = normalizeText(horarioVal);
    const normDias = normalizeText(diasVal);

    const candidateCourses = dbCoursesByNormCode.get(normCode);

    if (!candidateCourses || candidateCourses.length === 0) {
      // Materia extra en el Excel que no está en la base de datos
      extraCoursesInExcel.push({
        row: r,
        code: codeVal,
        name: nameVal,
        horario: horarioVal || undefined,
      });
      continue;
    }

    // Buscar coincidencia jerárquica: Horario+Días > Horario > Días > Primer candidato disponible
    const available = candidateCourses.filter((c) => !usedCourseIds.has(c.id));
    const pool = available.length > 0 ? available : candidateCourses;

    let matchedCourse: DbCourseInfo | undefined;
    if (pool.length === 1) {
      matchedCourse = pool[0];
    } else {
      // Tier 1: Coincidencia exacta en Horario Y Días
      if (normHorario && normDias) {
        matchedCourse = pool.find(
          (c) => normalizeText(c.horario || "") === normHorario && normalizeText(c.dias || "") === normDias
        );
      }
      // Tier 2: Coincidencia exacta en Horario
      if (!matchedCourse && normHorario) {
        matchedCourse = pool.find((c) => normalizeText(c.horario || "") === normHorario);
      }
      // Tier 3: Coincidencia exacta en Días
      if (!matchedCourse && normDias) {
        matchedCourse = pool.find((c) => normalizeText(c.dias || "") === normDias);
      }
      // Tier 4: Primero en pool disponible
      if (!matchedCourse) {
        matchedCourse = pool[0];
      }
    }

    if (matchedCourse) {
      usedCourseIds.add(matchedCourse.id);
      const assignment = assignmentsByCourseId.get(matchedCourse.id);
      if (assignment) {
        matchedCount++;
        matchedAssignmentIds.add(assignment.id);
      } else {
        vacantCount++;
      }
    }
  }

  // Identificar asignaciones en DB que no se emparejaron con ninguna fila del Excel
  const missingAssignmentsInExcel: AnalysisResult["missingAssignmentsInExcel"] = [];
  for (const a of dbAssignments) {
    if (!matchedAssignmentIds.has(a.id)) {
      missingAssignmentsInExcel.push({
        assignmentId: a.id,
        courseCode: a.courseCode,
        courseName: a.courseName,
        horario: a.horario || undefined,
        dias: a.dias || undefined,
        teacherName: a.teacher.name,
        employeeId: a.teacher.employeeId || undefined,
        slotNo: a.slotNo,
      });
    }
  }

  return {
    headerRowIndex,
    headers,
    suggestedMapping: mapping,
    isAmbiguous: detected.isAmbiguous,
    ambiguityReason: detected.reason,
    totalExcelRows,
    matchedCount,
    vacantCount,
    extraCoursesInExcel,
    missingAssignmentsInExcel,
  };
}

/**
 * Realiza el rellenado efectivo del archivo Excel:
 * - Llena ID y Profesor en materias asignadas.
 * - Deja vacías las materias sin asignar.
 * - Agrega al final y colorea de amarillo las asignaciones en DB ausentes en el Excel.
 * - Retorna el buffer del libro generado.
 */
export async function processAndFillExcel(
  buffer: Buffer,
  dbCourses: DbCourseInfo[],
  dbAssignments: DbCourseAssignment[],
  userMapping?: Partial<ColumnMapping>
): Promise<{
  filledBuffer: Buffer;
  analysis: AnalysisResult;
}> {
  const wb = await loadWorkbookFromBuffer(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El archivo Excel no contiene ninguna hoja.");

  const { rowIndex: headerRowIndex, headers } = findHeaderRow(ws);
  const detected = detectColumns(headers);

  const codeCol = userMapping?.codeCol || detected.mapping.codeCol;
  const nameCol = userMapping?.nameCol || detected.mapping.nameCol;
  const horarioCol = userMapping?.horarioCol || detected.mapping.horarioCol;
  const diasCol = userMapping?.diasCol || detected.mapping.diasCol;

  if (!codeCol) {
    throw new Error("Columna de código de materia no especificada o no detectada.");
  }

  // Determinar columnas de ID y Nombre de Profesor.
  // Si no existen en el archivo original, las creamos al final de la cabecera.
  let teacherIdCol = userMapping?.teacherIdCol || detected.mapping.teacherIdCol;
  let teacherNameCol = userMapping?.teacherNameCol || detected.mapping.teacherNameCol;

  const headerRow = ws.getRow(headerRowIndex);
  const sampleHeaderCell = headerRow.getCell(codeCol);

  if (!teacherIdCol) {
    teacherIdCol = ws.columnCount + 1;
    const cell = headerRow.getCell(teacherIdCol);
    cell.value = "ID_Docente";
    if (sampleHeaderCell.font) cell.font = { ...sampleHeaderCell.font };
    if (sampleHeaderCell.fill) cell.fill = { ...sampleHeaderCell.fill };
  }

  if (!teacherNameCol) {
    teacherNameCol = Math.max(teacherIdCol + 1, ws.columnCount + 1);
    const cell = headerRow.getCell(teacherNameCol);
    cell.value = "Profesor";
    if (sampleHeaderCell.font) cell.font = { ...sampleHeaderCell.font };
    if (sampleHeaderCell.fill) cell.fill = { ...sampleHeaderCell.fill };
  }

  const effectiveMapping: ColumnMapping = {
    codeCol,
    nameCol,
    horarioCol,
    diasCol,
    teacherIdCol,
    teacherNameCol,
  };

  // Mapear materias de DB
  const dbCoursesByNormCode = new Map<string, DbCourseInfo[]>();
  for (const c of dbCourses) {
    const k = normalizeText(c.code);
    const list = dbCoursesByNormCode.get(k) || [];
    list.push(c);
    dbCoursesByNormCode.set(k, list);
  }

  const assignmentsByCourseId = new Map<number, DbCourseAssignment>();
  for (const a of dbAssignments) {
    assignmentsByCourseId.set(a.courseId, a);
  }

  const usedCourseIds = new Set<number>();
  const matchedAssignmentIds = new Set<number>();
  const extraCoursesInExcel: AnalysisResult["extraCoursesInExcel"] = [];
  let matchedCount = 0;
  let vacantCount = 0;
  let totalExcelRows = 0;

  for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const codeVal = cleanCellText(row.getCell(codeCol).value);
    const nameVal = nameCol ? cleanCellText(row.getCell(nameCol).value) : "";
    const horarioVal = horarioCol ? cleanCellText(row.getCell(horarioCol).value) : "";
    const diasVal = diasCol ? cleanCellText(row.getCell(diasCol).value) : "";

    if (!codeVal && !nameVal) continue;
    totalExcelRows++;

    const normCode = normalizeText(codeVal);
    const normHorario = normalizeText(horarioVal);
    const normDias = normalizeText(diasVal);

    const candidateCourses = dbCoursesByNormCode.get(normCode);

    if (!candidateCourses || candidateCourses.length === 0) {
      extraCoursesInExcel.push({
        row: r,
        code: codeVal,
        name: nameVal,
        horario: horarioVal || undefined,
      });
      // Dejar vacías las columnas de docente para materias que no están en la DB
      row.getCell(teacherIdCol).value = "";
      row.getCell(teacherNameCol).value = "";
      continue;
    }

    // Buscar coincidencia jerárquica: Horario+Días > Horario > Días > Primer candidato disponible
    const available = candidateCourses.filter((c) => !usedCourseIds.has(c.id));
    const pool = available.length > 0 ? available : candidateCourses;

    let matchedCourse: DbCourseInfo | undefined;
    if (pool.length === 1) {
      matchedCourse = pool[0];
    } else {
      // Tier 1: Coincidencia exacta en Horario Y Días
      if (normHorario && normDias) {
        matchedCourse = pool.find(
          (c) => normalizeText(c.horario || "") === normHorario && normalizeText(c.dias || "") === normDias
        );
      }
      // Tier 2: Coincidencia exacta en Horario
      if (!matchedCourse && normHorario) {
        matchedCourse = pool.find((c) => normalizeText(c.horario || "") === normHorario);
      }
      // Tier 3: Coincidencia exacta en Días
      if (!matchedCourse && normDias) {
        matchedCourse = pool.find((c) => normalizeText(c.dias || "") === normDias);
      }
      // Tier 4: Primero en pool disponible
      if (!matchedCourse) {
        matchedCourse = pool[0];
      }
    }

    if (matchedCourse) {
      usedCourseIds.add(matchedCourse.id);
      const assignment = assignmentsByCourseId.get(matchedCourse.id);
      if (assignment) {
        matchedCount++;
        matchedAssignmentIds.add(assignment.id);
        // Escribir datos de docente asignado
        row.getCell(teacherIdCol).value = assignment.teacher.employeeId ?? "";
        row.getCell(teacherNameCol).value = assignment.teacher.name;
      } else {
        vacantCount++;
        // Materia sin profesor asignado: se deja la celda vacía explícitamente
        row.getCell(teacherIdCol).value = "";
        row.getCell(teacherNameCol).value = "";
      }
    }
  }

  // Identificar asignaciones de DB que no estaban en el Excel
  const missingAssignmentsInExcel: AnalysisResult["missingAssignmentsInExcel"] = [];
  const yellowFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF59D" }, // Amarillo suave legible
  };

  for (const a of dbAssignments) {
    if (!matchedAssignmentIds.has(a.id)) {
      missingAssignmentsInExcel.push({
        assignmentId: a.id,
        courseCode: a.courseCode,
        courseName: a.courseName,
        horario: a.horario || undefined,
        dias: a.dias || undefined,
        teacherName: a.teacher.name,
        employeeId: a.teacher.employeeId || undefined,
        slotNo: a.slotNo,
      });

      // Insertar fila al final del Excel
      const newRow = ws.addRow([]);
      if (codeCol) newRow.getCell(codeCol).value = a.courseCode;
      if (nameCol) newRow.getCell(nameCol).value = a.courseName;
      if (horarioCol && a.horario) newRow.getCell(horarioCol).value = a.horario;
      if (diasCol && a.dias) newRow.getCell(diasCol).value = a.dias;
      newRow.getCell(teacherIdCol).value = a.teacher.employeeId ?? "";
      newRow.getCell(teacherNameCol).value = a.teacher.name;

      // Colorear todo el renglón agregado en fondo amarillo
      const colsToColor = Math.max(ws.columnCount, teacherNameCol, teacherIdCol);
      for (let c = 1; c <= colsToColor; c++) {
        const cell = newRow.getCell(c);
        cell.fill = yellowFill;
        cell.border = {
          top: { style: "thin", color: { argb: "FFD4D4D8" } },
          left: { style: "thin", color: { argb: "FFD4D4D8" } },
          bottom: { style: "thin", color: { argb: "FFD4D4D8" } },
          right: { style: "thin", color: { argb: "FFD4D4D8" } },
        };
      }
    }
  }

  // Generar buffer de salida
  const arrayBuffer = await wb.xlsx.writeBuffer();
  const filledBuffer = Buffer.from(arrayBuffer);

  const analysis: AnalysisResult = {
    headerRowIndex,
    headers,
    suggestedMapping: effectiveMapping,
    isAmbiguous: detected.isAmbiguous,
    ambiguityReason: detected.reason,
    totalExcelRows,
    matchedCount,
    vacantCount,
    extraCoursesInExcel,
    missingAssignmentsInExcel,
  };

  return { filledBuffer, analysis };
}
