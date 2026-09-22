import { NextResponse } from "next/server";
import { importarExperienciaHistorica } from "@/lib/importadorHistorico";

export async function POST(req: Request) {
  try {
    let targetYear: number | undefined = undefined;
    try {
      const body = await req.json();
      if (body.year) targetYear = Number(body.year);
    } catch {
      // Body opcional
    }

    const result = await importarExperienciaHistorica(targetYear);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Error importando experiencia histórica:", err);
    return NextResponse.json({ error: err.message || "Error al importar experiencia" }, { status: 500 });
  }
}
