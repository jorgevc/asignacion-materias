import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Listar todos los semestres
export async function GET() {
  try {
    const semesters = await prisma.semester.findMany({
      orderBy: [{ year: "desc" }, { term: "desc" }],
    });
    return NextResponse.json(semesters);
  } catch (error) {
    console.error("Error fetching semesters:", error);
    return NextResponse.json({ error: "Error al obtener semestres" }, { status: 500 });
  }
}

// POST: Crear un nuevo semestre
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { label, year, term, setActive } = body;

    if (!label || !year || !term) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: label, year o term" },
        { status: 400 }
      );
    }

    const trimmedLabel = String(label).trim();
    const parsedYear = parseInt(String(year), 10);
    const trimmedTerm = String(term).trim();

    if (isNaN(parsedYear)) {
      return NextResponse.json({ error: "El año debe ser numérico" }, { status: 400 });
    }

    // Verificar si ya existe con esa etiqueta
    const existing = await prisma.semester.findUnique({
      where: { label: trimmedLabel },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un semestre con la etiqueta "${trimmedLabel}"` },
        { status: 400 }
      );
    }

    let createdSemester;
    if (setActive) {
      createdSemester = await prisma.$transaction(async (tx) => {
        await tx.semester.updateMany({ data: { isActive: false } });
        return await tx.semester.create({
          data: {
            label: trimmedLabel,
            year: parsedYear,
            term: trimmedTerm,
            isActive: true,
          },
        });
      });
    } else {
      createdSemester = await prisma.semester.create({
        data: {
          label: trimmedLabel,
          year: parsedYear,
          term: trimmedTerm,
          isActive: false,
        },
      });
    }

    return NextResponse.json(createdSemester, { status: 201 });
  } catch (error: any) {
    console.error("Error creating semester:", error);
    return NextResponse.json(
      { error: error?.message || "Error al crear semestre" },
      { status: 500 }
    );
  }
}

// PATCH: Activar un semestre existente
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID de semestre requerido" }, { status: 400 });
    }

    const semesterId = Number(id);
    const target = await prisma.semester.findUnique({ where: { id: semesterId } });

    if (!target) {
      return NextResponse.json({ error: "Semestre no encontrado" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.semester.updateMany({ data: { isActive: false } });
      return await tx.semester.update({
        where: { id: semesterId },
        data: { isActive: true },
      });
    });

    return NextResponse.json({ success: true, activeSemester: updated });
  } catch (error: any) {
    console.error("Error activating semester:", error);
    return NextResponse.json(
      { error: error?.message || "Error al activar semestre" },
      { status: 500 }
    );
  }
}
