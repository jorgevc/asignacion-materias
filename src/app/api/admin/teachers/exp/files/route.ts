import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { importarExperienciaHistorica } from "@/lib/importadorHistorico";

const ALLOWED_EXTS = [".csv", ".xlsx", ".xls"];

function getHistoricoDir() {
  const dir = path.join(process.cwd(), "Programacion Academica Historica");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// GET: Listar archivos existentes en 'Programacion Academica Historica'
export async function GET() {
  try {
    const dir = getHistoricoDir();
    const fileNames = fs.readdirSync(dir).filter((f) => {
      const lower = f.toLowerCase();
      return !lower.startsWith("~$") && ALLOWED_EXTS.some((ext) => lower.endsWith(ext));
    });

    const files = fileNames.map((name) => {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        sizeBytes: stat.size,
        sizeFormatted: (stat.size / 1024).toFixed(1) + " KB",
        updatedAt: stat.mtime.toISOString(),
        extension: path.extname(name).toLowerCase(),
      };
    });

    // Ordenar por nombre
    files.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ ok: true, files });
  } catch (err: any) {
    console.error("Error al listar archivos históricos:", err);
    return NextResponse.json({ error: err.message || "Error al listar archivos" }, { status: 500 });
  }
}

// POST: Subir o actualizar un archivo de programación académica
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

    // Nombre seguro sin caracteres de ruta
    const safeName = path.basename(originalName);
    const dir = getHistoricoDir();
    const destPath = path.join(dir, safeName);
    const fileExistsBefore = fs.existsSync(destPath);

    // Escribir archivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(destPath, buffer);

    let importResult = null;
    if (autoRecalculate) {
      // Recalcular con reset completo para reflejar el estado actual
      importResult = await importarExperienciaHistorica({ reset: true });
    }

    return NextResponse.json({
      ok: true,
      fileName: safeName,
      wasReplaced: fileExistsBefore,
      message: fileExistsBefore
        ? `Archivo '${safeName}' actualizado exitosamente.`
        : `Archivo '${safeName}' subido exitosamente.`,
      importResult,
    });
  } catch (err: any) {
    console.error("Error al subir archivo histórico:", err);
    return NextResponse.json({ error: err.message || "Error al guardar el archivo" }, { status: 500 });
  }
}

// DELETE: Eliminar un archivo erróneo
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("fileName");
    const autoRecalculate = searchParams.get("autoRecalculate") === "true";

    if (!fileName) {
      return NextResponse.json({ error: "fileName es requerido" }, { status: 400 });
    }

    const safeName = path.basename(fileName);
    const dir = getHistoricoDir();
    const filePath = path.join(dir, safeName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `El archivo '${safeName}' no existe` }, { status: 404 });
    }

    fs.unlinkSync(filePath);

    let importResult = null;
    if (autoRecalculate) {
      importResult = await importarExperienciaHistorica({ reset: true });
    }

    return NextResponse.json({
      ok: true,
      fileName: safeName,
      message: `Archivo '${safeName}' eliminado exitosamente.`,
      importResult,
    });
  } catch (err: any) {
    console.error("Error al eliminar archivo histórico:", err);
    return NextResponse.json({ error: err.message || "Error al eliminar archivo" }, { status: 500 });
  }
}
