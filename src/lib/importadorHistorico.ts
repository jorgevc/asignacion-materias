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

let tablesEnsured = false;

/**
 * Asegura que las tablas historical_files e historical_records existan en SQL Server.
 * Se ejecuta de manera transparente y segura en el primer acceso.
 */
export async function ensureHistoricalTablesExist(): Promise<void> {
  if (tablesEnsured) return;

  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'historical_files')
      BEGIN
          CREATE TABLE [dbo].[historical_files] (
              [id] INT NOT NULL IDENTITY(1,1),
              [name] NVARCHAR(1000) NOT NULL,
              [sizeBytes] INT NOT NULL CONSTRAINT [historical_files_sizeBytes_df] DEFAULT 0,
              [rowCount] INT NOT NULL CONSTRAINT [historical_files_rowCount_df] DEFAULT 0,
              [uploadedAt] DATETIME2 NOT NULL CONSTRAINT [historical_files_uploadedAt_df] DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT [historical_files_pkey] PRIMARY KEY CLUSTERED ([id]),
              CONSTRAINT [historical_files_name_key] UNIQUE NONCLUSTERED ([name])
          );
      END

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'historical_records')
      BEGIN
          CREATE TABLE [dbo].[historical_records] (
              [id] INT NOT NULL IDENTITY(1,1),
              [fileId] INT NOT NULL,
              [sourceFile] NVARCHAR(1000) NOT NULL,
              [period] INT NOT NULL,
              [year] INT NOT NULL,
              [employeeId] NVARCHAR(1000),
              [teacherName] NVARCHAR(1000),
              [courseCode] NVARCHAR(1000) NOT NULL,
              [createdAt] DATETIME2 NOT NULL CONSTRAINT [historical_records_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT [historical_records_pkey] PRIMARY KEY CLUSTERED ([id]),
              CONSTRAINT [historical_records_fileId_fkey] FOREIGN KEY ([fileId]) REFERENCES [dbo].[historical_files]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
          );

          CREATE NONCLUSTERED INDEX [historical_records_year_courseCode_idx] ON [dbo].[historical_records]([year], [courseCode]);
          CREATE NONCLUSTERED INDEX [historical_records_fileId_idx] ON [dbo].[historical_records]([fileId]);
          CREATE NONCLUSTERED INDEX [historical_records_employeeId_idx] ON [dbo].[historical_records]([employeeId]);
      END
    `);
    tablesEnsured = true;
  } catch (err) {
    console.warn("Aviso al verificar tablas históricas (pueden ya existir o no tener permisos DDL):", err);
    tablesEnsured = true; // No reintentar en bucle
  }
}

/**
 * Parsea un archivo histórico (Excel/CSV) directamente desde memoria RAM (Buffer)
 * e inserta sus registros normalizados en la base de datos sin tocar el disco.
 */
export async function guardarArchivoHistoricoEnBD(
  fileName: string,
  buffer: Buffer
): Promise<{ fileRecord: any; rowCount: number; wasReplaced: boolean }> {
  await ensureHistoricalTablesExist();

  const safeName = path.basename(fileName);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("El archivo no contiene hojas de cálculo válidas.");
  }

  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  // Deduplicar registros dentro del mismo archivo para optimizar almacenamiento y consultas
  const recordsMap = new Map<
    string,
    {
      sourceFile: string;
      period: number;
      year: number;
      employeeId: string | null;
      teacherName: string | null;
      courseCode: string;
    }
  >();

  for (const r of rawRows) {
    const rawPeriodo = r.Periodo ?? r.periodo ?? r["﻿Periodo"] ?? r.PERIODO;
    const rawEmpId = r.ID_Docente ?? r.id_docente ?? r.Id_Docente ?? r.ID_DOCENTE ?? r.ID ?? r.id;
    const rawProfesor = r.Profesor ?? r.profesor ?? r.PROFESOR ?? r.Docente ?? r.docente;
    const rawClave = r.Clave ?? r.clave ?? r.CLAVE ?? r.Materia ?? r.materia;

    if (!rawPeriodo || !rawClave || (!rawEmpId && !rawProfesor)) continue;

    const periodoNum = Number(rawPeriodo);
    if (Number.isNaN(periodoNum)) continue;

    const periodYear = Math.floor(periodoNum / 100);
    const empId = rawEmpId ? String(rawEmpId).trim().toUpperCase() : null;
    const teacherName = rawProfesor ? String(rawProfesor).replace(/ - /g, " ").trim() : null;
    const courseCode = String(rawClave).trim();

    const dedupKey = `${periodoNum}_${empId || ""}_${teacherName || ""}_${courseCode}`;
    if (!recordsMap.has(dedupKey)) {
      recordsMap.set(dedupKey, {
        sourceFile: safeName,
        period: periodoNum,
        year: periodYear,
        employeeId: empId,
        teacherName,
        courseCode,
      });
    }
  }

  const uniqueRecords = Array.from(recordsMap.values());

  // Upsert del archivo histórico
  const existingFile = await prisma.historicalFile.findUnique({
    where: { name: safeName },
  });
  const wasReplaced = !!existingFile;

  let fileId: number;
  if (existingFile) {
    // Limpiar registros previos asociados a este archivo
    await prisma.historicalRecord.deleteMany({
      where: { fileId: existingFile.id },
    });

    const updated = await prisma.historicalFile.update({
      where: { id: existingFile.id },
      data: {
        sizeBytes: buffer.length,
        rowCount: uniqueRecords.length,
        uploadedAt: new Date(),
      },
    });
    fileId = updated.id;
  } else {
    const created = await prisma.historicalFile.create({
      data: {
        name: safeName,
        sizeBytes: buffer.length,
        rowCount: uniqueRecords.length,
        uploadedAt: new Date(),
      },
    });
    fileId = created.id;
  }

  // Insertar registros en lotes para respetar los límites de parámetros de SQL Server
  const CHUNK_SIZE = 250;
  const recordsToInsert = uniqueRecords.map((r) => ({
    fileId,
    sourceFile: safeName,
    period: r.period,
    year: r.year,
    employeeId: r.employeeId,
    teacherName: r.teacherName,
    courseCode: r.courseCode,
  }));

  for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
    const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.historicalRecord.createMany({
      data: chunk,
    });
  }

  const fileRecord = await prisma.historicalFile.findUnique({
    where: { id: fileId },
  });

  return {
    fileRecord,
    rowCount: uniqueRecords.length,
    wasReplaced,
  };
}

/**
 * Importa y calcula los periodos impartidos por docente para cada materia
 * a partir de los registros históricos almacenados en la base de datos (últimos 4 años).
 */
export async function importarExperienciaHistorica(options?: ImportOptions | number): Promise<ImportResult> {
  await ensureHistoricalTablesExist();

  const opts: ImportOptions = typeof options === "number" ? { targetYear: options } : options || {};

  // Determinar año de referencia (año del semestre activo o año actual)
  let refYear = opts.targetYear;
  if (!refYear) {
    const activeSemester = await prisma.semester.findFirst({ where: { isActive: true } });
    refYear = activeSemester?.year ?? new Date().getFullYear();
  }

  // Últimos 4 años: desde (refYear - 3) hasta refYear
  const minYear = refYear - 3;

  // Si reset está activado (por defecto true), limpiar estados previos
  if (opts.reset !== false) {
    await prisma.teacherCourseExp.deleteMany();
    await prisma.teacher.updateMany({ data: { expPeriods: 0 } });
  }

  // Fallback de retrocompatibilidad local: si la BD está vacía y existe la carpeta local con archivos
  const totalInDb = await prisma.historicalRecord.count();
  if (totalInDb === 0) {
    const localDir = path.join(process.cwd(), "Programacion Academica Historica");
    if (fs.existsSync(localDir)) {
      try {
        const localFiles = fs.readdirSync(localDir).filter((f) => {
          const lower = f.toLowerCase();
          return !lower.startsWith("~$") && (lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls"));
        });
        for (const file of localFiles) {
          const filePath = path.join(localDir, file);
          const buf = fs.readFileSync(filePath);
          await guardarArchivoHistoricoEnBD(file, buf);
        }
      } catch (e) {
        console.warn("Aviso al migrar archivos locales a la BD:", e);
      }
    }
  }

  // Obtener registros de la ventana de 4 años desde la BD
  const records = await prisma.historicalRecord.findMany({
    where: {
      year: {
        gte: minYear,
        lte: refYear,
      },
    },
  });

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
  const filesProcessedSet = new Set<string>();

  for (const r of records) {
    periodsFoundSet.add(r.period);
    filesProcessedSet.add(r.sourceFile);

    // Identificar docente por ID o nombre
    let teacher = r.employeeId ? byEmpId.get(r.employeeId.trim().toUpperCase()) : undefined;
    if (!teacher && r.teacherName) {
      const normProf = r.teacherName.replace(/ - /g, " ").trim().toLowerCase();
      teacher = byName.get(normProf);
    }

    if (!teacher) continue;

    const code = r.courseCode.trim();
    const statKey = `${teacher.id}_${code}`;

    if (!expStats.has(statKey)) {
      expStats.set(statKey, {
        teacherId: teacher.id,
        courseCode: code,
        periods: new Set<number>(),
      });
    }

    // Contabiliza 1 vez por periodo
    expStats.get(statKey)!.periods.add(r.period);
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

  // Obtener la lista total de archivos considerados
  const distinctFiles = await prisma.historicalFile.findMany({
    select: { name: true },
  });

  return {
    ok: true,
    totalFiles: distinctFiles.length,
    filesProcessed: Array.from(filesProcessedSet),
    totalRecordsFound: expStats.size,
    totalPairsUpdated,
    teachersUpdated: teachersUpdatedSet.size,
    periodsConsidered: Array.from(periodsFoundSet).sort(),
    referenceYear: refYear,
    minYear,
  };
}
