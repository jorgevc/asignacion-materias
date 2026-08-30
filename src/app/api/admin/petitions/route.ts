import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId") || searchParams.get("semester_id");

  let sid: number | undefined;
  if (semesterId) {
    sid = Number(semesterId);
    if (Number.isNaN(sid)) return NextResponse.json({ error: "Invalid semesterId" }, { status: 400 });
  } else {
    const active = await prisma.semester.findFirst({ where: { isActive: true } });
    if (!active) return NextResponse.json({ error: "No active semester" }, { status: 404 });
    sid = active.id;
  }

  const petitions = await prisma.petition.findMany({
    where: { semesterId: sid },
    include: {
      teacher: true,
      semester: true,
      course: true,
    },
    orderBy: [{ teacher: { name: "asc" } }, { slotNo: "asc" }, { id: "asc" }],
  });

  // Group by teacher + slotNo to reconstruct slots
  const slotMap = new Map<string, { teacher: (typeof petitions)[0]["teacher"]; semester: (typeof petitions)[0]["semester"]; slotNo: number; options: { courseId: number; course: (typeof petitions)[0]["course"]; priority: number }[]; createdAt: Date }>();
  for (const p of petitions) {
    const key = `${p.teacherId}-${p.slotNo}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, {
        teacher: p.teacher,
        semester: p.semester,
        slotNo: p.slotNo,
        options: [],
        createdAt: p.createdAt,
      });
    }
    const slot = slotMap.get(key)!;
    slot.options.push({ courseId: p.courseId, course: p.course, priority: p.priority });
    // keep earliest createdAt
    if (p.createdAt < slot.createdAt) slot.createdAt = p.createdAt;
  }

  const slots = Array.from(slotMap.values()).sort((a, b) => {
    if (a.teacher.name !== b.teacher.name) return a.teacher.name.localeCompare(b.teacher.name);
    return a.slotNo - b.slotNo;
  });

  const statsByCourse = await prisma.petition.groupBy({
    by: ["courseId"],
    where: { semesterId: sid },
    _count: { courseId: true },
  });

  const courses = await prisma.course.findMany({ where: { semesterId: sid } });
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  return NextResponse.json({
    semesterId: sid,
    totalTeachers: new Set(petitions.map((p) => p.teacherId)).size,
    totalSlots: slots.length,
    totalOptions: petitions.length,
    statsByCourse: statsByCourse.map((s) => ({
      courseId: s.courseId,
      course: courseMap.get(s.courseId),
      count: s._count.courseId,
    })),
    slots: slots.map((s) => ({
      slot_no: s.slotNo,
      teacher: s.teacher,
      semester: s.semester,
      options: s.options,
      createdAt: s.createdAt,
    })),
  });
}
