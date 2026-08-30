import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asignarSlot, persistAsignaciones } from "@/lib/asignador";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const semesterId = Number(body.semesterId ?? body.semester_id);
    const slotNo = Number(body.slotNo ?? body.slot_no);
    const locked = body.locked as Array<{ courseId: number; teacherId: number }> | undefined;
    // También soportar single courseId/teacherId para compatibilidad
    const singleCourseId = body.courseId ? Number(body.courseId) : undefined;
    const singleTeacherId = body.teacherId ? Number(body.teacherId) : undefined;

    if (Number.isNaN(semesterId) || Number.isNaN(slotNo) || ![1, 2, 3].includes(slotNo)) {
      return NextResponse.json({ error: "semesterId y slotNo 1..3 requeridos" }, { status: 400 });
    }

    let lockedList: Array<{ courseId: number; teacherId: number }> = [];
    if (Array.isArray(locked) && locked.length > 0) {
      lockedList = locked.map((l) => ({ courseId: Number(l.courseId), teacherId: Number(l.teacherId) })).filter((l) => !Number.isNaN(l.courseId) && !Number.isNaN(l.teacherId));
    } else if (singleCourseId && singleTeacherId) {
      lockedList = [{ courseId: singleCourseId, teacherId: singleTeacherId }];
    } else {
      return NextResponse.json({ error: "locked [{courseId,teacherId}] o courseId+teacherId requeridos" }, { status: 400 });
    }

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) return NextResponse.json({ error: "Semestre no encontrado" }, { status: 404 });

    // Validar que los locked correspondan a petitions de ese slot y semestre y que curso no esté asignado en otro slot
    for (const l of lockedList) {
      const petition = await prisma.petition.findFirst({ where: { teacherId: l.teacherId, courseId: l.courseId, semesterId, slotNo } });
      if (!petition) {
        return NextResponse.json({ error: `Petition no encontrada para teacher ${l.teacherId} curso ${l.courseId} slot ${slotNo}` }, { status: 404 });
      }
      const alreadyAssignedOtherSlot = await prisma.assignment.findFirst({ where: { courseId: l.courseId, semesterId, NOT: { slotNo } } });
      if (alreadyAssignedOtherSlot) {
        return NextResponse.json({ error: `Curso ${l.courseId} ya asignado en slot ${alreadyAssignedOtherSlot.slotNo}, no disponible` }, { status: 409 });
      }
    }

    // Validar que slot previo esté asignado (igual que run)
    if (slotNo > 1) {
      for (let s = 1; s < slotNo; s++) {
        const petitionsPrev = await prisma.petition.count({ where: { semesterId, slotNo: s } });
        const prevCount = await prisma.assignment.count({ where: { semesterId, slotNo: s } });
        if (petitionsPrev > 0 && prevCount === 0) {
          return NextResponse.json({ error: `Debe asignar slot ${s} primero` }, { status: 400 });
        }
      }
    }

    // Borrar asignaciones existentes para ese slot (recálculo bloqueado)
    await prisma.assignment.deleteMany({ where: { semesterId, slotNo } });

    // Ejecutar asignador con bloqueos
    const result = await asignarSlot(semesterId, slotNo, lockedList);
    await persistAsignaciones(result);

    return NextResponse.json({ ok: true, message: `Slot ${slotNo} recalculado con ${lockedList.length} bloqueos`, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e instanceof Error ? e.message : "Error interno") }, { status: 500 });
  }
}
