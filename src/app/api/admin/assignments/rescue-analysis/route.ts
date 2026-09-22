import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analizarOpcionesRescate } from "@/lib/asignador";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get("semesterId") || searchParams.get("semester_id");
    const slotNoStr = searchParams.get("slotNo") || searchParams.get("slot_no");

    let sid: number;
    if (semesterId) {
      sid = Number(semesterId);
      if (Number.isNaN(sid)) {
        return NextResponse.json({ error: "semesterId inválido" }, { status: 400 });
      }
    } else {
      const active = await prisma.semester.findFirst({ where: { isActive: true } });
      if (!active) {
        return NextResponse.json({ error: "No active semester" }, { status: 404 });
      }
      sid = active.id;
    }

    const slotNo = slotNoStr ? Number(slotNoStr) : 1;
    if (![1, 2, 3].includes(slotNo)) {
      return NextResponse.json({ error: "slotNo debe ser 1, 2 o 3" }, { status: 400 });
    }

    const analysis = await analizarOpcionesRescate(sid, slotNo);

    return NextResponse.json({
      ok: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Error en rescue-analysis route:", error);
    return NextResponse.json(
      { error: String(error instanceof Error ? error.message : "Error interno") },
      { status: 500 }
    );
  }
}
