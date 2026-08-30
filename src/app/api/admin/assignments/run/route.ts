import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asignarSlot, persistAsignaciones } from "@/lib/asignador";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const semesterId = Number(body.semesterId ?? body.semester_id);
    const slotNo = Number(body.slotNo ?? body.slot_no);

    if (Number.isNaN(semesterId) || Number.isNaN(slotNo)) {
      return NextResponse.json({ error: "semesterId y slotNo requeridos" }, { status: 400 });
    }
    if (![1, 2, 3].includes(slotNo)) {
      return NextResponse.json({ error: "slotNo debe ser 1,2,3" }, { status: 400 });
    }

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) return NextResponse.json({ error: "Semestre no encontrado" }, { status: 404 });

    // Verificar que no haya asignaciones previas para ese slot (para evitar duplicados)
    const existentes = await prisma.assignment.count({ where: { semesterId, slotNo } });
    if (existentes > 0) {
      return NextResponse.json({ error: `Slot ${slotNo} ya asignado (${existentes} asignaciones). Borre antes de re-asignar.` }, { status: 409 });
    }

    // Verificar que slots previos estén asignados (orden secuencial)
    if (slotNo > 1) {
      for (let s = 1; s < slotNo; s++) {
        const prevCount = await prisma.assignment.count({ where: { semesterId, slotNo: s } });
        // Si no hay petitions para slot previo, es ok saltar, pero si hay petitions y no hay asignaciones, advertir
        const petitionsPrev = await prisma.petition.count({ where: { semesterId, slotNo: s } });
        if (petitionsPrev > 0 && prevCount === 0) {
          return NextResponse.json({ error: `Debe asignar slot ${s} primero (slot ${slotNo} requiere que slots previos estén asignados)` }, { status: 400 });
        }
      }
    }

    const result = await asignarSlot(semesterId, slotNo);
    if (result.asignados.length === 0) {
      return NextResponse.json({ ok: true, message: `Sin asignaciones para slot ${slotNo} (sin peticiones o cursos disponibles)`, ...result }, { status: 200 });
    }

    await persistAsignaciones(result);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e instanceof Error ? e.message : "Error interno") }, { status: 500 });
  }
}
