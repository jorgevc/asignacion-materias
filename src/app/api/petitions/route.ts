import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SlotInput = {
  slot_no: number;
  options: { courseId: number; priority: number }[];
};

// GET /api/petitions?email=...&semesterId=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const semesterId = searchParams.get("semesterId") || searchParams.get("semester_id");

  if (!email || !semesterId) {
    return NextResponse.json({ error: "email and semesterId required" }, { status: 400 });
  }

  const id = Number(semesterId);
  const teacher = await prisma.teacher.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!teacher) return NextResponse.json({ slots: [] });

  const petitions = await prisma.petition.findMany({
    where: { teacherId: teacher.id, semesterId: id },
    include: { course: true },
    orderBy: [{ slotNo: "asc" }, { id: "asc" }],
  });

  // Group by slotNo
  const grouped = new Map<number, typeof petitions>();
  for (const p of petitions) {
    if (!grouped.has(p.slotNo)) grouped.set(p.slotNo, []);
    grouped.get(p.slotNo)!.push(p);
  }

  const slots = Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([slotNo, opts]) => ({
      slot_no: slotNo,
      options: opts.map((o) => ({
        courseId: o.courseId,
        course: o.course,
        priority: o.priority,
      })),
    }));

  return NextResponse.json({
    teacher: { id: teacher.id, email: teacher.email, name: teacher.name },
    slots,
  });
}

// POST /api/petitions
// body: { email, name, semesterId, slots: [{slot_no, options:[{courseId, priority}]}] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, semesterId, slots } = body as {
      email: string;
      name: string;
      semesterId: number;
      slots: SlotInput[];
    };

    if (!email || !name || !semesterId || !slots) {
      return NextResponse.json({ error: "email, name, semesterId, slots required" }, { status: 400 });
    }

    const emailNorm = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (emailNorm.length > 255) {
      return NextResponse.json({ error: "Email too long" }, { status: 400 });
    }

    const nameNorm = name.trim();
    if (nameNorm.length > 255) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }

    const sid = Number(semesterId);
    if (Number.isNaN(sid)) return NextResponse.json({ error: "Invalid semesterId" }, { status: 400 });

    const semester = await prisma.semester.findUnique({ where: { id: sid } });
    if (!semester) return NextResponse.json({ error: "Semester not found" }, { status: 404 });

    // Validation: slots must be 1-3, slot 1 required with exactly 3 options, slots 2,3 either absent or exactly 3
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: "At least slot 1 required" }, { status: 400 });
    }

    const slotNos = slots.map((s) => s.slot_no).sort();
    if (!slotNos.includes(1)) {
      return NextResponse.json({ error: "Slot 1 is required with 3 classes" }, { status: 400 });
    }
    const uniqueSlotNos = new Set(slotNos);
    if (uniqueSlotNos.size !== slots.length) {
      return NextResponse.json({ error: "Duplicate slot_no" }, { status: 400 });
    }
    for (const s of slots) {
      if (![1, 2, 3].includes(s.slot_no)) {
        return NextResponse.json({ error: "slot_no must be 1,2,3" }, { status: 400 });
      }
      if (!Array.isArray(s.options) || s.options.length !== 3) {
        return NextResponse.json({ error: `Slot ${s.slot_no} must have exactly 3 classes` }, { status: 400 });
      }
      for (const opt of s.options) {
        if (!opt.courseId || ![1, 2, 3].includes(Number(opt.priority))) {
          return NextResponse.json({ error: `Slot ${s.slot_no}: each option requires courseId and priority 1-3` }, { status: 400 });
        }
      }
      const courseIdsInSlot = s.options.map((o) => o.courseId);
      if (new Set(courseIdsInSlot).size !== 3) {
        return NextResponse.json({ error: `Slot ${s.slot_no}: duplicate course` }, { status: 400 });
      }
    }

    const allCourseIds = slots.flatMap((s) => s.options.map((o) => o.courseId));
    if (new Set(allCourseIds).size !== allCourseIds.length) {
      return NextResponse.json({ error: "Same course cannot be requested in multiple slots" }, { status: 400 });
    }

    const courses = await prisma.course.findMany({
      where: { id: { in: allCourseIds }, semesterId: sid },
    });
    if (courses.length !== allCourseIds.length) {
      return NextResponse.json({ error: "One or more courses not found for this semester" }, { status: 400 });
    }

    const teacher = await prisma.teacher.upsert({
      where: { email: emailNorm },
      update: { name: nameNorm },
      create: { email: emailNorm, name: nameNorm },
    });

    await prisma.$transaction(async (tx) => {
      await tx.petition.deleteMany({
        where: { teacherId: teacher.id, semesterId: sid },
      });

      for (const slot of slots) {
        for (const opt of slot.options) {
          await tx.petition.create({
            data: {
              teacherId: teacher.id,
              semesterId: sid,
              slotNo: slot.slot_no,
              courseId: opt.courseId,
              priority: Number(opt.priority),
            },
          });
        }
      }
    });

    const petitions = await prisma.petition.findMany({
      where: { teacherId: teacher.id, semesterId: sid },
      include: { course: true },
      orderBy: [{ slotNo: "asc" }, { id: "asc" }],
    });

    const grouped = new Map<number, typeof petitions>();
    for (const p of petitions) {
      if (!grouped.has(p.slotNo)) grouped.set(p.slotNo, []);
      grouped.get(p.slotNo)!.push(p);
    }

    const resultSlots = Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([slotNo, opts]) => ({
        slot_no: slotNo,
        options: opts.map((o) => ({
          courseId: o.courseId,
          course: o.course,
          priority: o.priority,
        })),
      }));

    return NextResponse.json({
      ok: true,
      teacher: { id: teacher.id, email: teacher.email, name: teacher.name },
      slots: resultSlots,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
