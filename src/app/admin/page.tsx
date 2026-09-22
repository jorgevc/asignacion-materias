"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { escapeCsvCell } from "@/lib/csv";
import type { RescueAnalysisResult } from "@/lib/asignador";
import FillExcelModal from "@/components/FillExcelModal";

type Course = { id: number; code: string; name: string; cupo: number | null; dias: string | null; horario: string | null; ubicacion: string | null };
type Teacher = { id: number; email: string; name: string; employeeId?: string | null; phone?: string | null };
type TeacherCourseExp = { courseCode: string; periods: number; years?: number };
type TeacherWithExps = Teacher & { expPeriods?: number; expYears?: number; exps?: TeacherCourseExp[] };
type Slot = {
  slot_no: number;
  teacher: Teacher;
  options: { courseId: number; course: Course; priority: number }[];
  createdAt: string;
};

type AdminData = {
  semesterId: number;
  totalTeachers: number;
  totalSlots: number;
  totalOptions: number;
  statsByCourse: { courseId: number; course: Course; count: number }[];
  slots: Slot[];
};

type Semester = { id: number; label: string; isActive: boolean };

type ResolvedRescueRecord = {
  teacherId: number;
  teacherName: string;
  optionLabel: string;
  description: string;
  assignedCourseSummary: string;
  locked: Array<{ courseId: number; teacherId: number }>;
  timestamp: string;
};

type RecalculatedTeacherDetail = {
  teacherId: number;
  teacherName: string;
  courseCode: string;
  courseName: string;
  priority: number;
  puntaje: number;
  detalle?: {
    base: number;
    desplazamiento: number;
    flexibilidad: number;
    experiencia: number;
    periodos?: number;
    total: number;
  };
};

type LastRecalculatedEvent = {
  slotNo: number;
  actionTitle: string;
  timestamp: string;
  affectedTeachers: RecalculatedTeacherDetail[];
  stats?: {
    totalAsignados: number;
    cursosRestantes: number;
    p1Count: number;
    p2Count: number;
    p3Count: number;
    avgPuntaje: number;
  };
};

const FIELD_OPTIONS = [
  { value: "", label: "-- ignorar --" },
  { value: "code", label: "code" },
  { value: "name", label: "name" },
  { value: "cupo", label: "cupo" },
  { value: "dias", label: "dias" },
  { value: "horario", label: "horario" },
  { value: "ubicacion", label: "ubicacion" },
];

export default function AdminPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState<string>("");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterCourse, setFilterCourse] = useState<string>("");
  const [filterTeacher, setFilterTeacher] = useState<string>("");

  // Import states
  const [importSemesterId, setImportSemesterId] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUrl, setImportUrl] = useState<string>("");
  const [preview, setPreview] = useState<{ headers: string[]; previewRows: string[][]; totalRows: number; suggestedMapping: Record<string, string> } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  // Assignment states - por slot botón
  const [assignments, setAssignments] = useState<{ total: number; assignments: Array<{ id: number; teacherId: number; courseId: number; slotNo: number; priority: number; puntaje: number; detalle: any; teacher: Teacher & { expPeriods?: number; expYears?: number }; course: Course }> } | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState<number | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [assignmentSort, setAssignmentSort] = useState<"default" | "curso">("default");
  const [assignmentSlotFilter, setAssignmentSlotFilter] = useState<"all" | 1 | 2 | 3>("all");
  const [lastRecalculatedEvent, setLastRecalculatedEvent] = useState<LastRecalculatedEvent | null>(null);

  const [teachersExp, setTeachersExp] = useState<Array<Teacher & { expPeriods?: number; expYears?: number; exps?: Array<{ courseCode: string; periods: number; years?: number }> }>>([]);
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);
  const [historicalFiles, setHistoricalFiles] = useState<Array<{ name: string; sizeFormatted: string; updatedAt: string; extension: string }>>([]);
  const [showFilesDrawer, setShowFilesDrawer] = useState(false);
  const [fileUploadLoading, setFileUploadLoading] = useState(false);
  const [fileMessage, setFileMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [expEdit, setExpEdit] = useState<Record<string, string>>({});
  const [expCourseEdit, setExpCourseEdit] = useState<Record<string, string>>({});
  const [empates, setEmpates] = useState<Array<{ courseId: number; courseCode: string; courseName: string; priority: number; puntaje: number; tied: Array<{ teacherId: number; teacherName: string; puntaje: number; petitionId: number }> }>>([]);
  const [reassignPick, setReassignPick] = useState<Record<number, number>>({});
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const [activeRescueSlot, setActiveRescueSlot] = useState<number>(1);
  const [simulateResult, setSimulateResult] = useState<any>(null);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [rescueAnalysis, setRescueAnalysis] = useState<RescueAnalysisResult | null>(null);
  const [rescueLoading, setRescueLoading] = useState(false);
  const [rescueTab, setRescueTab] = useState<Record<number, "opcion1" | "opcion2" | "opcion3" | "opcion4">>({});
  const [vistoBuenoConfirm, setVistoBuenoConfirm] = useState<Record<string, boolean>>({});
  const [vacantSearch, setVacantSearch] = useState<string>("");
  const [resolvedRescueCases, setResolvedRescueCases] = useState<ResolvedRescueRecord[]>([]);
  const [showFillExcelModal, setShowFillExcelModal] = useState(false);


  useEffect(() => {
    fetch("/api/semesters")
      .then((r) => r.json())
      .then((s) => {
        if (Array.isArray(s)) {
          setSemesters(s);
          const active = s.find((x: Semester) => x.isActive);
          if (active) {
            setSemesterId(String(active.id));
            setImportSemesterId(String(active.id));
          } else if (s.length > 0) {
            setSemesterId(String(s[0].id));
            setImportSemesterId(String(s[0].id));
          }
        }
      });
    fetchHistoricalFiles();
  }, []);

  const fetchAdmin = async () => {
    if (!semesterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/petitions?semesterId=${semesterId}`);
      const j = await res.json();
      if (res.ok) setData(j);
      else setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async (sid: string) => {
    if (!sid) return;
    const res = await fetch(`/api/courses?semesterId=${sid}`);
    const j = await res.json();
    if (Array.isArray(j)) setCourses(j);
  };

  useEffect(() => {
    if (semesterId) {
      fetchAdmin();
      fetchCourses(semesterId);
    }
  }, [semesterId]);

  useEffect(() => {
    if (importSemesterId) fetchCourses(importSemesterId);
  }, [importSemesterId]);

  const fetchAssignments = async () => {
    if (!semesterId) return;
    const res = await fetch(`/api/admin/assignments?semesterId=${semesterId}`);
    const j = await res.json();
    if (res.ok) setAssignments(j);
    else setAssignments(null);
  };

  useEffect(() => {
    if (semesterId) {
      fetchAssignments();
      fetchRescueAnalysis(semesterId, 1);
      loadResolvedRescueCases(semesterId, 1);
    }
  }, [semesterId]);

  const handleAsignarSlot = async (slotNo: number) => {
    if (!semesterId) return;
    setAssignmentLoading(slotNo);
    setAssignmentMessage(null);
    try {
      const res = await fetch(`/api/admin/assignments/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: Number(semesterId), slotNo }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAssignmentMessage({ type: "error", text: j.error || "Error" });
        setEmpates([]);
        setLastSlot(slotNo);
        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);
        setSimulateResult(null);
      } else {
        setAssignmentMessage({ type: "ok", text: `Slot ${slotNo}: asignados ${j.asignados?.length ?? 0}, restantes ${j.cursosRestantes}${j.empates?.length ? `, empates ${j.empates.length}` : ""}` });
        setEmpates(j.empates || []);
        setLastSlot(slotNo);
        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);
        setSimulateResult(null);
        fetchAssignments();
        fetchRescueAnalysis(semesterId, slotNo);
        loadResolvedRescueCases(semesterId, slotNo);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setAssignmentLoading(null);
    }
  };

  const getRescueStorageKey = (sid: string | number, slot: number) => `rescue_resolved_${sid}_${slot}`;

  const loadResolvedRescueCases = (sid = semesterId, slot = activeRescueSlot || lastSlot || 1) => {
    if (!sid) return;
    try {
      const stored = localStorage.getItem(getRescueStorageKey(sid, slot));
      if (stored) {
        setResolvedRescueCases(JSON.parse(stored));
      } else {
        setResolvedRescueCases([]);
      }
    } catch {
      setResolvedRescueCases([]);
    }
  };

  const fetchRescueAnalysis = async (sid = semesterId, slot = activeRescueSlot || lastSlot || 1) => {
    if (!sid) return;
    try {
      const res = await fetch(`/api/admin/assignments/rescue-analysis?semesterId=${sid}&slotNo=${slot}`);
      const j = await res.json();
      if (res.ok && j.ok) {
        setRescueAnalysis(j.data);
      } else {
        setRescueAnalysis(null);
      }
    } catch (e) {
      console.error(e);
      setRescueAnalysis(null);
    }
  };

  const switchRescueSlot = (slot: number) => {
    setActiveRescueSlot(slot);
    setAssignmentSlotFilter(slot as 1 | 2 | 3);
    fetchRescueAnalysis(semesterId, slot);
    loadResolvedRescueCases(semesterId, slot);
  };

  const handleExecuteRescue = async (
    slotNo: number,
    teacherId: number,
    teacherName: string,
    optionLabel: string,
    newLocked: Array<{ courseId: number; teacherId: number }>,
    description: string
  ) => {
    if (!semesterId) return;
    setRescueLoading(true);
    try {
      const previousLocks = resolvedRescueCases
        .filter((r) => r.teacherId !== teacherId)
        .flatMap((r) => r.locked);
      const combinedLocked = [...previousLocks, ...newLocked];

      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId: Number(semesterId),
          slotNo,
          locked: combinedLocked,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAssignmentMessage({ type: "error", text: `❌ No se pudo aplicar: ${j.error || "Restricción de cupo o colisión detectada"}` });
      } else {
        const assigned = (j.asignados || []).find((a: any) => a.teacherId === teacherId);
        const assignedSummary = assigned
          ? `${assigned.courseCode} - ${assigned.courseName}`
          : "Asignado";

        const newRecord: ResolvedRescueRecord = {
          teacherId,
          teacherName,
          optionLabel,
          description,
          assignedCourseSummary: assignedSummary,
          locked: newLocked,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        const updated = [...resolvedRescueCases.filter((r) => r.teacherId !== teacherId), newRecord];
        setResolvedRescueCases(updated);
        try {
          localStorage.setItem(getRescueStorageKey(semesterId, slotNo), JSON.stringify(updated));
        } catch {}

        const lockedTeacherIds = new Set(newLocked.map((l) => l.teacherId));
        const affected: RecalculatedTeacherDetail[] = (j.asignados || [])
          .filter((a: any) => lockedTeacherIds.has(a.teacherId))
          .map((a: any) => ({
            teacherId: a.teacherId,
            teacherName: a.teacherName,
            courseCode: a.courseCode,
            courseName: a.courseName,
            priority: a.priority,
            puntaje: a.puntaje,
            detalle: a.detalle,
          }));

        setLastRecalculatedEvent({
          slotNo,
          actionTitle: `${optionLabel}: ${teacherName}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          affectedTeachers: affected,
          stats: j.stats,
        });

        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);

        setAssignmentMessage({
          type: "ok",
          text: `✅ ${teacherName} resuelto con éxito (${optionLabel}). Slot ${slotNo} recalculado exitosamente.`,
        });

        await fetchAssignments();
        await fetchRescueAnalysis(semesterId, slotNo);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setRescueLoading(false);
    }
  };

  const handleUndoRescue = async (slotNo: number, teacherId: number) => {
    if (!semesterId) return;
    setRescueLoading(true);
    try {
      const remaining = resolvedRescueCases.filter((r) => r.teacherId !== teacherId);
      const remainingLocked = remaining.flatMap((r) => r.locked);

      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId: Number(semesterId),
          slotNo,
          locked: remainingLocked,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAssignmentMessage({ type: "error", text: `❌ Error al revertir: ${j.error || "Fallo en la reversión"}` });
      } else {
        setResolvedRescueCases(remaining);
        try {
          localStorage.setItem(getRescueStorageKey(semesterId, slotNo), JSON.stringify(remaining));
        } catch {}

        setLastRecalculatedEvent({
          slotNo,
          actionTitle: `Deshacer Resolución`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          affectedTeachers: [],
          stats: j.stats,
        });

        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);

        setAssignmentMessage({
          type: "ok",
          text: `↩️ Resolución revertida. El docente ha vuelto a la lista de casos pendientes.`,
        });

        await fetchAssignments();
        await fetchRescueAnalysis(semesterId, slotNo);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setRescueLoading(false);
    }
  };

  const handleResetAllRescues = async (slotNo: number) => {
    if (!semesterId) return;
    if (!window.confirm(`¿Está seguro de revertir todas las resoluciones aplicadas en el Slot ${slotNo}? El slot volverá a su asignación inicial.`)) return;
    setRescueLoading(true);
    try {
      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId: Number(semesterId),
          slotNo,
          locked: [],
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAssignmentMessage({ type: "error", text: `❌ Error al reiniciar: ${j.error || "Fallo al reiniciar"}` });
      } else {
        setResolvedRescueCases([]);
        try {
          localStorage.removeItem(getRescueStorageKey(semesterId, slotNo));
        } catch {}

        setLastRecalculatedEvent({
          slotNo,
          actionTitle: `Reinicio de Resoluciones (Slot ${slotNo})`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          affectedTeachers: [],
          stats: j.stats,
        });

        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);

        setAssignmentMessage({
          type: "ok",
          text: `↺ Se han revertido todas las resoluciones del Slot ${slotNo}. Tablero reiniciado.`,
        });
        await fetchAssignments();
        await fetchRescueAnalysis(semesterId, slotNo);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setRescueLoading(false);
    }
  };

  const handleBorrarSlot = async (slotNo?: number) => {
    if (!semesterId) return;
    const url = slotNo ? `/api/admin/assignments?semesterId=${semesterId}&slotNo=${slotNo}` : `/api/admin/assignments?semesterId=${semesterId}`;
    const res = await fetch(url, { method: "DELETE" });
    const j = await res.json();
    if (res.ok) {
      setAssignmentMessage({ type: "ok", text: `Borradas ${j.deleted} asignaciones ${slotNo ? `slot ${slotNo}` : "todas"}` });
      setRescueAnalysis(null);
      setResolvedRescueCases([]);
      if (slotNo) {
        localStorage.removeItem(getRescueStorageKey(semesterId, slotNo));
      } else {
        [1, 2, 3].forEach((s) => localStorage.removeItem(getRescueStorageKey(semesterId, s)));
      }
      fetchAssignments();
    } else setAssignmentMessage({ type: "error", text: j.error });
  };

  const handleReassign = async (courseId: number, slotNo: number) => {
    const teacherId = reassignPick[courseId];
    if (!teacherId) {
      setAssignmentMessage({ type: "error", text: "Seleccione docente para reasignar" });
      return;
    }
    setAssignmentLoading(slotNo);
    try {
      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: Number(semesterId), slotNo, courseId, teacherId }),
      });
      const j = await res.json();
      if (!res.ok) setAssignmentMessage({ type: "error", text: j.error });
      else {
        setAssignmentMessage({ type: "ok", text: `Reasignado curso ${courseId} a docente ${teacherId} en slot ${slotNo} - recalculado` });
        setEmpates(j.empates || []);
        setSimulateResult(null);
        fetchAssignments();
        fetchRescueAnalysis(semesterId, slotNo);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setAssignmentLoading(null);
    }
  };

  const handleSimulate = async () => {
    if (!semesterId || !lastSlot) {
      setAssignmentMessage({ type: "error", text: "Ejecute primero Asignar Slot para obtener empates" });
      return;
    }
    const locked = Object.entries(reassignPick)
      .filter(([, teacherId]) => teacherId)
      .map(([courseId, teacherId]) => ({ courseId: Number(courseId), teacherId: Number(teacherId) }));
    if (locked.length === 0) {
      setAssignmentMessage({ type: "error", text: "Seleccione al menos un ganador para simular" });
      return;
    }
    setSimulateLoading(true);
    setAssignmentMessage(null);
    try {
      const res = await fetch(`/api/admin/assignments/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: Number(semesterId), slotNo: lastSlot, locked }),
      });
      const j = await res.json();
      if (!res.ok) setAssignmentMessage({ type: "error", text: j.error });
      else {
        setSimulateResult(j);
        setAssignmentMessage({ type: "ok", text: `Simulación slot ${lastSlot}: P1 ${j.totales.p1} P2 ${j.totales.p2} P3 ${j.totales.p3} (Δ P1 ${j.diff.p1} P2 ${j.diff.p2} P3 ${j.diff.p3})` });
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setSimulateLoading(false);
    }
  };

  const handleReassignLocked = async () => {
    if (!semesterId || !lastSlot || !simulateResult) return;
    const locked = Object.entries(reassignPick)
      .filter(([, teacherId]) => teacherId)
      .map(([courseId, teacherId]) => ({ courseId: Number(courseId), teacherId: Number(teacherId) }));
    if (locked.length === 0) {
      setAssignmentMessage({ type: "error", text: "Seleccione al menos un ganador para reasignar" });
      return;
    }
    setAssignmentLoading(lastSlot);
    try {
      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: Number(semesterId), slotNo: lastSlot, locked }),
      });
      const j = await res.json();
      if (!res.ok) setAssignmentMessage({ type: "error", text: j.error });
      else {
        setAssignmentMessage({ type: "ok", text: `Slot ${lastSlot} recalculado con ${locked.length} bloqueos - asignados ${j.asignados?.length ?? 0}${j.empates?.length ? `, empates restantes ${j.empates.length}` : ""}` });
        setEmpates(j.empates || []);
        setSimulateResult(null);
        fetchAssignments();
        fetchRescueAnalysis(semesterId, lastSlot);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setAssignmentLoading(null);
    }
  };

  const fetchTeachersExp = async () => {
    if (!semesterId) return;
    const res = await fetch(`/api/admin/teachers/exp?semesterId=${semesterId}`);
    const j = await res.json();
    if (Array.isArray(j)) setTeachersExp(j);
  };

  useEffect(() => {
    if (semesterId) fetchTeachersExp();
  }, [semesterId, data]);

  const handleUpdateExp = async (email: string) => {
    const val = expEdit[email];
    if (val === undefined) return;
    const res = await fetch(`/api/admin/teachers/exp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, expPeriods: Number(val) }),
    });
    const j = await res.json();
    if (res.ok) {
      setAssignmentMessage({ type: "ok", text: `Periodos globales ${email} -> ${j.expPeriods ?? j.expYears}` });
      fetchTeachersExp();
      fetchAssignments();
    } else setAssignmentMessage({ type: "error", text: j.error });
  };

  const handleUpdateExpCourse = async (email: string, courseCode: string) => {
    const key = `${email}_${courseCode}`;
    const val = expCourseEdit[key];
    if (val === undefined) return;
    const res = await fetch(`/api/admin/teachers/exp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, courseCode, periods: Number(val) }),
    });
    const j = await res.json();
    if (res.ok) {
      setAssignmentMessage({ type: "ok", text: `Periodos ${email} / ${courseCode} -> ${j.exp.periods ?? j.exp.years}` });
      fetchTeachersExp();
      fetchAssignments();
    } else setAssignmentMessage({ type: "error", text: j.error });
  };

  const handleImportHistory = async () => {
    setImportHistoryLoading(true);
    setAssignmentMessage(null);
    try {
      const res = await fetch(`/api/admin/teachers/exp/import-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setAssignmentMessage({
          type: "ok",
          text: `Sincronización completada: ${j.totalPairsUpdated} registros calculados para ${j.teachersUpdated} docentes en ${j.filesProcessed.length} archivos históricos (periodos ${j.minYear}-${j.referenceYear}).`,
        });
        fetchTeachersExp();
        fetchAssignments();
      } else {
        setAssignmentMessage({ type: "error", text: j.error || "Error al sincronizar historial" });
      }
    } catch (e) {
      console.error(e);
      setAssignmentMessage({ type: "error", text: "Error de conexión al importar historial" });
    } finally {
      setImportHistoryLoading(false);
    }
  };

  const fetchHistoricalFiles = async () => {
    try {
      const res = await fetch(`/api/admin/teachers/exp/files`);
      const j = await res.json();
      if (res.ok && j.files) {
        setHistoricalFiles(j.files);
      }
    } catch (e) {
      console.error("Error al obtener archivos históricos:", e);
    }
  };

  const handleUploadHistoricalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploadLoading(true);
    setFileMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("autoRecalculate", "true");

      const res = await fetch(`/api/admin/teachers/exp/files`, {
        method: "POST",
        body: formData,
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setFileMessage({
          type: "ok",
          text: `${j.message} ${j.importResult ? `Se recalcularon automáticamente ${j.importResult.totalPairsUpdated} registros para ${j.importResult.teachersUpdated} docentes.` : ""}`,
        });
        fetchHistoricalFiles();
        fetchTeachersExp();
        fetchAssignments();
      } else {
        setFileMessage({ type: "error", text: j.error || "Error al subir archivo" });
      }
    } catch (err) {
      console.error(err);
      setFileMessage({ type: "error", text: "Error de conexión al subir el archivo" });
    } finally {
      setFileUploadLoading(false);
      e.target.value = "";
    }
  };

  const handleDeleteHistoricalFile = async (fileName: string) => {
    if (!confirm(`¿Eliminar '${fileName}'? Los periodos de los últimos 4 años se recalcularán automáticamente sin este archivo.`)) {
      return;
    }
    setFileUploadLoading(true);
    setFileMessage(null);
    try {
      const res = await fetch(
        `/api/admin/teachers/exp/files?fileName=${encodeURIComponent(fileName)}&autoRecalculate=true`,
        { method: "DELETE" }
      );
      const j = await res.json();
      if (res.ok && j.ok) {
        setFileMessage({
          type: "ok",
          text: `${j.message} ${j.importResult ? `Se recalcularon los registros restantes (${j.importResult.totalPairsUpdated} pares actualizados).` : ""}`,
        });
        fetchHistoricalFiles();
        fetchTeachersExp();
        fetchAssignments();
      } else {
        setFileMessage({ type: "error", text: j.error || "Error al eliminar archivo" });
      }
    } catch (err) {
      console.error(err);
      setFileMessage({ type: "error", text: "Error al eliminar archivo" });
    } finally {
      setFileUploadLoading(false);
    }
  };

  const filteredSlots = data?.slots.filter((s) => {
    if (
      filterTeacher &&
      !s.teacher.email.toLowerCase().includes(filterTeacher.toLowerCase()) &&
      !s.teacher.name.toLowerCase().includes(filterTeacher.toLowerCase()) &&
      !(s.teacher.employeeId && s.teacher.employeeId.toLowerCase().includes(filterTeacher.toLowerCase()))
    )
      return false;
    if (filterCourse) {
      const has = s.options.some((o) => String(o.courseId) === filterCourse);
      if (!has) return false;
    }
    return true;
  });

  const exportCSV = () => {
    if (!data) return;
    const rows: string[] = ["empleado_no,docente_email,docente_nombre,telefono,slot_no,materia_codigo,materia_nombre,cupo,dias,horario,ubicacion,prioridad"];
    for (const s of data.slots) {
      for (const o of s.options) {
        rows.push(
          [
            s.teacher.employeeId ?? "",
            s.teacher.email,
            s.teacher.name,
            s.teacher.phone ?? "",
            s.slot_no,
            o.course.code,
            o.course.name,
            o.course.cupo ?? "",
            o.course.dias ?? "",
            o.course.horario ?? "",
            o.course.ubicacion ?? "",
            o.priority,
          ]
            .map(escapeCsvCell)
            .join(",")
        );
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peticiones_semestre_${semesterId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    setImportMessage(null);
    setPreview(null);
    if (!importFile && !importUrl.trim()) {
      setImportMessage({ type: "error", text: "Seleccione archivo o pegue URL" });
      return;
    }
    setImportLoading(true);
    try {
      let res: Response;
      if (importFile) {
        const fd = new FormData();
        fd.append("file", importFile);
        if (importUrl.trim()) fd.append("url", importUrl.trim());
        res = await fetch("/api/admin/courses/preview", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/admin/courses/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: importUrl.trim() }),
        });
      }
      const j = await res.json();
      if (!res.ok) {
        setImportMessage({ type: "error", text: j.error || "Error en preview" });
      } else {
        setPreview(j);
        setMapping(j.suggestedMapping || {});
        setImportMessage({ type: "ok", text: `Preview: ${j.totalRows} filas detectadas, ${j.headers.length} columnas` });
      }
    } catch (e) {
      setImportMessage({ type: "error", text: String(e) });
    } finally {
      setImportLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) {
      setImportMessage({ type: "error", text: "Primero haga preview" });
      return;
    }
    if (!importSemesterId) {
      setImportMessage({ type: "error", text: "Seleccione semestre destino" });
      return;
    }
    // Validate mapping has code and name
    const values = Object.values(mapping);
    if (!values.includes("code") || !values.includes("name")) {
      setImportMessage({ type: "error", text: "Mapeo debe incluir code y name (confirmación requerida)" });
      return;
    }
    setImportLoading(true);
    setImportMessage(null);
    try {
      let res: Response;
      if (importFile) {
        const fd = new FormData();
        fd.append("file", importFile);
        fd.append("mapping", JSON.stringify(mapping));
        fd.append("semesterId", importSemesterId);
        fd.append("mode", importMode);
        if (importUrl.trim()) fd.append("url", importUrl.trim());
        res = await fetch("/api/admin/courses/import", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/admin/courses/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: importUrl.trim(), mapping, semesterId: importSemesterId, mode: importMode }),
        });
      }
      const j = await res.json();
      if (!res.ok) {
        setImportMessage({ type: "error", text: j.error || "Error al importar" + (j.errors ? ` (${j.errors.length} filas con error)` : "") });
      } else {
        setImportMessage({
          type: "ok",
          text: `Importado: ${j.imported} materias. Borradas previas: ${j.deleted}. Errores: ${j.skipped}. Total filas Excel: ${j.totalRows}`,
        });
        setPreview(null);
        // refresh
        fetchCourses(importSemesterId);
        if (importSemesterId === semesterId) fetchAdmin();
      }
    } catch (e) {
      setImportMessage({ type: "error", text: String(e) });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administración - Peticiones</h1>
          <p className="text-sm text-zinc-600">Vista de peticiones y gestión de materias por Excel/URL.</p>
        </div>
        <Link href="/admin/teachers" className="px-4 py-2 rounded-lg border border-indigo-200 bg-indigo-50/50 text-indigo-800 text-sm font-medium hover:bg-indigo-100/70 transition shadow-sm flex items-center gap-1.5">
          <span>👥</span> Padrón de Profesores (Carga Masiva / Edición) →
        </Link>
      </div>

      {/* Import Section */}
      <div className="border rounded-lg bg-white p-4">
        <h2 className="font-semibold mb-3">Importar Materias desde Excel / Link</h2>
        <p className="text-xs text-zinc-600 mb-3">
          Campos a mostrar a docentes: <code>code, name, cupo, dias, horario, ubicacion</code>. El Excel debe contener esas columnas (nombres exactos). Confirme el mapeo en cada importación. <code>code</code> no es único: puede repetirse con distinto horario/ubicación.
        </p>
        <div className="grid md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-sm font-medium">Semestre destino *</label>
            <select value={importSemesterId} onChange={(e) => setImportSemesterId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white">
              {semesters.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.label} {s.isActive ? "(Activo)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Archivo Excel (.xlsx, .xls, .csv)</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="w-full border rounded px-2 py-1.5 text-sm bg-white" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">O pegar link (SharePoint/Google Sheets/URL directa)</label>
            <input placeholder="https://..." value={importUrl} onChange={(e) => setImportUrl(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            <p className="text-[11px] text-zinc-500 mt-1">Para SharePoint asegure link público o use ?download=1; si pide auth, descargue y suba archivo.</p>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <button onClick={handlePreview} disabled={importLoading} className="px-4 py-2 rounded bg-zinc-900 text-white text-sm disabled:opacity-50">
            {importLoading ? "Procesando..." : "Previsualizar"}
          </button>
          <select value={importMode} onChange={(e) => setImportMode(e.target.value as "replace" | "append")} className="border rounded px-3 py-2 text-sm bg-white">
            <option value="replace">Reemplazar materias del semestre (borra previas)</option>
            <option value="append">Añadir (mantener previas, permite duplicados)</option>
          </select>
        </div>

        {importMessage && (
          <div className={`px-3 py-2 rounded text-sm mb-3 ${importMessage.type === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {importMessage.text}
          </div>
        )}

        {preview && (
          <div className="border rounded p-3 bg-zinc-50 space-y-3">
            <h3 className="font-semibold text-sm">Confirmar mapeo de columnas (obligatorio cada importación)</h3>
            <p className="text-xs text-zinc-600">Headers detectados: {preview.headers.join(" | ")}</p>
            <div className="grid md:grid-cols-3 gap-2">
              {preview.headers.map((h, idx) => (
                <div key={idx} className="flex flex-col gap-1 border rounded p-2 bg-white">
                  <span className="text-xs font-medium">Col {idx + 1}: {h || "(vacía)"}</span>
                  <select value={mapping[String(idx)] || ""} onChange={(e) => setMapping((prev) => ({ ...prev, [String(idx)]: e.target.value }))} className="border rounded px-2 py-1 text-sm bg-white">
                    {FIELD_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="overflow-auto border rounded bg-white">
              <table className="w-full text-xs">
                <thead className="bg-zinc-100">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left border-b">
                        {h} <span className="text-[10px] text-zinc-500">→ {mapping[String(i)] || "ignorar"}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-t">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2 py-1 border-r">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500">Mostrando 5/{preview.totalRows} filas</p>
            <button onClick={handleImport} disabled={importLoading} className="px-4 py-2 rounded bg-green-700 text-white text-sm hover:bg-green-800 disabled:opacity-50">
              {importLoading ? "Importando..." : `Confirmar e Importar ${preview.totalRows} filas`}
            </button>
          </div>
        )}

        <div className="mt-4 border-t pt-3">
          <h3 className="font-semibold text-sm mb-2">Materias actuales en semestre seleccionado ({courses.length})</h3>
          <div className="overflow-auto max-h-64 border rounded bg-white">
            <table className="w-full text-xs">
              <thead className="bg-zinc-100 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">code</th>
                  <th className="px-2 py-1 text-left">name</th>
                  <th className="px-2 py-1 text-left">cupo</th>
                  <th className="px-2 py-1 text-left">dias</th>
                  <th className="px-2 py-1 text-left">horario</th>
                  <th className="px-2 py-1 text-left">ubicacion</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-2 py-1">{c.code}</td>
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1">{c.cupo ?? "-"}</td>
                    <td className="px-2 py-1">{c.dias ?? "-"}</td>
                    <td className="px-2 py-1">{c.horario ?? "-"}</td>
                    <td className="px-2 py-1">{c.ubicacion ?? "-"}</td>
                  </tr>
                ))}
                {courses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                      Sin materias para este semestre
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Asignación por Slot - botón por slot, no ciclo */}
      <div className="border rounded-lg bg-white p-4">
        <h2 className="font-semibold mb-2">Asignación por Slot (intra-slot, 1 curso/profesor/slot)</h2>
        <p className="text-xs text-zinc-600 mb-3">
          Asigna slot por slot con materias restantes. Slot 1 primero, luego slot 2 con restantes, luego slot 3. Flex desplazado +30 si prev flexible perdida. 1 docente = 1 curso por slot.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {[1, 2, 3].map((slot) => (
            <button key={slot} onClick={() => handleAsignarSlot(slot)} disabled={assignmentLoading !== null} className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
              {assignmentLoading === slot ? "Asignando..." : `Asignar Slot ${slot}`}
            </button>
          ))}
          <button onClick={() => handleBorrarSlot()} disabled={assignmentLoading !== null} className="px-4 py-2 rounded border bg-white text-sm">
            Borrar todas
          </button>
          {[1, 2, 3].map((slot) => (
            <button key={`del-${slot}`} onClick={() => handleBorrarSlot(slot)} className="px-3 py-2 rounded border bg-zinc-50 text-xs">
              Borrar Slot {slot}
            </button>
          ))}
          <button onClick={fetchAssignments} className="px-3 py-2 rounded border bg-white text-xs">
            Recargar asignaciones
          </button>
          <button
            onClick={() => fetchRescueAnalysis(semesterId, lastSlot || 1)}
            className="px-3 py-2 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold shadow-2xs transition-colors"
          >
            ⚠️ Casos de Rescate (3 Opc.)
          </button>
          <button
            type="button"
            onClick={() => setShowFillExcelModal(true)}
            className="px-3.5 py-2 rounded border border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>📗</span> Rellenar Excel de Materias
          </button>
        </div>
        {assignmentMessage && (
          <div className={`px-3 py-2 rounded text-sm mb-3 ${assignmentMessage.type === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {assignmentMessage.text}
          </div>
        )}
        {/* Tarjeta de Confirmación de Último Recálculo Aplicado */}
        {lastRecalculatedEvent && (
          <div className="border-2 border-emerald-400 bg-emerald-50/90 rounded-xl p-4 mb-4 shadow-sm animate-in fade-in duration-300 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl">⚡</span>
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                  Última Actualización Aplicada con Éxito (Slot {lastRecalculatedEvent.slotNo})
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                  {lastRecalculatedEvent.actionTitle}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-700 font-mono">🕒 {lastRecalculatedEvent.timestamp}</span>
                <button
                  type="button"
                  onClick={() => setLastRecalculatedEvent(null)}
                  className="text-emerald-700 hover:text-emerald-950 text-xs px-2 py-0.5 rounded hover:bg-emerald-200/60 font-bold cursor-pointer"
                  title="Cerrar notificación"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>

            {lastRecalculatedEvent.affectedTeachers.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>✅</span> Docentes recalculados y garantizados en esta acción:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {lastRecalculatedEvent.affectedTeachers.map((t) => (
                    <div key={t.teacherId} className="bg-white p-3 rounded-lg border border-emerald-300 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-900 mb-1">
                        <span>{t.teacherName}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-900 font-mono font-bold">
                          {t.puntaje} pts (Prioridad {t.priority})
                        </span>
                      </div>
                      <div className="text-xs text-zinc-700 font-mono">
                        Asignado a: <b className="text-indigo-900">{t.courseCode}</b> - {t.courseName}
                      </div>
                      {t.detalle && (
                        <div className="text-[11px] text-zinc-600 font-mono mt-1.5 pt-1.5 border-t border-zinc-100 flex flex-wrap items-center gap-1">
                          <span className="text-zinc-400">Cálculo:</span>
                          <span>Base: <b>{t.detalle.base}</b></span>
                          <span>+ Despl: <b>{t.detalle.desplazamiento}</b></span>
                          <span>+ Flex: <b>{t.detalle.flexibilidad}</b></span>
                          <span>+ Exp: <b>{t.detalle.experiencia}</b></span>
                          <span className="text-emerald-700 font-bold">= {t.puntaje} pts</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-emerald-800">
                Se recalculó el Slot {lastRecalculatedEvent.slotNo} de forma consistente con los bloqueos activos.
              </div>
            )}

            {lastRecalculatedEvent.stats && (
              <div className="pt-2 border-t border-emerald-200 flex flex-wrap items-center gap-3 text-xs text-emerald-900">
                <span><b>Total Asignados:</b> {lastRecalculatedEvent.stats.totalAsignados}</span>
                <span>•</span>
                <span><b>Vacantes Restantes:</b> {lastRecalculatedEvent.stats.cursosRestantes}</span>
                <span>•</span>
                <span>
                  <b>Prioridades:</b> P1: {lastRecalculatedEvent.stats.p1Count} | P2: {lastRecalculatedEvent.stats.p2Count} | P3: {lastRecalculatedEvent.stats.p3Count}
                </span>
                <span>•</span>
                <span><b>Puntaje Promedio:</b> {lastRecalculatedEvent.stats.avgPuntaje} pts</span>
              </div>
            )}
          </div>
        )}

        {assignments && (
          <>
            {/* Controles de Filtrado por Slot y Métricas del Slot */}
            <div className="space-y-2.5 mb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-700 mr-1">Filtrar por Slot:</span>
                  {(["all", 1, 2, 3] as const).map((s) => {
                    const count =
                      s === "all"
                        ? assignments.assignments.length
                        : assignments.assignments.filter((a) => a.slotNo === s).length;
                    const isActive = assignmentSlotFilter === s;
                    return (
                      <button
                        key={String(s)}
                        type="button"
                        onClick={() => setAssignmentSlotFilter(s)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {s === "all" ? "Todos los Slots" : `Slot ${s}`} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-600 font-medium">Ordenar por:</label>
                  <select
                    value={assignmentSort}
                    onChange={(e) => setAssignmentSort(e.target.value as "default" | "curso")}
                    className="border rounded-lg px-2.5 py-1 text-xs bg-white"
                  >
                    <option value="default">Slot / Docente</option>
                    <option value="curso">Curso</option>
                  </select>
                </div>
              </div>

              {/* Métricas del Slot Seleccionado */}
              {(() => {
                const filteredList = assignments.assignments.filter(
                  (a) => assignmentSlotFilter === "all" || a.slotNo === assignmentSlotFilter
                );
                const p1 = filteredList.filter((a) => a.priority === 1).length;
                const p2 = filteredList.filter((a) => a.priority === 2).length;
                const p3 = filteredList.filter((a) => a.priority === 3).length;
                const avg = filteredList.length
                  ? Math.round(filteredList.reduce((s, a) => s + a.puntaje, 0) / filteredList.length)
                  : 0;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <div className="border-r last:border-0 border-slate-200">
                      <div className="text-[11px] text-zinc-500 font-medium">
                        Asignados {assignmentSlotFilter !== "all" ? `Slot ${assignmentSlotFilter}` : "Total"}
                      </div>
                      <div className="text-lg font-extrabold text-zinc-900">{filteredList.length}</div>
                    </div>
                    <div className="border-r last:border-0 border-slate-200">
                      <div className="text-[11px] text-zinc-500 font-medium">Distribución Prioridades</div>
                      <div className="text-xs font-bold text-zinc-800 flex items-center justify-center gap-2 mt-1">
                        <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">P1: {p1}</span>
                        <span className="text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">P2: {p2}</span>
                        <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">P3: {p3}</span>
                      </div>
                    </div>
                    <div className="border-r last:border-0 border-slate-200">
                      <div className="text-[11px] text-zinc-500 font-medium">Puntaje Promedio</div>
                      <div className="text-lg font-extrabold text-indigo-700">
                        {avg} <span className="text-xs text-zinc-500 font-normal">pts</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-zinc-500 font-medium">Fórmula Matemática</div>
                      <div className="text-[10px] text-zinc-600 font-mono mt-1 bg-white px-1.5 py-0.5 rounded border">
                        Base + Despl + Flex + Exp
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="overflow-auto border rounded-xl bg-white max-h-84 shadow-2xs">
              <table className="w-full text-xs">
                <thead className="bg-zinc-100 sticky top-0 border-b">
                  <tr>
                    <th className="px-2 py-1.5 text-center">Slot</th>
                    <th className="px-2 py-1.5 text-left">Docente</th>
                    <th className="px-2 py-1.5 text-left">Curso</th>
                    <th className="px-2 py-1.5 text-center">Prio</th>
                    <th className="px-2 py-1.5 text-left">Puntaje</th>
                    <th className="px-2 py-1.5 text-left">Desglose Cálculo</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.assignments
                    .filter((a) => assignmentSlotFilter === "all" || a.slotNo === assignmentSlotFilter)
                    .slice()
                    .sort((a, b) =>
                      assignmentSort === "curso"
                        ? a.course.code.localeCompare(b.course.code) || String(a.course.horario).localeCompare(String(b.course.horario)) || a.slotNo - b.slotNo
                        : a.slotNo - b.slotNo || a.teacher.name.localeCompare(b.teacher.name)
                    )
                    .map((a) => {
                      const isRecentlyAffected = lastRecalculatedEvent?.affectedTeachers.some(
                        (t) => t.teacherId === a.teacherId
                      );
                      return (
                        <tr
                          key={a.id}
                          className={`border-t transition-colors ${
                            isRecentlyAffected
                              ? "bg-emerald-50/90 font-medium ring-1 ring-emerald-400"
                              : "bg-white hover:bg-zinc-50/60"
                          }`}
                        >
                          <td className="px-2 py-1.5 text-center font-bold text-zinc-700">
                            {a.slotNo}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-900">{a.teacher.name}</span>
                              {isRecentlyAffected && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-950 font-bold animate-pulse">
                                  ⚡ Recién Recalculado
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {a.teacher.email} • exp: {(a.teacher as any).expPeriods ?? (a.teacher as any).expYears ?? 0} periodos
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="font-semibold text-zinc-900">{a.course.code} - {a.course.name}</div>
                            <div className="text-[11px] text-zinc-500">{a.course.dias} {a.course.horario} {a.course.ubicacion}</div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                a.priority === 1
                                  ? "bg-emerald-100 text-emerald-800"
                                  : a.priority === 2
                                  ? "bg-indigo-100 text-indigo-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              P{a.priority}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 font-mono font-bold text-zinc-900">{a.puntaje}</td>
                          <td className="px-2 py-1.5 text-[11px] font-mono text-zinc-600">
                            {a.detalle
                              ? `Base:${a.detalle.base} + Despl:${a.detalle.desplazamiento} + Flex:${a.detalle.flexibilidad} + Exp:${a.detalle.experiencia} = ${a.detalle.total}`
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  {assignments.assignments.filter((a) => assignmentSlotFilter === "all" || a.slotNo === assignmentSlotFilter).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                        Sin asignaciones registradas para el filtro seleccionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="px-3 py-2 text-xs text-zinc-600 bg-zinc-50 border-t flex items-center justify-between">
                <span>
                  Mostrando {assignments.assignments.filter((a) => assignmentSlotFilter === "all" || a.slotNo === assignmentSlotFilter).length} de {assignments.total} asignaciones totales
                </span>
                {assignmentSlotFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setAssignmentSlotFilter("all")}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    Ver todos los slots
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Selector de Slot para Rescate de Conflictos */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <div>
              <div className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Módulo de Resolución de Conflictos (Docentes con 3 Opciones)
              </div>
              <div className="text-xs text-amber-800">
                Seleccione el slot que desea inspeccionar o resolver:
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => {
              const isCurrent = activeRescueSlot === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => switchRescueSlot(s)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isCurrent
                      ? "bg-amber-600 text-white shadow-xs ring-2 ring-amber-400"
                      : "bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                  }`}
                >
                  <span>Slot {s}</span>
                  {activeRescueSlot === s && <span className="text-[10px]">● Activo</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gestión Secuencial de Docentes con 3 Opciones (Modelo 1) */}
        {(() => {
          const currentSlot = activeRescueSlot || rescueAnalysis?.slotNo || lastSlot || 1;
          const pendingCases = (rescueAnalysis?.cases || []).filter(
            (c) => !resolvedRescueCases.some((r) => r.teacherId === c.teacherId)
          );
          const totalCasesCount = resolvedRescueCases.length + pendingCases.length;
          const progressPercent = totalCasesCount > 0 ? Math.round((resolvedRescueCases.length / totalCasesCount) * 100) : 100;

          // Si no hay casos ni resueltos ni pendientes, y hay asignaciones
          if (totalCasesCount === 0 && assignments && assignments.assignments.length > 0) {
            return (
              <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-3.5 mt-3 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">✅</span>
                  <div>
                    <div className="font-bold text-xs text-emerald-950">
                      Cobertura Completa (Slot {currentSlot})
                    </div>
                    <div className="text-xs text-emerald-800">
                      Todos los docentes que registraron sus 3 opciones reglamentarias cuentan con materia asignada en este slot.
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-200/80 text-emerald-900">
                  100% Cobertura
                </span>
              </div>
            );
          }

          if (totalCasesCount === 0) return null;

          return (
            <div className="border border-indigo-200 rounded-xl bg-gradient-to-b from-slate-50 via-white to-indigo-50/20 p-4 mt-4 shadow-sm space-y-4">
              {/* Header con avance y control de reinicio */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h3 className="font-bold text-base text-zinc-900 flex items-center gap-2">
                      <span>Resolución Secuencial: Docentes con 3 Opciones</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        Slot {currentSlot}
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      <b>Modelo Paso a Paso Reactivo:</b> Cada resolución actualiza en vivo el tablero para que los siguientes casos se resuelvan sobre la realidad vigente.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 border">
                    Avance: {resolvedRescueCases.length} de {totalCasesCount} Resueltos
                  </span>
                  {resolvedRescueCases.length > 0 && (
                    <button
                      type="button"
                      disabled={rescueLoading}
                      onClick={() => handleResetAllRescues(currentSlot)}
                      className="px-2.5 py-1 rounded text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                    >
                      ↺ Reiniciar Todo
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-zinc-200 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* SECCIÓN 1: Casos Resueltos (Verde con botón de Deshacer) */}
              {resolvedRescueCases.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <span>✅</span>
                    <span>Casos Resueltos ({resolvedRescueCases.length}):</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {resolvedRescueCases.map((r) => (
                      <div
                        key={r.teacherId}
                        className="border-2 border-emerald-300 rounded-xl p-3.5 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-zinc-900">{r.teacherName}</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {r.optionLabel}
                            </span>
                            <span className="text-[10px] text-zinc-400">🕒 {r.timestamp}</span>
                          </div>
                          <div className="text-xs font-mono text-emerald-950 font-semibold">
                            Materia asegurada: <b>{r.assignedCourseSummary}</b>
                          </div>
                          <div className="text-[11px] text-zinc-600 leading-snug">
                            {r.description}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={rescueLoading}
                          onClick={() => handleUndoRescue(currentSlot, r.teacherId)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold shadow-2xs transition-colors shrink-0 flex items-center gap-1.5 self-end sm:self-auto cursor-pointer"
                        >
                          <span>↩️</span>
                          <span>Deshacer Caso</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECCIÓN 2: Casos Pendientes de Resolución */}
              {pendingCases.length === 0 && resolvedRescueCases.length > 0 ? (
                <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎉</span>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-950">
                        ¡Todos los docentes con 3 opciones cuentan con materia asignada!
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Se aseguraron exitosamente {resolvedRescueCases.length} asignaciones en este slot sin conflictos de recursos.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-200 text-emerald-950 shrink-0">
                    100% Cobertura
                  </span>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {pendingCases.length > 0 && (
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <span>🟡</span>
                      <span>
                        Siguiente Caso a Resolver ({pendingCases.length} pendiente{pendingCases.length > 1 ? "s" : ""}):
                      </span>
                    </div>
                  )}

                  {pendingCases.map((c, idx) => {
                    const currentTab = rescueTab[c.teacherId] || "opcion2";
                    return (
                      <div key={c.teacherId} className="border-2 border-amber-300 rounded-xl bg-white p-4 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 mb-3 border-b">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900">
                                Caso {resolvedRescueCases.length + idx + 1} de {totalCasesCount}
                              </span>
                              <span className="text-xs font-normal px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {c.optionsCount} opciones registradas
                              </span>
                            </div>
                            <div className="text-base font-bold text-zinc-900">
                              Docente sin asignación: {c.teacherName}
                            </div>
                          </div>
                        </div>

                        {/* SECCIÓN: Opciones registradas por el docente y su estado */}
                        {c.registeredOptions && c.registeredOptions.length > 0 && (
                          <div className="mb-4 bg-slate-50/80 border border-slate-200 rounded-xl p-3.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>📋</span>
                                <span>Opciones solicitadas por el docente ({c.registeredOptions.length}):</span>
                              </div>
                              <span className="text-[11px] text-slate-500 italic">
                                Estado de cada solicitud en este Slot {currentSlot}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              {c.registeredOptions.map((opt) => (
                                <div
                                  key={`${opt.priority}-${opt.courseId}`}
                                  className={`border rounded-lg p-2.5 text-xs flex flex-col justify-between transition-all ${
                                    opt.statusType === "occupied_this_slot"
                                      ? "bg-amber-50/70 border-amber-300"
                                      : opt.statusType === "assigned_other_slot"
                                      ? "bg-zinc-100/90 border-zinc-300 text-zinc-600"
                                      : "bg-emerald-50/70 border-emerald-300"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-white">
                                        Prioridad {opt.priority}
                                      </span>
                                      <span className="font-mono font-bold text-zinc-800">
                                        {opt.courseCode}
                                      </span>
                                    </div>
                                    <div className="font-semibold text-zinc-900 line-clamp-1 mb-1" title={opt.courseName}>
                                      {opt.courseName}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 mb-2">
                                      🕒 {opt.horario || "Horario pendiente"} {opt.dias ? `• ${opt.dias}` : ""}
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-zinc-200/70">
                                    {opt.statusType === "occupied_this_slot" && (
                                      <div className="text-[11px] text-amber-900 font-medium">
                                        <span className="font-semibold">⚠️ Ocupada en Slot {currentSlot}:</span>
                                        <div className="truncate" title={opt.currentHolderName}>
                                          {opt.currentHolderName} ({opt.currentHolderPuntaje} pts)
                                        </div>
                                      </div>
                                    )}
                                    {opt.statusType === "assigned_other_slot" && (
                                      <div className="text-[11px] text-zinc-700 font-medium">
                                        <span className="font-semibold">🔒 Asignada en Slot {opt.assignedSlotNo}:</span>
                                        <div className="truncate" title={opt.currentHolderName}>
                                          {opt.currentHolderName || "Asignada en slot previo"}
                                        </div>
                                      </div>
                                    )}
                                    {opt.statusType === "vacant" && (
                                      <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                                        <span>✅</span>
                                        <span>Disponible en este slot</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tabs selector */}
                        <div className="mb-3">
                          <div className="text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1">
                            <span>⚙️</span>
                            <span>Seleccione la Estrategia de Resolución:</span>
                          </div>
                          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border text-xs flex-wrap">
                            <button
                              type="button"
                              onClick={() => setRescueTab((prev) => ({ ...prev, [c.teacherId]: "opcion2" }))}
                              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                                currentTab === "opcion2"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-900"
                              }`}
                            >
                              🌟 Opción 2: Ceder el Paso {c.opcion2_cederPaso.length > 0 && `(${c.opcion2_cederPaso.length})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRescueTab((prev) => ({ ...prev, [c.teacherId]: "opcion3" }))}
                              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                                currentTab === "opcion3"
                                  ? "bg-amber-600 text-white shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-900"
                              }`}
                            >
                              ⚖️ Opción 3: Protección Universal {c.opcion3_proteccionUniversal.length > 0 && `(${c.opcion3_proteccionUniversal.length})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRescueTab((prev) => ({ ...prev, [c.teacherId]: "opcion4" }))}
                              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                                currentTab === "opcion4"
                                  ? "bg-purple-600 text-white shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-900"
                              }`}
                            >
                              🔍 Opción 4: Potenciales Opciones {c.opcion4_potenciales.length > 0 && `(${c.opcion4_potenciales.length})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRescueTab((prev) => ({ ...prev, [c.teacherId]: "opcion1" }))}
                              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                                currentTab === "opcion1"
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-900"
                              }`}
                            >
                              🔒 Opción 1: Bloqueo Asistido ({c.opcion1_bloqueo.length})
                            </button>
                          </div>
                        </div>

                        {/* Tab 1: Bloqueo Asistido */}
                        {currentTab === "opcion1" && (
                          <div className="space-y-3">
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900">
                              <span className="font-semibold">Opción 1 (Desempate / Bloqueo Manual):</span> Seleccione directamente una de las materias solicitadas por el docente para bloqueársela. El algoritmo recalculará el resto de asignaciones respetando este bloqueo.
                            </div>
                            {c.opcion1_bloqueo.length === 0 ? (
                              <div className="p-4 border rounded-xl bg-amber-50/70 border-amber-300 text-xs text-amber-950 space-y-1.5">
                                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                                  <span>ℹ️</span> Materias solicitadas ya asignadas en slots previos
                                </div>
                                <p className="text-zinc-700">
                                  Las materias solicitadas por {c.teacherName} en este slot ya fueron asignadas en slots anteriores (ej. Slot 1) a otros docentes con prioridad.
                                </p>
                                <p className="font-semibold text-purple-900 pt-1">
                                  👉 Utilice la <b>Opción 4 (Materias Vacantes)</b> para asignarle un curso disponible de su área con su Visto Bueno formal.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {c.opcion1_bloqueo.map((op1) => (
                                  <div key={op1.courseId} className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-sm text-zinc-900">{op1.courseCode}</span>
                                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-indigo-100 text-indigo-800 font-medium">
                                          Prioridad {op1.priority}
                                        </span>
                                      </div>
                                      <div className="text-xs text-zinc-700 font-medium mb-1 line-clamp-1">{op1.courseName}</div>
                                      {op1.horario && <div className="text-[11px] text-zinc-500 mb-2">🕒 {op1.horario}</div>}

                                      <div className="border-t pt-2 mt-2 text-[11px] text-zinc-600">
                                        <span className="text-zinc-400 block mb-0.5">Ocupante actual:</span>
                                        {op1.currentHolder ? (
                                          <div className="bg-white p-1.5 rounded border border-zinc-200">
                                            <div className="font-semibold text-zinc-800">{op1.currentHolder.teacherName}</div>
                                            <div className="text-zinc-500">{op1.currentHolder.puntaje} pts • {op1.currentHolder.optionsCount} {op1.currentHolder.optionsCount === 1 ? "opción" : "opciones"} reg.</div>
                                          </div>
                                        ) : (
                                          <span className="text-emerald-600 font-medium">Disponible (Sin asignar)</span>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      disabled={rescueLoading}
                                      onClick={() =>
                                        handleExecuteRescue(
                                          currentSlot,
                                          c.teacherId,
                                          c.teacherName,
                                          "Opción 1: Bloqueo Asistido",
                                          [{ courseId: op1.courseId, teacherId: c.teacherId }],
                                          `Bloqueo manual de ${op1.courseCode} para ${c.teacherName}`
                                        )
                                      }
                                      className="mt-3 w-full py-1.5 px-3 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                                    >
                                      {rescueLoading ? "Aplicando..." : `🔒 Bloquear para ${c.teacherName.split(" ")[0]}`}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 2: Ceder el Paso Pro-Cobertura */}
                        {currentTab === "opcion2" && (
                          <div className="space-y-3">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-950">
                              <span className="font-bold text-emerald-800">🌟 Opción 2: Ceder el Paso Pro-Cobertura (Altruismo Algorítmico)</span>
                              <p className="mt-0.5 text-emerald-900">
                                Reasigna de forma armónica a un docente que cuenta con opciones viables de respaldo a su segunda opción, permitiendo que <b>ambos docentes tengan materia asignada</b> (cobertura total sin dejar a nadie fuera).
                              </p>
                            </div>

                            {c.opcion2_cederPaso.length === 0 ? (
                              <div className="p-4 border rounded-xl bg-slate-50 border-slate-200 text-xs text-zinc-700 space-y-1.5 text-left">
                                <div className="font-bold flex items-center gap-1.5 text-zinc-900">
                                  <span>ℹ️</span> Sin reubicaciones viables de Ceder el Paso en este slot
                                </div>
                                <p>
                                  Los ocupantes de las materias solicitadas no disponen de materias alternas libres en este slot (sus opciones alternas ya fueron tomadas en slots previos o no registraron opciones secundarias disponibles).
                                </p>
                                <p className="text-indigo-950 font-semibold pt-1">
                                  👉 Opciones recomendadas: Use la <b>Opción 1 (Bloqueo Asistido)</b>, la <b>Opción 3 (Protección Universal)</b> si el ocupante registró menos opciones, o la <b>Opción 4 (Materias Vacantes)</b>.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {c.opcion2_cederPaso.map((op2, opIdx) => (
                                  <div key={opIdx} className="border-2 border-emerald-300 rounded-xl p-3.5 bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                      {/* Asignación 1 */}
                                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="font-bold text-emerald-800">✅ Recibe materia:</span>
                                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">3 opciones reg.</span>
                                        </div>
                                        <div className="font-bold text-sm text-zinc-900">{c.teacherName}</div>
                                        <div className="text-xs text-zinc-600 mt-1 font-mono">
                                          Curso: <b>{op2.targetCourseCode}</b> - {op2.targetCourseName}
                                        </div>
                                      </div>

                                      {/* Asignación 2 */}
                                      <div className="bg-white p-2.5 rounded-lg border border-teal-200 shadow-2xs">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="font-bold text-teal-800">🔄 Cede y se reubica:</span>
                                          <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[11px] font-semibold">Conserva materia</span>
                                        </div>
                                        <div className="font-bold text-sm text-zinc-900">{op2.displacedTeacherName}</div>
                                        <div className="text-xs text-zinc-600 mt-1 font-mono">
                                          Alternativa: <b>{op2.alternativeCourseCode}</b> - {op2.alternativeCourseName}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-xs text-emerald-900 bg-white/80 p-2 rounded border border-emerald-100 mb-3">
                                      ℹ️ {op2.description}
                                    </div>

                                    <button
                                      type="button"
                                      disabled={rescueLoading}
                                      onClick={() =>
                                        handleExecuteRescue(
                                          currentSlot,
                                          c.teacherId,
                                          c.teacherName,
                                          "Opción 2: Ceder el Paso",
                                          op2.locked,
                                          `Ceder el paso: ${op2.displacedTeacherName} cede ${op2.targetCourseCode} a ${c.teacherName} y se reubica en ${op2.alternativeCourseCode}`
                                        )
                                      }
                                      className="w-full py-2 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                      <span>{rescueLoading ? "⏳" : "✨"}</span>
                                      <span>{rescueLoading ? "Aplicando reubicación..." : "Aplicar 'Ceder el Paso' (Garantizar Materia a Ambos)"}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 3: Regla de Protección Universal */}
                        {currentTab === "opcion3" && (
                          <div className="space-y-3">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-950">
                              <span className="font-bold text-amber-800">⚖️ Opción 3: Regla de Protección Universal (Penalización por Inflexibilidad)</span>
                              <p className="mt-0.5 text-amber-900">
                                Desplaza a un docente que registró <b>menos opciones reglamentarias</b> (ej. solo 1 opción), cediendo el curso al docente que cumplió con capturar sus 3 opciones. <b>El docente desplazado se quedará sin materia</b> como consecuencia de su falta de opciones.
                              </p>
                            </div>

                            {c.opcion3_proteccionUniversal.length === 0 ? (
                              <div className="p-4 border rounded-lg bg-zinc-50 text-xs text-zinc-500 text-center">
                                No se encontraron ocupantes con menos de 3 opciones en los cursos solicitados.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {c.opcion3_proteccionUniversal.map((op3, opIdx) => (
                                  <div key={opIdx} className="border-2 border-rose-300 rounded-xl p-3.5 bg-gradient-to-r from-rose-50/50 to-amber-50/30">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                      {/* Asignación que gana */}
                                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="font-bold text-emerald-800">✅ Recibe materia:</span>
                                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">3 opciones</span>
                                        </div>
                                        <div className="font-bold text-sm text-zinc-900">{c.teacherName}</div>
                                        <div className="text-xs text-zinc-600 mt-1 font-mono">
                                          Curso asignado: <b>{op3.targetCourseCode}</b> - {op3.targetCourseName}
                                        </div>
                                      </div>

                                      {/* Docente desplazado */}
                                      <div className="bg-white p-2.5 rounded-lg border border-rose-300 shadow-2xs">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="font-bold text-rose-700">❌ SE QUEDARÁ SIN MATERIA:</span>
                                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold">
                                            Solo {op3.displacedTeacherOptionsCount} {op3.displacedTeacherOptionsCount === 1 ? "opción" : "opciones"}
                                          </span>
                                        </div>
                                        <div className="font-bold text-sm text-zinc-900">{op3.displacedTeacherName}</div>
                                        <div className="text-xs text-rose-600 mt-1">
                                          Desplazado de: <b>{op3.targetCourseCode}</b> por falta de flexibilidad
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-xs text-rose-900 bg-rose-50/80 p-2 rounded border border-rose-200 mb-3">
                                      ⚠️ {op3.description}
                                    </div>

                                    <button
                                      type="button"
                                      disabled={rescueLoading}
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `¿Confirmar desplazamiento?\n\nEl profesor ${op3.displacedTeacherName} SE QUEDARÁ SIN MATERIA en Slot ${currentSlot} y se asignará ${op3.targetCourseCode} a ${c.teacherName}.`
                                          )
                                        ) {
                                          handleExecuteRescue(
                                            currentSlot,
                                            c.teacherId,
                                            c.teacherName,
                                            "Opción 3: Protección Universal",
                                            op3.locked,
                                            `Protección Universal: Desplazado ${op3.displacedTeacherName} (falta de opciones) en ${op3.targetCourseCode} para beneficiar a ${c.teacherName}`
                                          );
                                        }
                                      }}
                                      className="w-full py-2 px-4 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                      <span>{rescueLoading ? "⏳" : "⚖️"}</span>
                                      <span>{rescueLoading ? "Aplicando sanción..." : `Aplicar Protección Universal (Desplazar a ${op3.displacedTeacherName})`}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 4: Potenciales Opciones (Requiere Visto Bueno del Docente Reasignado) */}
                        {currentTab === "opcion4" && (
                          <div className="space-y-4">
                            {/* ALERTA CRÍTICA DESTACADA DE VISTO BUENO */}
                            <div className="border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 shadow-sm">
                              <div className="flex items-start gap-3">
                                <span className="text-2xl mt-0.5">⚠️</span>
                                <div>
                                  <h4 className="font-extrabold text-sm text-amber-950 uppercase tracking-wide">
                                    Alerta Obligatoria: Visto Bueno del Profesor Reasignado Requerido
                                  </h4>
                                  <p className="text-xs text-amber-900 mt-1 font-medium leading-relaxed">
                                    Esta opción analiza <b>potenciales reasignaciones y materias vacantes</b> (cambio de sección, horario alterno o materias afines por experiencia).
                                    <br />
                                    <span className="font-bold underline text-amber-950">REQUISITO INDISPENSABLE:</span> Antes de aplicar cualquiera de estas asignaciones, <b>el profesor reasignado debe dar su VISTO BUENO previo</b>. No proceda sin contar con su aceptación formal expresa.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Listado de Opciones Potenciales Detectadas */}
                            {c.opcion4_potenciales.length === 0 ? (
                              <div className="p-4 border rounded-lg bg-zinc-50 text-xs text-zinc-500 text-center">
                                No se detectaron reasignaciones automáticas directas para las materias solicitadas.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                                  Potenciales opciones detectadas por el sistema ({c.opcion4_potenciales.length}):
                                </div>
                                {c.opcion4_potenciales.map((op4, opIdx) => {
                                  const isConfirmed = !!vistoBuenoConfirm[op4.id];
                                  return (
                                    <div
                                      key={op4.id}
                                      className="border-2 border-purple-200 rounded-xl p-4 bg-gradient-to-r from-purple-50/40 via-white to-indigo-50/30 shadow-2xs hover:border-purple-300 transition-all"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-purple-100">
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-zinc-800 text-white">
                                            Alternativa {opIdx + 1} de {c.opcion4_potenciales.length}
                                          </span>
                                          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                                            {op4.categoryLabel}
                                          </span>
                                        </div>
                                        <span className="text-xs font-semibold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                                          <span>⚠️ Visto bueno requerido:</span>
                                          <b className="underline">{op4.vistoBuenoTeacherName}</b>
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                        {/* Destinatario 1: El docente sin curso */}
                                        <div className="bg-white p-2.5 rounded-lg border border-purple-200 shadow-2xs">
                                          <div className="text-xs font-bold text-purple-900 mb-1">
                                            ✅ Recibe curso: {c.teacherName}
                                          </div>
                                          <div className="text-xs font-mono text-zinc-700">
                                            <b>{op4.targetCourseCode}</b> - {op4.targetCourseName}
                                            {op4.targetCourseHorario && <span className="block text-[11px] text-zinc-500 font-sans">🕒 Horario: {op4.targetCourseHorario}</span>}
                                          </div>
                                        </div>

                                        {/* Destinatario 2: Si hay docente reubicado */}
                                        {op4.reassignedTeacherName !== c.teacherName && (
                                          <div className="bg-white p-2.5 rounded-lg border border-indigo-200 shadow-2xs">
                                            <div className="text-xs font-bold text-indigo-900 mb-1">
                                              🔄 Se reubica: {op4.reassignedTeacherName}
                                            </div>
                                            <div className="text-xs font-mono text-zinc-700">
                                              <b>{op4.destinationCourseCode}</b> - {op4.destinationCourseName}
                                              {op4.destinationCourseHorario && <span className="block text-[11px] text-zinc-500 font-sans">🕒 Horario: {op4.destinationCourseHorario}</span>}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Alerta contextual específica de visto bueno */}
                                      <div className="border border-amber-300 bg-amber-50/90 rounded-lg p-2.5 mb-3 text-xs text-amber-950">
                                        <div className="font-bold text-amber-900 mb-0.5">{op4.alertVistoBueno}</div>
                                        <div className="text-[11px] text-zinc-700">
                                          {op4.description}
                                        </div>
                                      </div>

                                      {/* Checkbox de confirmación obligatoria */}
                                      <div className="bg-white border-2 border-amber-200 rounded-lg p-2.5 mb-3">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-800 select-none">
                                          <input
                                            type="checkbox"
                                            checked={isConfirmed}
                                            onChange={(e) =>
                                              setVistoBuenoConfirm((prev) => ({
                                                ...prev,
                                                [op4.id]: e.target.checked,
                                              }))
                                            }
                                            className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                                          />
                                          <span>
                                            Confirmo que el profesor <u className="font-bold text-purple-900">{op4.vistoBuenoTeacherName}</u> ha otorgado su <b>VISTO BUENO</b> formal para esta reasignación.
                                          </span>
                                        </label>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={rescueLoading || !isConfirmed}
                                        onClick={() =>
                                          handleExecuteRescue(
                                            currentSlot,
                                            c.teacherId,
                                            c.teacherName,
                                            "Opción 4: Potencial con Visto Bueno",
                                            op4.locked,
                                            `Opción 4 (Visto Bueno): ${op4.description}`
                                          )
                                        }
                                        className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 ${
                                          isConfirmed
                                            ? "bg-purple-700 hover:bg-purple-800 text-white cursor-pointer"
                                            : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                                        }`}
                                      >
                                        <span>{rescueLoading ? "⏳" : "🤝"}</span>
                                        <span>
                                          {rescueLoading
                                            ? "Aplicando reasignación..."
                                            : isConfirmed
                                            ? `Aplicar Reasignación (Visto Bueno de ${op4.vistoBuenoTeacherName.split(" ")[0]} Confirmado)`
                                            : "Marque la casilla de Visto Bueno para habilitar este botón"}
                                        </span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Explorador de Materias Vacantes del Slot */}
                            {rescueAnalysis?.vacantCourses && rescueAnalysis.vacantCourses.length > 0 && (
                              <div className="border border-zinc-200 rounded-xl bg-zinc-50/80 p-4 mt-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                  <div>
                                    <h5 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">
                                      Explorador de Materias Vacantes en Slot {currentSlot} ({rescueAnalysis.vacantCourses.length} disponibles)
                                    </h5>
                                    <p className="text-[11px] text-zinc-600">
                                      Puede ofertar cualquiera de estas materias vacantes directamente a {c.teacherName}.
                                    </p>
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Filtrar por código o nombre..."
                                    value={vacantSearch}
                                    onChange={(e) => setVacantSearch(e.target.value)}
                                    className="border rounded-md px-2.5 py-1 text-xs bg-white w-full sm:w-60"
                                  />
                                </div>

                                <div className="max-h-60 overflow-y-auto border rounded-lg bg-white divide-y">
                                  {rescueAnalysis.vacantCourses
                                    .filter(
                                      (vc) =>
                                        !vacantSearch ||
                                        vc.code.toLowerCase().includes(vacantSearch.toLowerCase()) ||
                                        vc.name.toLowerCase().includes(vacantSearch.toLowerCase())
                                    )
                                    .map((vc) => {
                                      const customKey = `custom-vacant-${c.teacherId}-${vc.id}`;
                                      const isCustomConfirmed = !!vistoBuenoConfirm[customKey];
                                      return (
                                        <div key={vc.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-50">
                                          <div>
                                            <div className="font-bold text-xs text-zinc-900">
                                              {vc.code} - {vc.name}
                                            </div>
                                            <div className="text-[11px] text-zinc-500 font-mono">
                                              {vc.dias ?? ""} {vc.horario ?? ""} | Ubicación: {vc.ubicacion ?? "Sin aula"} | Cupo: {vc.cupo ?? "N/A"}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-3 shrink-0">
                                            <label className="flex items-center gap-1.5 text-[11px] text-zinc-700 cursor-pointer select-none">
                                              <input
                                                type="checkbox"
                                                checked={isCustomConfirmed}
                                                onChange={(e) =>
                                                  setVistoBuenoConfirm((prev) => ({
                                                    ...prev,
                                                    [customKey]: e.target.checked,
                                                  }))
                                                }
                                                className="h-3.5 w-3.5 rounded text-purple-600"
                                              />
                                              <span>Visto bueno de {c.teacherName.split(" ")[0]}</span>
                                            </label>

                                            <button
                                              type="button"
                                              disabled={rescueLoading || !isCustomConfirmed}
                                              onClick={() =>
                                                handleExecuteRescue(
                                                  currentSlot,
                                                  c.teacherId,
                                                  c.teacherName,
                                                  "Opción 4: Materia Vacante Asignada",
                                                  [{ courseId: vc.id, teacherId: c.teacherId }],
                                                  `Asignación vacante acordada: ${vc.code} (${vc.name}) para ${c.teacherName}`
                                                )
                                              }
                                              className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                                                isCustomConfirmed
                                                  ? "bg-purple-700 hover:bg-purple-800 text-white cursor-pointer"
                                                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                                              }`}
                                            >
                                              Asignar Vacante
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
        {empates.length > 0 && (
          <div className="border rounded bg-amber-50 p-3 mt-3">
            <h3 className="font-semibold text-sm mb-2 text-amber-800">⚠ Empates detectados en último cálculo (slot {lastSlot}) — reasignación con recálculo bloqueado</h3>
            <p className="text-xs text-zinc-600 mb-2">Mismo puntaje entre 2+ docentes para el mismo curso. Seleccione ganador y reasigne; el slot completo se recalculará bloqueando su elección.</p>
            {empates.map((e) => (
              <div key={e.courseId} className="border rounded p-2 bg-white mb-2">
                <div className="font-medium text-sm">
                  {e.courseCode} - {e.courseName}
                  {(() => {
                    const c = courses.find((c) => c.id === e.courseId);
                    return c ? ` | ${c.dias ?? ""} ${c.horario ?? ""}` : "";
                  })()}{" "}
                  (P{e.priority} puntaje {e.puntaje})
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {e.tied.map((t) => (
                    <label key={t.teacherId} className={`px-2 py-1 rounded border text-xs cursor-pointer ${reassignPick[e.courseId] === t.teacherId ? "bg-indigo-100 border-indigo-400" : "bg-zinc-50"}`}>
                      <input type="radio" name={`empate-${e.courseId}`} checked={reassignPick[e.courseId] === t.teacherId} onChange={() => setReassignPick((prev) => ({ ...prev, [e.courseId]: t.teacherId }))} className="mr-1" />
                      {t.teacherName} (puntaje {t.puntaje})
                    </label>
                  ))}
                </div>
                <button onClick={() => handleReassign(e.courseId, lastSlot!)} disabled={assignmentLoading !== null || !reassignPick[e.courseId]} className="mt-2 mr-2 px-3 py-1 rounded bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-50">
                  Reasignar y recalcular slot {lastSlot}
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <button onClick={handleSimulate} disabled={simulateLoading || Object.keys(reassignPick).length === 0} className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                {simulateLoading ? "Simulando..." : `Simular reasignación (sin guardar) - calcula P1/P2/P3`}
              </button>
              {simulateResult && (
                <button onClick={handleReassignLocked} disabled={assignmentLoading !== null} className="px-4 py-2 rounded bg-green-700 text-white text-sm hover:bg-green-800 disabled:opacity-50">
                  {assignmentLoading === lastSlot ? "Reasignando..." : "Reasignar con mismos bloqueos"}
                </button>
              )}
              <button onClick={() => { setReassignPick({}); setSimulateResult(null); }} className="px-3 py-2 rounded border bg-white text-xs">
                Limpiar selección
              </button>
            </div>
            {simulateResult && (
              <div className="border rounded bg-white p-3 mt-3">
                <h4 className="font-semibold text-sm mb-2">Resultado simulación slot {simulateResult.slotNo} (no persistido)</h4>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div className="border rounded p-2 bg-zinc-50">
                    <div className="font-medium">Actual persistido</div>
                    <div>P1: {simulateResult.actualesTotales.p1} | P2: {simulateResult.actualesTotales.p2} | P3: {simulateResult.actualesTotales.p3} | Total: {simulateResult.actualesTotales.total}</div>
                  </div>
                  <div className="border rounded p-2 bg-blue-50">
                    <div className="font-medium">Simulado (con bloqueos)</div>
                    <div>P1: {simulateResult.totales.p1} | P2: {simulateResult.totales.p2} | P3: {simulateResult.totales.p3} | Total: {simulateResult.totales.total}</div>
                  </div>
                  <div className="border rounded p-2 bg-amber-50">
                    <div className="font-medium">Δ Diferencia</div>
                    <div>P1: {simulateResult.diff.p1 > 0 ? `+${simulateResult.diff.p1}` : simulateResult.diff.p1} | P2: {simulateResult.diff.p2 > 0 ? `+${simulateResult.diff.p2}` : simulateResult.diff.p2} | P3: {simulateResult.diff.p3 > 0 ? `+${simulateResult.diff.p3}` : simulateResult.diff.p3}</div>
                  </div>
                </div>
                <div className="text-xs text-zinc-600 mb-2">Bloqueos simulados: {simulateResult.locked.map((l: any) => `curso ${l.courseId}→doc ${l.teacherId}`).join(", ") || "ninguno"}</div>
                <div className="overflow-auto max-h-40 border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-100">
                      <tr>
                        <th className="px-2 py-1 text-left">Docente</th>
                        <th className="px-2 py-1 text-left">Curso</th>
                        <th className="px-2 py-1 text-center">Prio</th>
                        <th className="px-2 py-1 text-center">Puntaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulateResult.asignados.map((a: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{a.teacherName}</td>
                          <td className="px-2 py-1">{a.courseCode}</td>
                          <td className="px-2 py-1 text-center">{a.priority}</td>
                          <td className="px-2 py-1 text-center">{a.puntaje}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {simulateResult.empates?.length > 0 && <div className="text-xs text-amber-700 mt-2">Empates restantes tras simulación: {simulateResult.empates.length}</div>}
                <div className="mt-2 text-xs text-zinc-500">Para aplicar definitivamente, use Reasignar en cada empate o seleccione múltiples y use Simular → luego Reasignar con mismos bloqueos.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Experiencia docente por periodos */}
      <div className="border rounded-lg p-4 bg-white space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm sm:text-base text-zinc-900">
              Experiencia docente (periodos impartidos en los últimos 4 años)
            </h2>
            <p className="text-xs text-zinc-600">
              +1 punto por cada periodo impartido en los últimos 4 años (máx. 8 puntos) <b>por código de materia</b>. Cada periodo cuenta una sola vez independientemente del número de secciones impartidas.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5">
              <span>{fileUploadLoading ? "⏳" : "⬆️"}</span>
              <span>{fileUploadLoading ? "Procesando..." : "Subir / Actualizar Archivo"}</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleUploadHistoricalFile}
                disabled={fileUploadLoading}
                className="hidden"
              />
            </label>

            <button
              onClick={() => {
                setShowFilesDrawer(!showFilesDrawer);
                if (!showFilesDrawer) fetchHistoricalFiles();
              }}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>📁</span>
              <span>{showFilesDrawer ? "Ocultar Archivos" : `Ver Archivos (${historicalFiles.length})`}</span>
            </button>

            <button
              onClick={handleImportHistory}
              disabled={importHistoryLoading}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>{importHistoryLoading ? "⏳" : "↻"}</span>
              <span>{importHistoryLoading ? "Recalculando..." : "Recalcular desde Cero"}</span>
            </button>
          </div>
        </div>

        {/* Mensaje de feedback de archivos */}
        {fileMessage && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between gap-2 ${
              fileMessage.type === "ok"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-red-50 text-red-900 border border-red-200"
            }`}
          >
            <span>{fileMessage.text}</span>
            <button onClick={() => setFileMessage(null)} className="text-xs font-bold hover:opacity-75">✕</button>
          </div>
        )}

        {/* Panel desplegable de Archivos Históricos */}
        {showFilesDrawer && (
          <div className="bg-zinc-50 border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="font-bold text-xs text-zinc-800 uppercase tracking-wide">
                  Archivos en Programación Académica Histórica ({historicalFiles.length})
                </h3>
                <p className="text-2xs text-zinc-500">
                  Los archivos con el mismo nombre se sobrescriben automáticamente en caso de correcciones o errores.
                </p>
              </div>
              <label className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer underline">
                + Agregar otro archivo
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleUploadHistoricalFile}
                  disabled={fileUploadLoading}
                  className="hidden"
                />
              </label>
            </div>

            {historicalFiles.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-3">No hay archivos en la carpeta histórica.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto">
                {historicalFiles.map((file) => (
                  <div
                    key={file.name}
                    className="bg-white border rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-2xs hover:border-zinc-300 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{file.extension === ".csv" ? "📄" : "📊"}</span>
                        <span className="text-xs font-semibold text-zinc-800 truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <p className="text-2xs text-zinc-400 mt-0.5">
                        {file.sizeFormatted} • {new Date(file.updatedAt).toLocaleDateString("es-MX")}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteHistoricalFile(file.name)}
                      disabled={fileUploadLoading}
                      title={`Eliminar ${file.name}`}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="overflow-auto max-h-72 border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-zinc-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-zinc-700">Docente</th>
                <th className="px-3 py-2 text-left font-semibold text-zinc-700">Curso (Clave)</th>
                <th className="px-3 py-2 text-center font-semibold text-zinc-700">Periodos impartidos (4 años)</th>
                <th className="px-3 py-2 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: any[] = [];
                const courseCodesByTeacher = new Map<number, Set<string>>();
                if (data?.slots) {
                  for (const s of data.slots) {
                    for (const o of s.options) {
                      if (!courseCodesByTeacher.has(s.teacher.id)) courseCodesByTeacher.set(s.teacher.id, new Set());
                      courseCodesByTeacher.get(s.teacher.id)!.add(o.course.code);
                    }
                  }
                }
                // Para docentes sin petitions, mostrar global
                for (const t of teachersExp) {
                  const codes = courseCodesByTeacher.get(t.id);
                  if (!codes || codes.size === 0) {
                    rows.push(
                      <tr key={`${t.id}-global`} className="border-t bg-amber-50/70">
                        <td className="px-3 py-1.5">{t.name}</td>
                        <td className="px-3 py-1.5 text-zinc-500 italic">General (sin solicitudes activas)</td>
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={expEdit[t.email] ?? String(t.expPeriods ?? t.expYears ?? 0)}
                            onChange={(e) => setExpEdit((prev) => ({ ...prev, [t.email]: e.target.value }))}
                            className="w-16 border rounded px-1.5 py-0.5 text-center font-mono font-medium"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <button onClick={() => handleUpdateExp(t.email)} className="px-2.5 py-1 rounded bg-zinc-900 text-white text-xs hover:bg-zinc-800 transition-colors">
                            Guardar
                          </button>
                        </td>
                      </tr>
                    );
                  } else {
                    for (const code of Array.from(codes)) {
                      const expEntry = (t as TeacherWithExps).exps?.find((e) => e.courseCode === code);
                      const periods = expEntry?.periods ?? expEntry?.years ?? 0;
                      const key = `${t.email}_${code}`;
                      rows.push(
                        <tr key={`${t.id}-${code}`} className="border-t hover:bg-zinc-50/50 transition-colors">
                          <td className="px-3 py-1.5 font-medium text-zinc-900">{t.name}</td>
                          <td className="px-3 py-1.5 font-mono font-semibold text-indigo-700">{code}</td>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={expCourseEdit[key] ?? String(periods)}
                              onChange={(e) => setExpCourseEdit((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="w-16 border rounded px-1.5 py-0.5 text-center font-mono font-medium"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <button onClick={() => handleUpdateExpCourse(t.email, code)} className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors">
                              Guardar {code}
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  }
                }
                return rows;
              })()}
              {teachersExp.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-zinc-500">
                    Sin docentes en este semestre
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-zinc-500">
          💡 Puedes presionar <strong>"Sincronizar desde Histórico"</strong> para calcular automáticamente los periodos impartidos leyendo la programación académica de los últimos 4 años, o ajustar manualmente los periodos en la tabla.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end border rounded-lg p-4 bg-white">
        <div>
          <label className="text-sm font-medium">Semestre (peticiones)</label>
          <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} className="border rounded px-3 py-2 text-sm bg-white">
            {semesters.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.label} {s.isActive ? "(Activo)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button onClick={fetchAdmin} disabled={loading} className="px-4 py-2 rounded bg-zinc-900 text-white text-sm">
          {loading ? "Cargando..." : "Recargar"}
        </button>
        <button onClick={exportCSV} disabled={!data} className="px-4 py-2 rounded border bg-white text-sm">
          Exportar CSV
        </button>
        <div className="ml-auto flex gap-2">
          <input placeholder="Filtrar docente (email/nombre)" value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="border rounded px-3 py-2 text-sm w-64" />
          <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="border rounded px-3 py-2 text-sm bg-white">
            <option value="">Todas las materias</option>
            {data?.statsByCourse.map((s) => (
              <option key={s.courseId} value={String(s.courseId)}>
                {s.course.code} - {s.course.name} | {s.course.horario || ""} {s.course.ubicacion || ""} ({s.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded p-3 bg-white">
              <div className="text-xs text-zinc-500">Docentes con peticiones</div>
              <div className="text-xl font-semibold">
                {[1, 2, 3]
                  .map((slot) => `S${slot}: ${new Set(data.slots.filter((s) => s.slot_no === slot).map((s) => s.teacher.id)).size}`)
                  .join(" ")}
              </div>
            </div>
            <div className="border rounded p-3 bg-white">
              <div className="text-xs text-zinc-500">Docentes sin asignación (por slot)</div>
              <div className="text-xl font-semibold">
                {[1, 2, 3]
                  .map((slot) => {
                    const assigned = new Set((assignments?.assignments ?? []).filter((a) => a.slotNo === slot).map((a) => a.teacherId));
                    const missing = new Set(data.slots.filter((s) => s.slot_no === slot && !assigned.has(s.teacher.id)).map((s) => s.teacher.id));
                    return `S${slot}: ${missing.size}`;
                  })
                  .join(" ")}
              </div>
            </div>
            <div className="border rounded p-3 bg-white">
              <div className="text-xs text-zinc-500">Clases sin asignación (global)</div>
              <div className="text-xl font-semibold">{courses.filter((c) => !assignments?.assignments.some((a) => a.courseId === c.id)).length}</div>
            </div>
          </div>

          <div className="border rounded bg-white p-3">
            <h3 className="font-semibold mb-2 text-sm">Demanda por materia</h3>
            <div className="flex flex-wrap gap-2">
              {data.statsByCourse
                .sort((a, b) => b.count - a.count)
                .map((s) => (
                  <span key={s.courseId} className="px-2 py-1 rounded bg-zinc-100 border text-xs">
                    {s.course.code} - {s.course.dias || ""} {s.course.horario || ""} ({s.count})
                  </span>
                ))}
              {data.statsByCourse.length === 0 && <span className="text-xs text-zinc-500">Sin datos</span>}
            </div>
          </div>

          <div className="border rounded bg-white overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Docente</th>
                  <th className="text-left px-3 py-2">Contacto</th>
                  <th className="text-center px-3 py-2">Slot</th>
                  <th className="text-left px-3 py-2">Materias (código - prioridad)</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlots?.map((s, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.teacher.name}</div>
                      {s.teacher.employeeId && (
                        <div className="text-xs text-zinc-500 font-mono">No. {s.teacher.employeeId}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{s.teacher.email}</div>
                      {s.teacher.phone && <div className="text-zinc-500">📞 {s.teacher.phone}</div>}
                    </td>
                    <td className="px-3 py-2 text-center">{s.slot_no}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.options
                          .slice()
                          .sort((a, b) => a.priority - b.priority)
                          .map((o) => {
                            const assigned = assignments?.assignments.some((a) => a.courseId === o.courseId && a.teacherId === s.teacher.id);
                            return (
                              <span key={o.courseId} className={`px-2 py-0.5 rounded border text-xs ${assigned ? "border-green-600 bg-green-50" : "bg-zinc-50"}`}>
                                {o.course.code} - {o.course.dias || ""} {o.course.horario || ""} {o.course.ubicacion || ""}{" "}
                                <span className={`ml-1 px-1 rounded text-white ${o.priority === 1 ? "bg-red-600" : o.priority === 2 ? "bg-amber-600" : "bg-zinc-500"}`}>P{o.priority}</span>
                                {assigned && <span className="ml-1 px-1 rounded text-white bg-green-600">✓ asignada</span>}
                              </span>
                            );
                          })}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSlots?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                      No hay peticiones con ese filtro
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!data && !loading && <p className="text-sm text-zinc-500">Sin datos para este semestre.</p>}

      <FillExcelModal
        isOpen={showFillExcelModal}
        onClose={() => setShowFillExcelModal(false)}
        semesterId={semesterId}
        semesterLabel={semesters.find((s) => String(s.id) === semesterId)?.label || semesterId}
        onSuccessMessage={(msg) => setAssignmentMessage({ type: "ok", text: msg })}
      />
    </main>
  );
}
