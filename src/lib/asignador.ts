import { prisma } from "@/lib/prisma";
import {
  Prioridad,
  calcularPuntaje,
  calcularPuntajeDetalle,
  ContextoNivel,
  Solicitud,
} from "@/lib/sistemaAsignacion";

export type Empate = {
  courseId: number;
  courseCode: string;
  courseName: string;
  priority: number;
  puntaje: number;
  tied: Array<{
    teacherId: number;
    teacherName: string;
    puntaje: number;
    detalle: ReturnType<typeof calcularPuntajeDetalle>;
    petitionId: number;
  }>;
};

export type AsignarSlotResult = {
  semesterId: number;
  slotNo: number;
  asignados: Array<{
    teacherId: number;
    teacherName: string;
    courseId: number;
    courseCode: string;
    courseName: string;
    priority: number;
    puntaje: number;
    detalle: ReturnType<typeof calcularPuntajeDetalle>;
  }>;
  noAsignados: Array<{
    teacherId: number;
    teacherName: string;
    petitionId: number;
    courseId: number;
    courseCode: string;
    priority: number;
    puntaje: number;
    razon: string;
  }>;
  empates: Empate[];
  cursosRestantes: number;
};

export async function asignarSlot(semesterId: number, slotNo: number, locked: Array<{ courseId: number; teacherId: number }> = []): Promise<AsignarSlotResult> {
  if (![1, 2, 3].includes(slotNo)) throw new Error("slotNo debe ser 1,2,3");
  const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
  if (!semester) throw new Error("Semestre no encontrado");

  // FIX punto 5: excluir solo otros slots para simulación correcta
  const asignadosPrevios = await prisma.assignment.findMany({
    where: { semesterId, slotNo: { not: slotNo } },
    select: { courseId: true },
  });
  const asignadosCourseIds = new Set(asignadosPrevios.map((a) => a.courseId));

  const cursosDisponibles = await prisma.course.findMany({
    where: { semesterId, id: { notIn: Array.from(asignadosCourseIds) } },
  });
  const disponibleSet = new Set(cursosDisponibles.map((c) => c.id));

  const petitions = await prisma.petition.findMany({
    where: { semesterId, slotNo, courseId: { in: Array.from(disponibleSet) } },
    include: { teacher: true, course: true },
    orderBy: [{ teacherId: "asc" }, { priority: "asc" }, { id: "asc" }],
  });

  if (petitions.length === 0) {
    return { semesterId, slotNo, asignados: [], noAsignados: [], empates: [], cursosRestantes: 0 };
  }

  // FIX punto 3: exp por curso, no global
  const teacherIds = Array.from(new Set(petitions.map((p) => p.teacherId)));
  const courseCodes = Array.from(new Set(petitions.map((p) => p.course.code)));
  const exps = await prisma.teacherCourseExp.findMany({
    where: { teacherId: { in: teacherIds }, courseCode: { in: courseCodes } },
  });
  const expMap = new Map<string, number>();
  for (const e of exps) expMap.set(`${e.teacherId}_${e.courseCode}`, e.years);
  const getExp = (teacherId: number, courseCode: string, fallback: number) => {
    const v = expMap.get(`${teacherId}_${courseCode}`);
    return v !== undefined ? v : (fallback ?? 0);
  };

  // Agrupar por teacher
  const byTeacher = new Map<number, typeof petitions>();
  for (const p of petitions) {
    if (!byTeacher.has(p.teacherId)) byTeacher.set(p.teacherId, []);
    byTeacher.get(p.teacherId)!.push(p);
  }

  type TeacherState = {
    teacher: (typeof petitions)[0]["teacher"];
    petitions: typeof petitions;
    assigned: boolean;
    assignedPetitionId: number | null;
    perdioP1: boolean;
    perdioP2: boolean;
    flexPrevPerdida: boolean;
  };

  const states = new Map<number, TeacherState>();
  for (const [teacherId, list] of byTeacher.entries()) {
    states.set(teacherId, {
      teacher: list[0].teacher,
      petitions: list,
      assigned: false,
      assignedPetitionId: null,
      perdioP1: false,
      perdioP2: false,
      flexPrevPerdida: false,
    });
  }

  const asignados: AsignarSlotResult["asignados"] = [];
  const noAsignados: AsignarSlotResult["noAsignados"] = [];
  const empates: Empate[] = [];
  const cursosAsignadosEnEsteSlot = new Set<number>();
  const teachersAsignadosEnEsteSlot = new Set<number>();

  // FIX punto 1: locked no se pre-asigna con perdio falso; se maneja intra-prioridad con puntaje correcto
  const lockedMap = new Map<number, number>(locked.map((l) => [l.courseId, l.teacherId]));

  for (const prioridad of [1, 2, 3] as Prioridad[]) {
    // Recoger candidatos de esta prioridad
    let candidatos: Array<{
      petition: (typeof petitions)[0];
      puntaje: number;
      detalle: ReturnType<typeof calcularPuntajeDetalle>;
      teacherState: TeacherState;
    }> = [];

    for (const [teacherId, state] of states.entries()) {
      if (state.assigned) continue;
      if (teachersAsignadosEnEsteSlot.has(teacherId)) continue;

      const rawGroup = state.petitions.filter((p) => p.priority === prioridad);
      if (rawGroup.length === 0) continue;

      // FIX punto 2: esUltima sobre restantes, no grupo original
      const availableGroup = rawGroup.filter(
        (p) => !cursosAsignadosEnEsteSlot.has(p.courseId) && !asignadosCourseIds.has(p.courseId) && disponibleSet.has(p.courseId)
      );
      if (availableGroup.length === 0) continue;

      for (let i = 0; i < availableGroup.length; i++) {
        const p = availableGroup[i];
        const contexto: ContextoNivel = {
          totalOpciones: availableGroup.length,
          esUltima: i === availableGroup.length - 1,
        };
        const exp = getExp(state.teacher.id, p.course.code, state.teacher.expYears ?? 0);
        const solicitud: Solicitud = {
          prioridad: prioridad as Prioridad,
          expAnos: exp,
          perdioP1: state.perdioP1,
          perdioP2: state.perdioP2,
        };
        const puntaje = calcularPuntaje(solicitud, contexto, state.flexPrevPerdida);
        const detalle = calcularPuntajeDetalle(solicitud, contexto, state.flexPrevPerdida);
        candidatos.push({ petition: p, puntaje, detalle, teacherState: state });
      }
    }

    // FIX punto 1: aplicar bloqueo intra-prioridad: solo el docente bloqueado puede ganar ese curso
    if (lockedMap.size > 0) {
      const lockedForThisPrioridad = new Map<number, number>();
      for (const [courseId, teacherId] of lockedMap.entries()) {
        const pet = petitions.find((p) => p.courseId === courseId && p.teacherId === teacherId && p.priority === prioridad);
        if (pet) lockedForThisPrioridad.set(courseId, teacherId);
      }
      if (lockedForThisPrioridad.size > 0) {
        candidatos = candidatos.filter((c) => {
          if (lockedForThisPrioridad.has(c.petition.courseId)) {
            return lockedForThisPrioridad.get(c.petition.courseId) === c.teacherState.teacher.id;
          }
          return true;
        });
        // Si un curso bloqueado no tiene candidato (porque el docente ya no disponible), se ignora
      }
    }

    if (candidatos.length === 0) {
      // FIX punto 3: marcar perdio solo si tenía petitions disponibles en esta prioridad y no logró candidato por competencia, no por falta de demanda
      for (const [teacherId, state] of states.entries()) {
        if (state.assigned) continue;
        const rawGroup = state.petitions.filter((p) => p.priority === prioridad);
        if (rawGroup.length === 0) continue;
        const availableGroup = rawGroup.filter(
          (p) => !cursosAsignadosEnEsteSlot.has(p.courseId) && !asignadosCourseIds.has(p.courseId) && disponibleSet.has(p.courseId)
        );
        if (availableGroup.length === 0) continue; // sin demanda real, no es pérdida
        const hasCandidate = candidatos.some((c) => c.teacherState.teacher.id === teacherId);
        if (!hasCandidate) {
          // Perdió toda la prioridad (sin chance) - todos sus cursos de esta prioridad fueron tomados o no compitió
          if (prioridad === 1) {
            state.perdioP1 = true;
            state.flexPrevPerdida = availableGroup.length > 1;
          } else if (prioridad === 2) {
            state.perdioP2 = true;
            state.flexPrevPerdida = availableGroup.length > 1 ? true : state.flexPrevPerdida;
          }
        }
      }
      continue;
    }

    // FIX punto 5: empates filtra asignados/locked y cursos sin demanda ya excluidos
    const byCourseTmp = new Map<number, typeof candidatos>();
    for (const c of candidatos) {
      if (cursosAsignadosEnEsteSlot.has(c.petition.courseId) || asignadosCourseIds.has(c.petition.courseId)) continue;
      if (!byCourseTmp.has(c.petition.courseId)) byCourseTmp.set(c.petition.courseId, []);
      byCourseTmp.get(c.petition.courseId)!.push(c);
    }
    for (const [courseId, list] of byCourseTmp.entries()) {
      list.sort((a, b) => {
        if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
        // FIX punto 4: tie-break exp ya está en puntaje, pero lo mantenemos como desempate secundario por curso (no global)
        const expA = getExp(a.teacherState.teacher.id, a.petition.course.code, a.teacherState.teacher.expYears ?? 0);
        const expB = getExp(b.teacherState.teacher.id, b.petition.course.code, b.teacherState.teacher.expYears ?? 0);
        if (expB !== expA) return expB - expA;
        return a.petition.id - b.petition.id;
      });
      if (list.length >= 2 && list[0].puntaje === list[1].puntaje && !cursosAsignadosEnEsteSlot.has(courseId) && !asignadosCourseIds.has(courseId)) {
        const tied = list.filter((x) => x.puntaje === list[0].puntaje);
        // filtrar locked: si curso está bloqueado, no reportar empate (ya resuelto)
        if (lockedMap.has(courseId)) continue;
        empates.push({
          courseId,
          courseCode: list[0].petition.course.code,
          courseName: list[0].petition.course.name,
          priority: prioridad,
          puntaje: list[0].puntaje,
          tied: tied.map((t) => ({
            teacherId: t.teacherState.teacher.id,
            teacherName: t.teacherState.teacher.name,
            puntaje: t.puntaje,
            detalle: t.detalle,
            petitionId: t.petition.id,
          })),
        });
      }
    }

    // Asignación 1 curso / 1 profesor por slot: ordenar todos los candidatos por puntaje desc y asignar si ambos libres
    candidatos.sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      const expA = getExp(a.teacherState.teacher.id, a.petition.course.code, a.teacherState.teacher.expYears ?? 0);
      const expB = getExp(b.teacherState.teacher.id, b.petition.course.code, b.teacherState.teacher.expYears ?? 0);
      if (expB !== expA) return expB - expA;
      return a.petition.id - b.petition.id;
    });

    const asignacionesEstaPrioridad: typeof candidatos = [];
    for (const c of candidatos) {
      const teacherId = c.teacherState.teacher.id;
      const courseId = c.petition.courseId;
      if (cursosAsignadosEnEsteSlot.has(courseId) || asignadosCourseIds.has(courseId) || teachersAsignadosEnEsteSlot.has(teacherId) || c.teacherState.assigned) continue;
      // Si curso está bloqueado para otro docente, ya filtrado arriba, pero por seguridad
      if (lockedMap.has(courseId) && lockedMap.get(courseId) !== teacherId) continue;
      asignacionesEstaPrioridad.push(c);
      cursosAsignadosEnEsteSlot.add(courseId);
      teachersAsignadosEnEsteSlot.add(teacherId);
    }
    // Crear asignados reales
    for (const g of asignacionesEstaPrioridad) {
      const teacherId = g.teacherState.teacher.id;
      const courseId = g.petition.courseId;
      if (asignados.some((a) => a.courseId === courseId || a.teacherId === teacherId)) continue;
      asignados.push({
        teacherId,
        teacherName: g.teacherState.teacher.name,
        courseId,
        courseCode: g.petition.course.code,
        courseName: g.petition.course.name,
        priority: g.petition.priority,
        puntaje: g.puntaje,
        detalle: g.detalle,
      });
      const st = states.get(teacherId)!;
      st.assigned = true;
      st.assignedPetitionId = g.petition.id;
    }

    // Para teachers no asignados en esta prioridad que tenían petitions en esta prioridad, marcar perdio
    for (const [teacherId, state] of states.entries()) {
      if (state.assigned || teachersAsignadosEnEsteSlot.has(teacherId)) continue;
      const rawGroup = state.petitions.filter((p) => p.priority === prioridad);
      if (rawGroup.length === 0) continue;
      const availableGroup = rawGroup.filter(
        (p) => !cursosAsignadosEnEsteSlot.has(p.courseId) && !asignadosCourseIds.has(p.courseId) && disponibleSet.has(p.courseId)
      );
      if (availableGroup.length === 0) continue;
      const gano = asignacionesEstaPrioridad.some((a) => a.teacherState.teacher.id === teacherId);
      if (!gano) {
        if (prioridad === 1) {
          state.perdioP1 = true;
          state.flexPrevPerdida = availableGroup.length > 1;
        } else if (prioridad === 2) {
          state.perdioP2 = true;
          if (availableGroup.length > 1) state.flexPrevPerdida = true;
        }
      } else {
        state.flexPrevPerdida = false;
      }
    }

    const pendientes = Array.from(states.values()).filter((s) => !s.assigned && !teachersAsignadosEnEsteSlot.has(s.teacher.id));
    if (pendientes.length === 0) break;
  }

  // Construir noAsignados para reporte
  for (const [teacherId, state] of states.entries()) {
    if (teachersAsignadosEnEsteSlot.has(teacherId) || state.assigned) continue;
    for (const p of state.petitions) {
      if (cursosAsignadosEnEsteSlot.has(p.courseId) || asignadosCourseIds.has(p.courseId)) {
        noAsignados.push({
          teacherId,
          teacherName: state.teacher.name,
          petitionId: p.id,
          courseId: p.courseId,
          courseCode: p.course.code,
          priority: p.priority,
          puntaje: 0,
          razon: "curso ya asignado",
        });
      } else {
        const rawGroup = state.petitions.filter((x) => x.priority === p.priority);
        const availableGroup = rawGroup.filter((x) => !cursosAsignadosEnEsteSlot.has(x.courseId) && !asignadosCourseIds.has(x.courseId) && disponibleSet.has(x.courseId));
        const idx = availableGroup.findIndex((x) => x.id === p.id);
        const contexto: ContextoNivel = { totalOpciones: availableGroup.length || rawGroup.length, esUltima: idx === availableGroup.length - 1 && idx !== -1 };
        const exp = getExp(state.teacher.id, p.course.code, state.teacher.expYears ?? 0);
        const solicitud: Solicitud = { prioridad: p.priority as Prioridad, expAnos: exp, perdioP1: state.perdioP1, perdioP2: state.perdioP2 };
        const puntaje = calcularPuntaje(solicitud, contexto, state.flexPrevPerdida);
        noAsignados.push({
          teacherId,
          teacherName: state.teacher.name,
          petitionId: p.id,
          courseId: p.courseId,
          courseCode: p.course.code,
          priority: p.priority,
          puntaje,
          razon: "no alcanzó puntaje / sin cupo",
        });
      }
    }
  }

  // FIX punto 5: cursosRestantes solo con demanda (cursos que tienen al menos una petition en este slot)
  const cursosConDemanda = new Set(petitions.map((p) => p.courseId));
  const cursosRestantesConDemanda = Array.from(cursosConDemanda).filter((id) => !cursosAsignadosEnEsteSlot.has(id) && !asignadosCourseIds.has(id)).length;

  return {
    semesterId,
    slotNo,
    asignados,
    noAsignados,
    empates,
    cursosRestantes: cursosRestantesConDemanda,
  };
}

export async function persistAsignaciones(result: AsignarSlotResult) {
  const toCreate: Array<{ teacherId: number; courseId: number; semesterId: number; slotNo: number; petitionId: number; priority: number; puntaje: number; detalle: string }> = [];
  for (const a of result.asignados) {
    const petition = await prisma.petition.findFirst({
      where: { teacherId: a.teacherId, semesterId: result.semesterId, slotNo: result.slotNo, courseId: a.courseId },
    });
    if (!petition) continue;
    toCreate.push({
      teacherId: a.teacherId,
      courseId: a.courseId,
      semesterId: result.semesterId,
      slotNo: result.slotNo,
      petitionId: petition.id,
      priority: a.priority,
      puntaje: a.puntaje,
      detalle: JSON.stringify(a.detalle),
    });
  }
  if (toCreate.length === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const data of toCreate) {
      await tx.assignment.upsert({
        where: { courseId: data.courseId },
        update: data,
        create: data,
      });
    }
  });
}
