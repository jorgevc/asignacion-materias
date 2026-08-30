import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId") || searchParams.get("semester_id");
  let sid: number | undefined;
  if (semesterId) {
    sid = Number(semesterId);
    if (Number.isNaN(sid)) return NextResponse.json({ error: "semesterId inválido" }, { status: 400 });
  } else {
    const active = await prisma.semester.findFirst({ where: { isActive: true } });
    if (!active) return NextResponse.json({ error: "No active semester" }, { status: 404 });
    sid = active.id;
  }

  const assignments = await prisma.assignment.findMany({
    where: { semesterId: sid },
    include: { teacher: true, course: true, semester: true },
    orderBy: [{ slotNo: "asc" }, { teacher: { name: "asc" } }],
  });

  return NextResponse.json({
    semesterId: sid,
    total: assignments.length,
    assignments: assignments.map((a) => ({
      id: a.id,
      teacherId: a.teacherId,
      courseId: a.courseId,
      semesterId: a.semesterId,
      slotNo: a.slotNo,
      priority: a.priority,
      puntaje: a.puntaje,
      detalle: a.detalle ? JSON.parse(a.detalle) : null,
      teacher: a.teacher,
      course: a.course,
      semester: a.semester,
      createdAt: a.createdAt,
    })),
  });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId");
  const slotNo = searchParams.get("slotNo");
  if (!semesterId) return NextResponse.json({ error: "semesterId requerido" }, { status: 400 });
  const sid = Number(semesterId);
  if (Number.isNaN(sid)) return NextResponse.json({ error: "semesterId inválido" }, { status: 400 });

  if (slotNo) {
    const sNo = Number(slotNo);
    if (![1, 2, 3].includes(sNo)) return NextResponse.json({ error: "slotNo 1..3" }, { status: 400 });
    const del = await prisma.assignment.deleteMany({ where: { semesterId: sid, slotNo: sNo } });
    return NextResponse.json({ ok: true, deleted: del.count, semesterId: sid, slotNo: sNo });
  } else {
    const del = await prisma.assignment.deleteMany({ where: { semesterId: sid } });
    return NextResponse.json({ ok: true, deleted: del.count, semesterId: sid });
  }
}
