import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId");
  if (semesterId) {
    const sid = Number(semesterId);
    if (!Number.isNaN(sid)) {
      const teachers = await prisma.teacher.findMany({
        where: { petitions: { some: { semesterId: sid } } },
        include: { exps: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(teachers);
    }
  }
  const all = await prisma.teacher.findMany({ include: { exps: true }, orderBy: { name: "asc" } });
  return NextResponse.json(all);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, expYears, courseCode, years } = body;
    const expVal = expYears ?? years;
    const code = courseCode ?? body.code;
    if (!email) return NextResponse.json({ error: "email requerido" }, { status: 400 });
    const exp = Number(expVal);
    if (Number.isNaN(exp) || exp < 0 || exp > 50) return NextResponse.json({ error: "expYears 0..50" }, { status: 400 });
    const teacher = await prisma.teacher.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!teacher) return NextResponse.json({ error: "Docente no encontrado" }, { status: 404 });
    // Si se especifica courseCode, es experiencia por curso (punto 3)
    if (code) {
      const up = await prisma.teacherCourseExp.upsert({
        where: { teacherId_courseCode: { teacherId: teacher.id, courseCode: String(code).trim() } },
        update: { years: Math.trunc(exp) },
        create: { teacherId: teacher.id, courseCode: String(code).trim(), years: Math.trunc(exp) },
      });
      return NextResponse.json({ ok: true, teacher, exp: up });
    }
    const updated = await prisma.teacher.update({ where: { email: email.toLowerCase().trim() }, data: { expYears: Math.trunc(exp) } });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
