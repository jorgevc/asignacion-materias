import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/teachers - lista de profesores o búsqueda por employeeId
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId") || searchParams.get("employee_id");

  if (employeeId) {
    const norm = employeeId.trim().toUpperCase();
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [
          { employeeId: norm },
          { employeeId: employeeId.trim() },
        ],
      },
      include: {
        _count: { select: { petitions: true, assignments: true } },
      },
    });
    if (!teacher) {
      return NextResponse.json({ error: "Docente no encontrado" }, { status: 404 });
    }
    return NextResponse.json(teacher);
  }

  const teachers = await prisma.teacher.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { petitions: true, assignments: true } },
    },
  });
  return NextResponse.json(teachers);
}

// POST /api/teachers - crear profesor
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").toLowerCase().trim();
    const name = String(body.name || "").trim();
    if (!email || !name) return NextResponse.json({ error: "email y name requeridos" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email inválido" }, { status: 400 });

    const employeeId = body.employeeId ? String(body.employeeId).trim() : null;
    if (employeeId) {
      const dup = await prisma.teacher.findUnique({ where: { employeeId } });
      if (dup) return NextResponse.json({ error: `No. de empleado ${employeeId} ya existe (docente ${dup.name})` }, { status: 409 });
    }

    const teacher = await prisma.teacher.create({
      data: {
        email,
        name,
        employeeId,
        phone: body.phone ? String(body.phone).trim() : null,
        affiliation: body.affiliation === "Externo" ? "Externo" : "Interno",
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        note: body.note ? String(body.note).trim() : null,
      },
    });
    return NextResponse.json(teacher);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/teachers - actualizar por id
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Docente no encontrado" }, { status: 404 });

    const data: Record<string, string | boolean | null> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "name no puede estar vacío" }, { status: 400 });
      data.name = name;
    }
    if (body.email !== undefined) {
      const email = String(body.email).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
      data.email = email;
    }
    if (body.employeeId !== undefined) {
      const employeeId = body.employeeId ? String(body.employeeId).trim() : null;
      if (employeeId) {
        const dup = await prisma.teacher.findUnique({ where: { employeeId } });
        if (dup && dup.id !== id) return NextResponse.json({ error: `No. de empleado ${employeeId} ya existe (docente ${dup.name})` }, { status: 409 });
      }
      data.employeeId = employeeId;
    }
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.affiliation !== undefined) data.affiliation = body.affiliation === "Externo" ? "Externo" : "Interno";
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.note !== undefined) data.note = body.note ? String(body.note).trim() : null;

    const teacher = await prisma.teacher.update({ where: { id }, data });
    return NextResponse.json(teacher);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/teachers?id=N - borrar solo si no tiene peticiones/asignaciones
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [petitions, assignments] = await Promise.all([
      prisma.petition.count({ where: { teacherId: id } }),
      prisma.assignment.count({ where: { teacherId: id } }),
    ]);
    if (petitions > 0 || assignments > 0) {
      return NextResponse.json(
        { error: `No se puede borrar: tiene ${petitions} peticiones y ${assignments} asignaciones` },
        { status: 409 }
      );
    }
    await prisma.teacher.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
