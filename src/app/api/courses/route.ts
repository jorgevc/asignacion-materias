import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId") || searchParams.get("semester_id");

  if (!semesterId) {
    // if no semester, try active semester
    const active = await prisma.semester.findFirst({ where: { isActive: true } });
    if (!active) return NextResponse.json({ error: "No active semester" }, { status: 404 });
    const courses = await prisma.course.findMany({
      where: { semesterId: active.id },
      orderBy: { code: "asc" },
    });
    return NextResponse.json(courses);
  }

  const id = Number(semesterId);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid semesterId" }, { status: 400 });

  const courses = await prisma.course.findMany({
    where: { semesterId: id },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(courses);
}
