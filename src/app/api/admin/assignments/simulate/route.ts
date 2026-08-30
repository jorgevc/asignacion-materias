import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asignarSlot } from "@/lib/asignador";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const semesterId = Number(body.semesterId ?? body.semester_id);
    const slotNo = Number(body.slotNo ?? body.slot_no);
    const locked = (body.locked as Array<{ courseId: number; teacherId: number }>) || [];
    // también soportar single
    let lockedList: Array<{ courseId: number; teacherId: number }> = [];
    if (Array.isArray(locked) && locked.length > 0) {
      lockedList = locked.map((l) => ({ courseId: Number(l.courseId), teacherId: Number(l.teacherId) })).filter((l) => !Number.isNaN(l.courseId) && !Number.isNaN(l.teacherId));
    } else if (body.courseId && body.teacherId) {
      lockedList = [{ courseId: Number(body.courseId), teacherId: Number(body.teacherId) }];
    } else if (body.locked === undefined) {
      // simular sin bloqueo = qué pasaría con asignación automática actual
      lockedList = [];
    }

    if (Number.isNaN(semesterId) || Number.isNaN(slotNo) || ![1, 2, 3].includes(slotNo)) {
      return NextResponse.json({ error: "semesterId y slotNo 1..3 requeridos" }, { status: 400 });
    }

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) return NextResponse.json({ error: "Semestre no encontrado" }, { status: 404 });

    // Validar bloqueos si los hay
    for (const l of lockedList) {
      const petition = await prisma.petition.findFirst({ where: { teacherId: l.teacherId, courseId: l.courseId, semesterId, slotNo } });
      if (!petition) {
        return NextResponse.json({ error: `Petition no encontrada para teacher ${l.teacherId} curso ${l.courseId} slot ${slotNo}` }, { status: 404 });
      }
      const alreadyAssignedOtherSlot = await prisma.assignment.findFirst({ where: { courseId: l.courseId, semesterId, slotNo: { not: slotNo } } });
      if (alreadyAssignedOtherSlot) {
        return NextResponse.json({ error: `Curso ${l.courseId} ya asignado en slot ${alreadyAssignedOtherSlot.slotNo}` }, { status: 409 });
      }
    }

    const result = await asignarSlot(semesterId, slotNo, lockedList);

    // Totales por prioridad
    const totales = {
      p1: result.asignados.filter((a) => a.priority === 1).length,
      p2: result.asignados.filter((a) => a.priority === 2).length,
      p3: result.asignados.filter((a) => a.priority === 3).length,
      total: result.asignados.length,
    };

    // Totales actuales persistidos para comparar
    const actuales = await prisma.assignment.findMany({ where: { semesterId, slotNo } });
    const actualesTotales = {
      p1: actuales.filter((a) => a.priority === 1).length,
      p2: actuales.filter((a) => a.priority === 2).length,
      p3: actuales.filter((a) => a.priority === 3).length,
      total: actuales.length,
    };

    return NextResponse.json({
      ...result,
      ok: true,
      simulate: true,
      locked: lockedList,
      totales,
      actualesTotales,
      diff: {
        p1: totales.p1 - actualesTotales.p1,
        p2: totales.p2 - actualesTotales.p2,
        p3: totales.p3 - actualesTotales.p3,
        total: totales.total - actualesTotales.total,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e instanceof Error ? e.message : "Error interno") }, { status: 500 });
  }
}
