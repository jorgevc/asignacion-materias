import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  ensureHistoricalTablesExist,
  guardarArchivoHistoricoEnBD,
  importarExperienciaHistorica,
} from "@/lib/importadorHistorico";

const ALLOWED_EXTS = [".csv", ".xlsx", ".xls"];

// GET: Listar archivos históricos guardados en la Base de Datos
export async function GET() {
  try {
    await ensureHistoricalTablesExist();

    const dbFiles = await prisma.historicalFile.findMany({
      orderBy: { name: "asc" },
    });

    const files = dbFiles.map((f) => ({
      name: f.name,
      sizeBytes: f.sizeBytes,
      sizeFormatted: (f.sizeBytes / 1024).toFixed(1) + " KB",
      updatedAt: f.uploadedAt.toISOString(),
      rowCount: f.rowCount,
      extension: path.extname(f.name).toLowerCase(),
    }));

    return NextResponse.json({ ok: true, files });
  } catch (err: any) {
    console.error("Error al listar archivos históricos:", err);
    return NextResponse.json({ error: err.message || "Error al listar archivos" }, { status: 500 });
  }
}

// POST: Subir o actualizar un archivo histórico procesándolo en memoria y persistiendo en la BD
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const autoRecalculate = formData.get("autoRecalculate") === "true";

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `Formato no permitido. Solo se admiten archivos: ${ALLOWED_EXTS.join(", ")}` },
        { status: 400 }
      );
    }

    const safeName = path.basename(originalName);

    // Leer directamente en memoria RAM (Buffer) sin tocar el disco del contenedor
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Guardar registros del archivo en la base de datos
    const { rowCount, wasReplaced } = await guardarArchivoHistoricoEnBD(safeName, buffer);

    let importResult = null;
    if (autoRecalculate) {
      // Recalcular con reset completo para reflejar el estado actual
      importResult = await importarExperienciaHistorica({ reset: true });
    }

    return NextResponse.json({
      ok: true,
      fileName: safeName,
      wasReplaced,
      message: wasReplaced
        ? `Archivo '${safeName}' actualizado en la base de datos (${rowCount} materias/secciones registradas).`
        : `Archivo '${safeName}' subido y guardado en la base de datos (${rowCount} materias/secciones registradas).`,
      importResult,
    });
  } catch (err: any) {
    console.error("Error al procesar archivo histórico:", err);
    return NextResponse.json({ error: err.message || "Error al procesar el archivo" }, { status: 500 });
  }
}

// DELETE: Eliminar un archivo histórico de la base de datos y recalcular
export async function DELETE(req: Request) {
  try {
    await ensureHistoricalTablesExist();

    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("fileName");
    const autoRecalculate = searchParams.get("autoRecalculate") === "true";

    if (!fileName) {
      return NextResponse.json({ error: "fileName es requerido" }, { status: 400 });
    }

    const safeName = path.basename(fileName);

    const existing = await prisma.historicalFile.findUnique({
      where: { name: safeName },
    });

    if (!existing) {
      return NextResponse.json({ error: `El archivo '${safeName}' no existe en la base de datos` }, { status: 404 });
    }

    // Al eliminar el archivo, la relación con onDelete: Cascade elimina automáticamente sus historical_records
    await prisma.historicalFile.delete({
      where: { id: existing.id },
    });

    let importResult = null;
    if (autoRecalculate) {
      importResult = await importarExperienciaHistorica({ reset: true });
    }

    return NextResponse.json({
      ok: true,
      fileName: safeName,
      message: `Archivo '${safeName}' eliminado exitosamente de la base de datos.`,
      importResult,
    });
  } catch (err: any) {
    console.error("Error al eliminar archivo histórico:", err);
    return NextResponse.json({ error: err.message || "Error al eliminar archivo" }, { status: 500 });
  }
}
