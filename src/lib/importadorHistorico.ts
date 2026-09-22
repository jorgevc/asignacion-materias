import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export interface ImportResult {
  ok: boolean;
  totalFiles: number;
  filesProcessed: string[];
  totalRecordsFound: number;
  totalPairsUpdated: number;
  teachersUpdated: number;
  periodsConsidered: number[];
  referenceYear: number;
  minYear: number;
}

export interface ImportOptions {
  targetYear?: number;
  reset?: boolean;
}

/**
 * Importa y calcula los periodos impartidos por docente para cada materia
 * a partir de los archivos de 'Programacion Academica Historica' considerando los últimos 4 años.
 */
export async function importarExperienciaHistorica(options?: ImportOptions | number): Promise<ImportResult> {
  const opts: ImportOptions = typeof options === "number" ? { targetYear: options } : options || {};
  
  // Determinar año de referencia (año del semestre activo o año actual)
  let refYear = opts.targetYear;
  if (!refYear) {
    const activeSemester = await prisma.semester.findFirst({ where: { isActive: true } });
    refYear = activeSemester?.year ?? new Date().getFullYear();
  }

  // Últimos 4 años: desde (refYear - 3) hasta refYear
  const minYear = refYear - 3;

  const dir = path.join(process.cwd(), "Programacion Academica Historica");
  if (!fs.existsSync(dir)) {
    throw new Error(`El directorio ${dir} no existe`);
  }

  // Si reset está activado (por defecto true), limpiar estados previos para reflejar fielmente los archivos actuales
  if (opts.reset !== false) {
    await prisma.teacherCourseExp.deleteMany();
    await prisma.teacher.updateMany({ data: { expPeriods: 0 } });
  }

  const files = fs.readdirSync(dir).filter((f) => {
    const lower = f.toLowerCase();
    return !lower.startsWith("~$") && (lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls"));
  });
  const filesProcessed: string[] = [];

  // Obtener todos los docentes en la base de datos
  const teachers = await prisma.teacher.findMany();
  const byEmpId = new Map<string, (typeof teachers)[0]>();
  const byName = new Map<string, (typeof teachers)[0]>();

  for (const t of teachers) {
    if (t.employeeId) {
      byEmpId.set(t.employeeId.trim().toUpperCase(), t);
    }
    byName.set(t.name.trim().toLowerCase(), t);
  }

  // Mapa: key = `${teacherId}_${courseCode}` -> Set de periodos únicos
  const expStats = new Map<string, { teacherId: number; courseCode: string; periods: Set<number> }>();
  const periodsFoundSet = new Set<number>();

  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const buf = fs.readFileSync(fullPath);
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
      filesProcessed.push(file);

      for (const r of rows) {
        // Encontrar columna de periodo, docente y clave
        const rawPeriodo = r.Periodo ?? r.periodo ?? r["﻿Periodo"];
        const rawEmpId = r.ID_Docente ?? r.id_docente ?? r.Id_Docente;
        const rawProfesor = r.Profesor ?? r.profesor;
        const rawClave = r.Clave ?? r.clave;

        if (!rawPeriodo || !rawClave || (!rawEmpId && !rawProfesor)) continue;

        const periodoNum = Number(rawPeriodo);
        if (Number.isNaN(periodoNum)) continue;

        // Extraer año del periodo (ej. 202525 -> 2025)
        const periodYear = Math.floor(periodoNum / 100);
        // Filtrar ventana de 4 años: entre minYear y refYear
        if (periodYear < minYear || periodYear > refYear) {
          continue;
        }

        periodsFoundSet.add(periodoNum);

        // Identificar docente por ID o nombre
        let teacher = rawEmpId ? byEmpId.get(String(rawEmpId).trim().toUpperCase()) : undefined;
        if (!teacher && rawProfesor) {
          const normProf = String(rawProfesor).replace(/ - /g, " ").trim().toLowerCase();
          teacher = byName.get(normProf);
        }

        if (!teacher) continue;

        const code = String(rawClave).trim();
        const statKey = `${teacher.id}_${code}`;

        if (!expStats.has(statKey)) {
          expStats.set(statKey, {
            teacherId: teacher.id,
            courseCode: code,
            periods: new Set<number>(),
          });
        }

        // Opción A: Contabiliza 1 vez por periodo aunque tenga múltiples secciones
        expStats.get(statKey)!.periods.add(periodoNum);
      }
    } catch (err) {
      console.error(`Error leyendo archivo ${file}:`, err);
    }
  }

  // Guardar / actualizar en base de datos
  const teachersUpdatedSet = new Set<number>();
  let totalPairsUpdated = 0;

  for (const item of expStats.values()) {
    const count = item.periods.size;
    await prisma.teacherCourseExp.upsert({
      where: {
        teacherId_courseCode: {
          teacherId: item.teacherId,
          courseCode: item.courseCode,
        },
      },
      update: {
        periods: count,
      },
      create: {
        teacherId: item.teacherId,
        courseCode: item.courseCode,
        periods: count,
      },
    });
    teachersUpdatedSet.add(item.teacherId);
    totalPairsUpdated++;
  }

  // Actualizar también expPeriods global para cada docente
  for (const teacherId of teachersUpdatedSet) {
    const totalPeriodsForTeacher = await prisma.teacherCourseExp.findMany({
      where: { teacherId },
    });
    const maxPeriodsAnyCourse = Math.max(...totalPeriodsForTeacher.map((t) => t.periods), 0);
    await prisma.teacher.update({
      where: { id: teacherId },
      data: { expPeriods: maxPeriodsAnyCourse },
    });
  }

  return {
    ok: true,
    totalFiles: files.length,
    filesProcessed,
    totalRecordsFound: expStats.size,
    totalPairsUpdated,
    teachersUpdated: teachersUpdatedSet.size,
    periodsConsidered: Array.from(periodsFoundSet).sort(),
    referenceYear: refYear,
    minYear,
  };
}
