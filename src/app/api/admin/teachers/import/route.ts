import { NextResponse } from "next/server";
import {
  importarProfesoresDesdeBuffer,
  generarPlantillaProfesoresCSV,
} from "@/lib/importadorProfesores";

// GET /api/admin/teachers/import?template=true
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isTemplate = searchParams.get("template") === "true";

  if (isTemplate) {
    const csvContent = "\uFEFF" + generarPlantillaProfesoresCSV(); // BOM para abrir correctamente en Excel
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="plantilla_profesores.csv"',
      },
    });
  }

  return NextResponse.json({ message: "Usa POST para importar o ?template=true para descargar la plantilla" });
}

// POST /api/admin/teachers/import
// Multipart form-data con campo 'file'
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    const filename = file.name || "";
    const lowerName = filename.toLowerCase();

    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls") && !lowerName.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Formato no compatible. Seleccione un archivo Excel (.xlsx, .xls) o CSV (.csv)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const summary = await importarProfesoresDesdeBuffer(buffer);

    return NextResponse.json({
      success: true,
      filename,
      summary,
    });
  } catch (error: any) {
    console.error("Error importando profesores:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar el archivo de profesores" },
      { status: 500 }
    );
  }
}
