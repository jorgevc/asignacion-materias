import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
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
  for (const e of exps) expMap.set(`${e.teacherId}_${e.courseCode}`, e.periods);
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
    assignedCourseId: number | null;
    assignedPetitionId: number | null;
    perdioP1: boolean;
    perdioP2: boolean;
    flexPrevPerdida: boolean;
    currentPrio: 1 | 2 | 3;
    triedPetitionIds: Set<number>;
  };

  const states = new Map<number, TeacherState>();
  for (const [teacherId, list] of byTeacher.entries()) {
    states.set(teacherId, {
      teacher: list[0].teacher,
      petitions: list,
      assignedCourseId: null,
      assignedPetitionId: null,
      perdioP1: false,
      perdioP2: false,
      flexPrevPerdida: false,
      currentPrio: 1,
      triedPetitionIds: new Set(),
    });
  }

  type TentativeHolder = {
    teacherId: number;
    teacherName: string;
    petition: (typeof petitions)[0];
    puntaje: number;
    detalle: ReturnType<typeof calcularPuntajeDetalle>;
    exp: number;
  };

  const courseHolders = new Map<number, TentativeHolder>();
  const empatesMap = new Map<number, Empate>();
  const lockedMap = new Map<number, number>(locked.map((l) => [l.courseId, l.teacherId]));

  let iteration = 0;
  const maxIterations = 500;

  while (iteration < maxIterations) {
    iteration++;

    type Proposal = {
      teacherId: number;
      teacherState: TeacherState;
      petition: (typeof petitions)[0];
      puntaje: number;
      detalle: ReturnType<typeof calcularPuntajeDetalle>;
      exp: number;
    };

    const newProposals: Proposal[] = [];

    for (const [teacherId, state] of states.entries()) {
      if (state.assignedCourseId !== null) continue;

      // Buscar peticiones viables no intentadas en su prioridad actual
      while (state.currentPrio <= 3) {
        const untriedInPrio = state.petitions.filter(
          (p) =>
            p.priority === state.currentPrio &&
            !state.triedPetitionIds.has(p.id) &&
            disponibleSet.has(p.courseId) &&
            !asignadosCourseIds.has(p.courseId)
        );

        if (untriedInPrio.length > 0) {
          const allInPrio = state.petitions.filter((p) => p.priority === state.currentPrio);
          for (const p of untriedInPrio) {
            const contexto: ContextoNivel = {
              totalOpciones: allInPrio.length,
              esUltima: untriedInPrio.length <= 1,
            };
            const exp = getExp(
              state.teacher.id,
              p.course.code,
              (state.teacher as any).expPeriods ?? (state.teacher as any).expYears ?? 0
            );
            const solicitud: Solicitud = {
              prioridad: state.currentPrio as Prioridad,
              expPeriodos: exp,
              perdioP1: state.perdioP1,
              perdioP2: state.perdioP2,
            };
            const puntaje = calcularPuntaje(solicitud, contexto, state.flexPrevPerdida);
            const detalle = calcularPuntajeDetalle(solicitud, contexto, state.flexPrevPerdida);
            newProposals.push({
              teacherId,
              teacherState: state,
              petition: p,
              puntaje,
              detalle,
              exp,
            });
          }
          break;
        } else {
          // Si no tiene más opciones en este nivel de prioridad, transitar al siguiente
          if (state.currentPrio === 1) {
            state.perdioP1 = true;
            const p1Opts = state.petitions.filter((p) => p.priority === 1);
            state.flexPrevPerdida = p1Opts.length > 1;
            state.currentPrio = 2;
          } else if (state.currentPrio === 2) {
            state.perdioP2 = true;
            const p2Opts = state.petitions.filter((p) => p.priority === 2);
            if (p2Opts.length > 1) state.flexPrevPerdida = true;
            state.currentPrio = 3;
          } else {
            state.currentPrio = 4 as any;
            break;
          }
        }
      }
    }

    if (newProposals.length === 0) break;

    const proposalsByCourse = new Map<number, Proposal[]>();
    for (const prop of newProposals) {
      if (!proposalsByCourse.has(prop.petition.courseId)) {
        proposalsByCourse.set(prop.petition.courseId, []);
      }
      proposalsByCourse.get(prop.petition.courseId)!.push(prop);
    }

    let anyAssignmentChanged = false;

    for (const [courseId, plist] of proposalsByCourse.entries()) {
      type CompetingCandidate = {
        teacherId: number;
        teacherName: string;
        petition: (typeof petitions)[0];
        puntaje: number;
        detalle: ReturnType<typeof calcularPuntajeDetalle>;
        exp: number;
      };

      const candidates: CompetingCandidate[] = plist.map((p) => ({
        teacherId: p.teacherId,
        teacherName: p.teacherState.teacher.name,
        petition: p.petition,
        puntaje: p.puntaje,
        detalle: p.detalle,
        exp: p.exp,
      }));

      const currentHolder = courseHolders.get(courseId);
      if (currentHolder) {
        candidates.push({
          teacherId: currentHolder.teacherId,
          teacherName: currentHolder.teacherName,
          petition: currentHolder.petition,
          puntaje: currentHolder.puntaje,
          detalle: currentHolder.detalle,
          exp: currentHolder.exp,
        });
      }

      candidates.sort((a, b) => {
        if (lockedMap.has(courseId)) {
          const lTid = lockedMap.get(courseId);
          if (a.teacherId === lTid && b.teacherId !== lTid) return -1;
          if (b.teacherId === lTid && a.teacherId !== lTid) return 1;
        }
        // 1. Mayor puntaje
        if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
        // 2. Mayor experiencia
        if (b.exp !== a.exp) return b.exp - a.exp;
        // 3. Prioridad original (P1 antes que P2)
        if (a.petition.priority !== b.petition.priority) return a.petition.priority - b.petition.priority;
        // 4. Desempate determinista por petitionId
        return a.petition.id - b.petition.id;
      });

      // Detectar empates académicos en el 1er lugar (mismo puntaje, misma exp, misma prioridad)
      if (
        candidates.length >= 2 &&
        candidates[0].puntaje === candidates[1].puntaje &&
        candidates[0].exp === candidates[1].exp &&
        candidates[0].petition.priority === candidates[1].petition.priority &&
        !lockedMap.has(courseId)
      ) {
        const tiedList = candidates.filter(
          (c) =>
            c.puntaje === candidates[0].puntaje &&
            c.exp === candidates[0].exp &&
            c.petition.priority === candidates[0].petition.priority
        );
        empatesMap.set(courseId, {
          courseId,
          courseCode: candidates[0].petition.course.code,
          courseName: candidates[0].petition.course.name,
          priority: candidates[0].petition.priority,
          puntaje: candidates[0].puntaje,
          tied: tiedList.map((t) => ({
            teacherId: t.teacherId,
            teacherName: t.teacherName,
            puntaje: t.puntaje,
            detalle: t.detalle,
            petitionId: t.petition.id,
          })),
        });
      } else {
        empatesMap.delete(courseId);
      }

      const winner = candidates[0];

      if (!currentHolder || currentHolder.teacherId !== winner.teacherId) {
        anyAssignmentChanged = true;

        if (currentHolder) {
          const displacedState = states.get(currentHolder.teacherId)!;
          displacedState.assignedCourseId = null;
          displacedState.assignedPetitionId = null;
          displacedState.triedPetitionIds.add(currentHolder.petition.id);
        }

        const winnerState = states.get(winner.teacherId)!;
        if (winnerState.assignedCourseId !== null && winnerState.assignedCourseId !== courseId) {
          courseHolders.delete(winnerState.assignedCourseId);
        }

        courseHolders.set(courseId, {
          teacherId: winner.teacherId,
          teacherName: winner.teacherName,
          petition: winner.petition,
          puntaje: winner.puntaje,
          detalle: winner.detalle,
          exp: winner.exp,
        });

        winnerState.assignedCourseId = courseId;
        winnerState.assignedPetitionId = winner.petition.id;
      }

      for (let i = 1; i < candidates.length; i++) {
        const loser = candidates[i];
        const loserState = states.get(loser.teacherId);
        if (loserState && loserState.assignedCourseId !== courseId) {
          loserState.triedPetitionIds.add(loser.petition.id);
        }
      }
    }

    if (!anyAssignmentChanged) break;
  }

  // Construir asignados
  const asignados: AsignarSlotResult["asignados"] = Array.from(courseHolders.values()).map((h) => ({
    teacherId: h.teacherId,
    teacherName: h.teacherName,
    courseId: h.petition.courseId,
    courseCode: h.petition.course.code,
    courseName: h.petition.course.name,
    priority: h.petition.priority,
    puntaje: h.puntaje,
    detalle: h.detalle,
  }));

  // Construir noAsignados para reporte
  const noAsignados: AsignarSlotResult["noAsignados"] = [];
  for (const [teacherId, state] of states.entries()) {
    if (state.assignedCourseId !== null) continue;
    for (const p of state.petitions) {
      if (courseHolders.has(p.courseId) || asignadosCourseIds.has(p.courseId)) {
        noAsignados.push({
          teacherId,
          teacherName: state.teacher.name,
          petitionId: p.id,
          courseId: p.courseId,
          courseCode: p.course.code,
          priority: p.priority,
          puntaje: 0,
          razon: "curso ya asignado a otro docente",
        });
      } else {
        const allInPrio = state.petitions.filter((x) => x.priority === p.priority);
        const exp = getExp(state.teacher.id, p.course.code, (state.teacher as any).expPeriods ?? (state.teacher as any).expYears ?? 0);
        const validPrio = Math.min(3, Math.max(1, p.priority)) as Prioridad;
        const solicitud: Solicitud = { prioridad: validPrio, expPeriodos: exp, perdioP1: state.perdioP1, perdioP2: state.perdioP2 };
        const contexto: ContextoNivel = { totalOpciones: allInPrio.length, esUltima: true };
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

  // Cursos con demanda no asignados
  const cursosConDemanda = new Set(petitions.map((p) => p.courseId));
  const cursosRestantesConDemanda = Array.from(cursosConDemanda).filter(
    (id) => !courseHolders.has(id) && !asignadosCourseIds.has(id)
  ).length;

  return {
    semesterId,
    slotNo,
    asignados,
    noAsignados,
    empates: Array.from(empatesMap.values()),
    cursosRestantes: cursosRestantesConDemanda,
  };
}

export async function persistAsignaciones(result: AsignarSlotResult, client?: Prisma.TransactionClient) {
  const db = client ?? prisma;
  const toCreate: Array<{ teacherId: number; courseId: number; semesterId: number; slotNo: number; petitionId: number; priority: number; puntaje: number; detalle: string }> = [];
  for (const a of result.asignados) {
    const petition = await db.petition.findFirst({
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
  const upsertAll = async (tx: Prisma.TransactionClient) => {
    for (const data of toCreate) {
      await tx.assignment.upsert({
        where: { courseId: data.courseId },
        update: data,
        create: data,
      });
    }
  };
  if (client) {
    await upsertAll(client);
    return;
  }
  await prisma.$transaction(upsertAll);
}

export type RescueOption1 = {
  courseId: number;
  courseCode: string;
  courseName: string;
  horario: string | null;
  priority: number;
  currentHolder: {
    teacherId: number;
    teacherName: string;
    puntaje: number;
    optionsCount: number;
  } | null;
};

export type RescueOption2 = {
  targetCourseId: number;
  targetCourseCode: string;
  targetCourseName: string;
  displacedTeacherId: number;
  displacedTeacherName: string;
  alternativeCourseId: number;
  alternativeCourseCode: string;
  alternativeCourseName: string;
  description: string;
  locked: Array<{ courseId: number; teacherId: number }>;
};

export type RescueOption3 = {
  targetCourseId: number;
  targetCourseCode: string;
  targetCourseName: string;
  displacedTeacherId: number;
  displacedTeacherName: string;
  displacedTeacherOptionsCount: number;
  description: string;
  locked: Array<{ courseId: number; teacherId: number }>;
};

export type RescueOption4 = {
  id: string;
  category:
    | "seccion_alterna_ocupante"
    | "seccion_alterna_docente"
    | "vacante_experiencia_ocupante"
    | "vacante_experiencia_docente";
  categoryLabel: string;
  reassignedTeacherId: number;
  reassignedTeacherName: string;
  vistoBuenoTeacherName: string;
  targetCourseId: number;
  targetCourseCode: string;
  targetCourseName: string;
  targetCourseHorario: string | null;
  destinationCourseId: number;
  destinationCourseCode: string;
  destinationCourseName: string;
  destinationCourseHorario: string | null;
  description: string;
  alertVistoBueno: string;
  locked: Array<{ courseId: number; teacherId: number }>;
};

export type VacantCourseInfo = {
  id: number;
  code: string;
  name: string;
  horario: string | null;
  dias: string | null;
  ubicacion: string | null;
  cupo: number | null;
};

export type TeacherRegisteredOption = {
  priority: number;
  courseId: number;
  courseCode: string;
  courseName: string;
  horario: string | null;
  dias: string | null;
  ubicacion: string | null;
  cupo: number | null;
  statusType: "occupied_this_slot" | "assigned_other_slot" | "vacant";
  statusText: string;
  currentHolderName?: string;
  currentHolderPuntaje?: number;
  assignedSlotNo?: number;
};

export type TeacherRescueCase = {
  teacherId: number;
  teacherName: string;
  optionsCount: number;
  registeredOptions: TeacherRegisteredOption[];
  opcion1_bloqueo: RescueOption1[];
  opcion2_cederPaso: RescueOption2[];
  opcion3_proteccionUniversal: RescueOption3[];
  opcion4_potenciales: RescueOption4[];
};

export type RescueAnalysisResult = {
  semesterId: number;
  slotNo: number;
  unassigned3OptsCount: number;
  cases: TeacherRescueCase[];
  vacantCourses: VacantCourseInfo[];
};

export async function analizarOpcionesRescate(
  semesterId: number,
  slotNo: number,
  currentResult?: AsignarSlotResult
): Promise<RescueAnalysisResult> {
  // Si no se pasó currentResult, verificar primero si ya existen asignaciones persistidas en BD para este slot
  let assignedItems: Array<{
    teacherId: number;
    teacherName: string;
    courseId: number;
    courseCode: string;
    courseName: string;
    priority: number;
    puntaje: number;
  }> = [];

  if (currentResult) {
    assignedItems = currentResult.asignados;
  } else {
    const dbAssignments = await prisma.assignment.findMany({
      where: { semesterId, slotNo },
      include: { teacher: true, course: true },
    });
    if (dbAssignments.length > 0) {
      assignedItems = dbAssignments.map((a) => ({
        teacherId: a.teacherId,
        teacherName: a.teacher.name,
        courseId: a.courseId,
        courseCode: a.course.code,
        courseName: a.course.name,
        priority: a.priority,
        puntaje: a.puntaje,
      }));
    } else {
      const sim = await asignarSlot(semesterId, slotNo);
      assignedItems = sim.asignados;
    }
  }

  const petitions = await prisma.petition.findMany({
    where: { semesterId, slotNo },
    include: { teacher: true, course: true },
    orderBy: [{ teacherId: "asc" }, { priority: "asc" }, { id: "asc" }],
  });

  const byTeacher = new Map<
    number,
    { teacherId: number; teacherName: string; petitions: typeof petitions }
  >();
  for (const p of petitions) {
    if (!byTeacher.has(p.teacherId)) {
      byTeacher.set(p.teacherId, {
        teacherId: p.teacherId,
        teacherName: p.teacher.name,
        petitions: [],
      });
    }
    byTeacher.get(p.teacherId)!.petitions.push(p);
  }

  const assignedMap = new Map<number, (typeof assignedItems)[0]>();
  for (const a of assignedItems) {
    assignedMap.set(a.courseId, a);
  }
  const assignedTeacherIds = new Set(assignedItems.map((a) => a.teacherId));

  // Obtener cursos asignados en otros slots para evitar cualquier colisión inter-slot (Error 409)
  const assignedOtherSlots = await prisma.assignment.findMany({
    where: { semesterId, slotNo: { not: slotNo } },
    select: { courseId: true, slotNo: true, teacher: { select: { name: true } } },
  });
  const assignedOtherSlotIds = new Set(assignedOtherSlots.map((a) => a.courseId));
  const assignedOtherSlotMap = new Map(
    assignedOtherSlots.map((a) => [a.courseId, { slotNo: a.slotNo, teacherName: a.teacher.name }])
  );

  const allCourses = await prisma.course.findMany({
    where: { semesterId },
    orderBy: [{ code: "asc" }, { horario: "asc" }],
  });

  // Vacantes reales: No asignados en este slot NI en ningún otro slot
  const vacantCourses: VacantCourseInfo[] = allCourses
    .filter((c) => !assignedMap.has(c.id) && !assignedOtherSlotIds.has(c.id))
    .map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      horario: c.horario,
      dias: c.dias,
      ubicacion: c.ubicacion,
      cupo: c.cupo,
    }));

  const allExps = await prisma.teacherCourseExp.findMany({ where: { periods: { gt: 0 } } });
  const expByTeacher = new Map<number, Set<string>>();
  for (const exp of allExps) {
    if (!expByTeacher.has(exp.teacherId)) expByTeacher.set(exp.teacherId, new Set());
    expByTeacher.get(exp.teacherId)!.add(exp.courseCode);
  }

  // Filtrar docentes con 3 o más opciones que quedaron sin asignación
  const unassigned3Opts = Array.from(byTeacher.values()).filter(
    (t) => t.petitions.length >= 3 && !assignedTeacherIds.has(t.teacherId)
  );

  const cases: TeacherRescueCase[] = [];

  for (const t of unassigned3Opts) {
    // Opciones registradas originales del docente sin asignación
    const registeredOptions: TeacherRegisteredOption[] = t.petitions.map((p) => {
      const otherSlotInfo = assignedOtherSlotMap.get(p.courseId);
      const holderThisSlot = assignedMap.get(p.courseId);

      let statusType: "occupied_this_slot" | "assigned_other_slot" | "vacant" = "vacant";
      let statusText = "Disponible en este slot";
      let currentHolderName: string | undefined;
      let currentHolderPuntaje: number | undefined;
      let assignedSlotNo: number | undefined;

      if (otherSlotInfo) {
        statusType = "assigned_other_slot";
        assignedSlotNo = otherSlotInfo.slotNo;
        currentHolderName = otherSlotInfo.teacherName;
        statusText = `Asignado en Slot ${otherSlotInfo.slotNo} a ${otherSlotInfo.teacherName}`;
      } else if (holderThisSlot) {
        statusType = "occupied_this_slot";
        assignedSlotNo = slotNo;
        currentHolderName = holderThisSlot.teacherName;
        currentHolderPuntaje = holderThisSlot.puntaje;
        statusText = `Ocupado en Slot ${slotNo} por ${holderThisSlot.teacherName} (${holderThisSlot.puntaje} pts)`;
      }

      return {
        priority: p.priority,
        courseId: p.courseId,
        courseCode: p.course.code,
        courseName: p.course.name,
        horario: p.course.horario,
        dias: p.course.dias,
        ubicacion: p.course.ubicacion,
        cupo: p.course.cupo,
        statusType,
        statusText,
        currentHolderName,
        currentHolderPuntaje,
        assignedSlotNo,
      };
    });

    // Opción 1: Bloqueo Asistido (solo materias disponibles en este slot, no ocupadas en otros)
    const availablePetitions = t.petitions.filter((p) => !assignedOtherSlotIds.has(p.courseId));
    const opcion1_bloqueo: RescueOption1[] = availablePetitions.map((p) => {
      const holder = assignedMap.get(p.courseId);
      const holderOpts = holder
        ? byTeacher.get(holder.teacherId)?.petitions.length || 1
        : 0;
      return {
        courseId: p.courseId,
        courseCode: p.course.code,
        courseName: p.course.name,
        horario: p.course.horario,
        priority: p.priority,
        currentHolder: holder
          ? {
              teacherId: holder.teacherId,
              teacherName: holder.teacherName,
              puntaje: holder.puntaje,
              optionsCount: holderOpts,
            }
          : null,
      };
    });

    // Opción 2: Ceder el Paso Pro-Cobertura
    const opcion2_cederPaso: RescueOption2[] = [];
    for (const p of availablePetitions) {
      const holder = assignedMap.get(p.courseId);
      if (!holder) continue;
      const holderData = byTeacher.get(holder.teacherId);
      if (!holderData || holderData.petitions.length <= 1) continue;

      // Buscar si el ocupante tiene materias alternas viables en este slot (NO ocupadas en otros slots)
      const altPetitions = holderData.petitions.filter(
        (altP) => altP.courseId !== p.courseId && !assignedOtherSlotIds.has(altP.courseId)
      );
      for (const altP of altPetitions) {
        const isVacant = !assignedMap.has(altP.courseId);
        opcion2_cederPaso.push({
          targetCourseId: p.courseId,
          targetCourseCode: p.course.code,
          targetCourseName: p.course.name,
          displacedTeacherId: holder.teacherId,
          displacedTeacherName: holder.teacherName,
          alternativeCourseId: altP.courseId,
          alternativeCourseCode: altP.course.code,
          alternativeCourseName: altP.course.name,
          description: `El profesor ${holder.teacherName} cederá ${p.course.code} (${p.course.name}) y se reubicará en su opción ${altP.priority}: ${altP.course.code} (${altP.course.name})${isVacant ? " [Vacante disponible en este slot]" : ""}, garantizando que ambos docentes tengan materia.`,
          locked: [
            { courseId: p.courseId, teacherId: t.teacherId },
            { courseId: altP.courseId, teacherId: holder.teacherId },
          ],
        });
      }
    }

    // Opción 3: Regla de Protección Universal
    const opcion3_proteccionUniversal: RescueOption3[] = [];
    for (const p of t.petitions) {
      const holder = assignedMap.get(p.courseId);
      if (!holder) continue;
      const holderData = byTeacher.get(holder.teacherId);
      const holderOpts = holderData?.petitions.length || 1;

      // Se considera candidato a desplazamiento si registró menos opciones (falta de flexibilidad, ej. 1 sola opción)
      if (holderOpts < 3) {
        opcion3_proteccionUniversal.push({
          targetCourseId: p.courseId,
          targetCourseCode: p.course.code,
          targetCourseName: p.course.name,
          displacedTeacherId: holder.teacherId,
          displacedTeacherName: holder.teacherName,
          displacedTeacherOptionsCount: holderOpts,
          description: `El profesor ${holder.teacherName} se quedará sin materia debido a su falta de flexibilidad (registró solo ${holderOpts} ${holderOpts === 1 ? "opción" : "opciones"} frente a las 3 opciones de ${t.teacherName}), otorgando ${p.course.code} a ${t.teacherName}.`,
          locked: [{ courseId: p.courseId, teacherId: t.teacherId }],
        });
      }
    }

    opcion3_proteccionUniversal.sort((a, b) => a.displacedTeacherOptionsCount - b.displacedTeacherOptionsCount);

    // Opción 4: Potenciales Opciones de Reasignación con Visto Bueno
    const opcion4_potenciales: RescueOption4[] = [];

    for (const p of t.petitions) {
      const holder = assignedMap.get(p.courseId);

      // 1. Misma materia en otra sección/horario vacante
      const sameCodeVacants = vacantCourses.filter(
        (v) => v.code === p.course.code && v.id !== p.courseId
      );

      for (const v of sameCodeVacants) {
        if (holder) {
          // Reubicar al ocupante a la sección alterna
          opcion4_potenciales.push({
            id: `opt4-sec-holder-${p.courseId}-${v.id}`,
            category: "seccion_alterna_ocupante",
            categoryLabel: "Reubicación de Ocupante a Sección Alterna",
            reassignedTeacherId: holder.teacherId,
            reassignedTeacherName: holder.teacherName,
            vistoBuenoTeacherName: holder.teacherName,
            targetCourseId: p.courseId,
            targetCourseCode: p.course.code,
            targetCourseName: p.course.name,
            targetCourseHorario: p.course.horario,
            destinationCourseId: v.id,
            destinationCourseCode: v.code,
            destinationCourseName: v.name,
            destinationCourseHorario: v.horario,
            description: `El profesor ${holder.teacherName} conserva la impartición de ${v.code} (${v.name}) trasladándose al horario alterno ${v.horario ?? ""}, liberando el horario ${p.course.horario ?? ""} para ${t.teacherName}.`,
            alertVistoBueno: `⚠️ El profesor reasignado ${holder.teacherName} debe dar su VISTO BUENO previo para el cambio de horario a ${v.horario ?? ""}.`,
            locked: [
              { courseId: p.courseId, teacherId: t.teacherId },
              { courseId: v.id, teacherId: holder.teacherId },
            ],
          });
        }

        // Asignar sección alterna directamente al docente no asignado
        opcion4_potenciales.push({
          id: `opt4-sec-doc-${v.id}`,
          category: "seccion_alterna_docente",
          categoryLabel: "Oferta de Sección Alterna a Docente",
          reassignedTeacherId: t.teacherId,
          reassignedTeacherName: t.teacherName,
          vistoBuenoTeacherName: t.teacherName,
          targetCourseId: v.id,
          targetCourseCode: v.code,
          targetCourseName: v.name,
          targetCourseHorario: v.horario,
          destinationCourseId: v.id,
          destinationCourseCode: v.code,
          destinationCourseName: v.name,
          destinationCourseHorario: v.horario,
          description: `Se ofrece a ${t.teacherName} la sección vacante de la materia solicitada ${v.code} (${v.name}) en horario alterno ${v.horario ?? ""}.`,
          alertVistoBueno: `⚠️ La profesora ${t.teacherName} debe dar su VISTO BUENO previo para aceptar el horario alterno ${v.horario ?? ""}.`,
          locked: [{ courseId: v.id, teacherId: t.teacherId }],
        });
      }

      // 2. Reubicación del ocupante a una materia vacante de su experiencia
      if (holder) {
        const holderExps = expByTeacher.get(holder.teacherId) || new Set();
        const holderExpMatches = vacantCourses.filter(
          (v) => holderExps.has(v.code) && v.code !== p.course.code
        );
        for (const v of holderExpMatches) {
          opcion4_potenciales.push({
            id: `opt4-exp-holder-${holder.teacherId}-${v.id}`,
            category: "vacante_experiencia_ocupante",
            categoryLabel: "Reubicación de Ocupante a Materia Afín por Experiencia",
            reassignedTeacherId: holder.teacherId,
            reassignedTeacherName: holder.teacherName,
            vistoBuenoTeacherName: holder.teacherName,
            targetCourseId: p.courseId,
            targetCourseCode: p.course.code,
            targetCourseName: p.course.name,
            targetCourseHorario: p.course.horario,
            destinationCourseId: v.id,
            destinationCourseCode: v.code,
            destinationCourseName: v.name,
            destinationCourseHorario: v.horario,
            description: `El profesor ${holder.teacherName} cuenta con experiencia comprobada en ${v.code} (${v.name}) y se le reasigna este curso vacante (${v.horario ?? ""}), liberando ${p.course.code} para ${t.teacherName}.`,
            alertVistoBueno: `⚠️ El profesor reasignado ${holder.teacherName} debe dar su VISTO BUENO previo para impartir ${v.code} (${v.name}) en horario ${v.horario ?? ""}.`,
            locked: [
              { courseId: p.courseId, teacherId: t.teacherId },
              { courseId: v.id, teacherId: holder.teacherId },
            ],
          });
        }
      }
    }

    // 3. Materia vacante donde el docente no asignado tiene experiencia
    const teacherExps = expByTeacher.get(t.teacherId) || new Set();
    const petitionCodes = new Set(t.petitions.map((p) => p.course.code));
    const teacherExpMatches = vacantCourses.filter(
      (v) => teacherExps.has(v.code) && !petitionCodes.has(v.code)
    );
    for (const v of teacherExpMatches) {
      opcion4_potenciales.push({
        id: `opt4-exp-doc-${t.teacherId}-${v.id}`,
        category: "vacante_experiencia_docente",
        categoryLabel: "Asignación de Vacante Afín al Docente por Experiencia",
        reassignedTeacherId: t.teacherId,
        reassignedTeacherName: t.teacherName,
        vistoBuenoTeacherName: t.teacherName,
        targetCourseId: v.id,
        targetCourseCode: v.code,
        targetCourseName: v.name,
        targetCourseHorario: v.horario,
        destinationCourseId: v.id,
        destinationCourseCode: v.code,
        destinationCourseName: v.name,
        destinationCourseHorario: v.horario,
        description: `Se ofrece a ${t.teacherName} el curso vacante ${v.code} (${v.name}) en horario ${v.horario ?? ""}, donde cuenta con experiencia comprobada en periodos anteriores.`,
        alertVistoBueno: `⚠️ La profesora ${t.teacherName} debe dar su VISTO BUENO previo para aceptar ${v.code} (${v.name}) en horario ${v.horario ?? ""}.`,
        locked: [{ courseId: v.id, teacherId: t.teacherId }],
      });
    }

    cases.push({
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      optionsCount: t.petitions.length,
      registeredOptions,
      opcion1_bloqueo,
      opcion2_cederPaso,
      opcion3_proteccionUniversal,
      opcion4_potenciales,
    });
  }

  return {
    semesterId,
    slotNo,
    unassigned3OptsCount: cases.length,
    cases,
    vacantCourses,
  };
}
