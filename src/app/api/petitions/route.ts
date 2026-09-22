import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SlotInput = {
  slot_no: number;
  options: { courseId: number; priority: number }[];
};

class PetitionsLockedError extends Error {}

// GET /api/petitions?employeeId=...&email=...&semesterId=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId") || searchParams.get("employee_id");
  const email = searchParams.get("email");
  const semesterIdParam = searchParams.get("semesterId") || searchParams.get("semester_id");

  if (!employeeId && !email) {
    return NextResponse.json({ error: "employeeId o email requerido" }, { status: 400 });
  }

  let sid: number;
  if (semesterIdParam) {
    sid = Number(semesterIdParam);
    if (Number.isNaN(sid)) return NextResponse.json({ error: "semesterId inválido" }, { status: 400 });
  } else {
    const active = await prisma.semester.findFirst({ where: { isActive: true } });
    if (!active) return NextResponse.json({ error: "No hay un semestre activo" }, { status: 404 });
    sid = active.id;
  }

  let teacher = null;
  if (employeeId) {
    const empNorm = employeeId.trim().toUpperCase();
    teacher = await prisma.teacher.findFirst({
      where: {
        OR: [
          { employeeId: empNorm },
          { employeeId: employeeId.trim() },
        ],
      },
    });
  }

  if (!teacher && email) {
    teacher = await prisma.teacher.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  if (!teacher) {
    return NextResponse.json({
      teacher: null,
      isSubmitted: false,
      slots: [],
    });
  }

  const petitions = await prisma.petition.findMany({
    where: { teacherId: teacher.id, semesterId: sid },
    include: { course: true },
    orderBy: [{ slotNo: "asc" }, { id: "asc" }],
  });

  const isSubmitted = petitions.length > 0;
  const submittedAt = petitions.length > 0 ? petitions[0].createdAt : null;

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
    teacher: {
      id: teacher.id,
      employeeId: teacher.employeeId,
      email: teacher.email,
      name: teacher.name,
      phone: teacher.phone,
    },
    isSubmitted,
    submittedAt,
    slots,
  });
}

// POST /api/petitions
// body: { employeeId, email, name, phone, semesterId, slots: [{slot_no, options:[{courseId, priority}]}] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { employeeId, email, name, phone, semesterId, slots } = body as {
      employeeId?: string;
      email?: string;
      name?: string;
      phone?: string;
      semesterId?: number;
      slots?: SlotInput[];
    };

    if (!employeeId && !email) {
      return NextResponse.json({ error: "No. de Trabajador o email es requerido" }, { status: 400 });
    }
    if (!name || !slots) {
      return NextResponse.json({ error: "Nombre y slots son requeridos" }, { status: 400 });
    }

    const empNorm = employeeId ? employeeId.trim().toUpperCase() : null;
    const emailNorm = email ? email.toLowerCase().trim() : "";
    if (emailNorm && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const nameNorm = name.trim();
    if (nameNorm.length === 0 || nameNorm.length > 255) {
      return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
    }

    const phoneNorm = phone && String(phone).trim() ? String(phone).trim().slice(0, 50) : null;

    let sid: number;
    if (semesterId) {
      sid = Number(semesterId);
      if (Number.isNaN(sid)) return NextResponse.json({ error: "semesterId inválido" }, { status: 400 });
    } else {
      const active = await prisma.semester.findFirst({ where: { isActive: true } });
      if (!active) return NextResponse.json({ error: "No hay un semestre activo configurado" }, { status: 404 });
      sid = active.id;
    }

    const semester = await prisma.semester.findUnique({ where: { id: sid } });
    if (!semester) return NextResponse.json({ error: "Semestre no encontrado" }, { status: 404 });
    if (!semester.isActive) {
      return NextResponse.json({ error: "El semestre seleccionado no está activo para recepción de solicitudes." }, { status: 400 });
    }

    // Validation: slots must be 1-3, slot 1 required with exactly 3 options, slots 2,3 either absent or exactly 3
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: "La Solicitud 1 es obligatoria" }, { status: 400 });
    }

    const slotNos = slots.map((s) => s.slot_no).sort();
    if (!slotNos.includes(1)) {
      return NextResponse.json({ error: "La Solicitud 1er Curso es obligatoria" }, { status: 400 });
    }
    const uniqueSlotNos = new Set(slotNos);
    if (uniqueSlotNos.size !== slots.length) {
      return NextResponse.json({ error: "Número de slot duplicado" }, { status: 400 });
    }
    for (const s of slots) {
      if (![1, 2, 3].includes(s.slot_no)) {
        return NextResponse.json({ error: "El número de solicitud debe ser 1, 2 o 3" }, { status: 400 });
      }
      if (!Array.isArray(s.options)) {
        return NextResponse.json({ error: `La Solicitud ${s.slot_no} tiene un formato de opciones inválido` }, { status: 400 });
      }
      // Filtrar opciones válidas (descartando opciones vacías con courseId null, 0 o vacío)
      const validOptions = s.options.filter((o) => o && o.courseId && Number(o.courseId) > 0);
      if (validOptions.length === 0) {
        return NextResponse.json({ error: `La Solicitud ${s.slot_no} debe tener al menos 1 curso seleccionado` }, { status: 400 });
      }
      if (validOptions.length > 3) {
        return NextResponse.json({ error: `La Solicitud ${s.slot_no} no puede exceder 3 opciones` }, { status: 400 });
      }
      for (const opt of validOptions) {
        if (![1, 2, 3].includes(Number(opt.priority))) {
          return NextResponse.json({ error: `Solicitud ${s.slot_no}: cada curso requiere prioridad 1-3` }, { status: 400 });
        }
      }
      const courseIdsInSlot = validOptions.map((o) => Number(o.courseId));
      if (new Set(courseIdsInSlot).size !== courseIdsInSlot.length) {
        return NextResponse.json({ error: `Solicitud ${s.slot_no}: no se puede repetir el mismo curso dentro de la misma solicitud` }, { status: 400 });
      }
    }

    // Se permite tener cursos duplicados en diferentes slots porque las rondas de asignación se realizan de forma independiente
    const allCourseIds = Array.from(new Set(slots.flatMap((s) => s.options.filter((o) => o && o.courseId && Number(o.courseId) > 0).map((o) => Number(o.courseId)))));
    const courses = await prisma.course.findMany({
      where: { id: { in: allCourseIds }, semesterId: sid },
    });
    if (courses.length !== allCourseIds.length) {
      return NextResponse.json({ error: "Uno o más cursos no corresponden a este semestre" }, { status: 400 });
    }

    // Identify or create teacher
    let teacher = null;
    if (empNorm) {
      teacher = await prisma.teacher.findFirst({
        where: {
          OR: [{ employeeId: empNorm }, { employeeId: employeeId?.trim() }],
        },
      });
    }
    if (!teacher && emailNorm) {
      const byEmail = await prisma.teacher.findUnique({ where: { email: emailNorm } });
      if (byEmail) {
        if (empNorm && byEmail.employeeId && byEmail.employeeId !== empNorm) {
          return NextResponse.json(
            { error: `El correo ${emailNorm} ya pertenece al docente ${byEmail.name} con No. de Trabajador ${byEmail.employeeId}. Por favor verifica tu No. de Trabajador o utiliza tu correo correspondiente.` },
            { status: 409 }
          );
        }
        teacher = byEmail;
      }
    }

    if (teacher) {
      // Bloqueo estricto de modificación: si ya tiene peticiones para este semestre, RECHAZAR
      const existingPetitionsCount = await prisma.petition.count({
        where: { teacherId: teacher.id, semesterId: sid },
      });
      if (existingPetitionsCount > 0) {
        return NextResponse.json(
          { error: "Tus solicitudes para este semestre ya fueron enviadas y no se pueden modificar. Contacta a la coordinación académica si requieres una aclaración." },
          { status: 409 }
        );
      }

      // Validar si ya tiene asignaciones generadas
      const assignmentCount = await prisma.assignment.count({
        where: { teacherId: teacher.id, semesterId: sid },
      });
      if (assignmentCount > 0) {
        return NextResponse.json(
          { error: "No se pueden guardar las peticiones: este docente ya tiene asignaciones en este semestre. Contacte al administrador." },
          { status: 409 }
        );
      }

      // Actualizar datos de contacto del docente
      const updateData: Record<string, string | null> = { name: nameNorm };
      if (phoneNorm !== null) updateData.phone = phoneNorm;
      if (empNorm && !teacher.employeeId) updateData.employeeId = empNorm;
      if (emailNorm && !teacher.email) updateData.email = emailNorm;

      teacher = await prisma.teacher.update({
        where: { id: teacher.id },
        data: updateData,
      });
    } else {
      // Si el docente no existe, crear nuevo
      const effectiveEmail = emailNorm || `${empNorm?.toLowerCase()}@correo.buap.mx`;
      teacher = await prisma.teacher.create({
        data: {
          employeeId: empNorm,
          email: effectiveEmail,
          name: nameNorm,
          phone: phoneNorm,
        },
      });
    }

    // Insertar peticiones dentro de transacción
    await prisma.$transaction(async (tx) => {
      // Doble chequeo de concurrencia
      const count = await tx.petition.count({
        where: { teacherId: teacher.id, semesterId: sid },
      });
      if (count > 0) {
        throw new PetitionsLockedError();
      }

      for (const slot of slots) {
        const validOptions = slot.options.filter((o) => o && o.courseId && Number(o.courseId) > 0);
        for (const opt of validOptions) {
          await tx.petition.create({
            data: {
              teacherId: teacher.id,
              semesterId: sid,
              slotNo: slot.slot_no,
              courseId: Number(opt.courseId),
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
      isSubmitted: true,
      submittedAt: petitions[0]?.createdAt ?? new Date(),
      teacher: {
        id: teacher.id,
        employeeId: teacher.employeeId,
        email: teacher.email,
        name: teacher.name,
        phone: teacher.phone,
      },
      slots: resultSlots,
    });
  } catch (e) {
    if (e instanceof PetitionsLockedError) {
      return NextResponse.json(
        { error: "Tus solicitudes para este semestre ya fueron enviadas y no se pueden modificar." },
        { status: 409 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
